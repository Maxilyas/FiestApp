// Le tirage à la pièce (`core/tirageALaPiece.ts`, le 25 octobre 2026, le lot
// A3 du Cabinet de curiosités) : sorti de `core/campagne.ts` pour que le
// Cabinet tire comme l'Expédition sans importer `CampagneStore`. Rien n'y
// change d'un tirage pour les modes d'avant — le code d'avant est recopié ici,
// la référence, et chaque sortie se compare à la sienne au même hasard (règle
// `campagne.md`). Ce qui s'y ajoute ne vaut que pour qui le demande : la
// fenêtre de sept jours du Cabinet (`fenetreMs`), deux marches qui se valent
// (`aussi`), sept événements à une frise (`choisirLaFrise(…, n)`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as campagne from '../src/core/campagne'
import { DejaPrises, jumelles, type Intitule } from '../src/core/jumelles'
import { VUE_RECENTE_MS, laMoinsVue, tirerPourUneEscale, versQuestionDeSerie } from '../src/core/tirageALaPiece'
import type { QuestionDeLaBase } from '../src/core/baseCampagne'
import { choisirLaFrise, type EvenementDeLaFrise } from '../../shared/frise'
import { JOURS_SANS_REDITE } from '../../shared/cabinet/bareme'
import { NIVEAUX, niveauDeQuestion, type MesureDUneQuestion, type Niveau } from '../../shared/campagne'

// ── Le tirage à la pièce d'avant, tel que `core/campagne.ts` l'avait le 25 octobre 2026 : la référence ──

const D_AVANT_RECENTE_MS = 24 * 3600_000
const classeDAvant = (le: number | undefined, maintenant: number): 0 | 1 | 2 => (le === undefined ? 0 : maintenant - le < D_AVANT_RECENTE_MS ? 2 : 1)

function melangerDAvant<T>(liste: readonly T[]): T[] {
  const copie = [...liste]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

function fraicheurDAvant(vues: Pick<ReadonlyMap<string, number>, 'get'>, maintenant: number) {
  return (id: string): { recente: number; vue: number; le: number } => {
    const le = vues.get(id)
    return le === undefined ? { recente: 0, vue: 0, le: 0 } : { recente: classeDAvant(le, maintenant) === 2 ? 1 : 0, vue: 1, le }
  }
}

const EMPRUNTS_D_AVANT: Readonly<Record<Niveau, readonly Niveau[]>> = {
  facile: ['facile', 'moyen', 'difficile', 'expert'],
  moyen: ['moyen', 'difficile', 'facile', 'expert'],
  difficile: ['difficile', 'expert', 'moyen', 'facile'],
  expert: ['expert', 'difficile', 'moyen', 'facile'],
}

function passeAvantDAvant(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

class OrdreDAvant {
  private readonly echanges = new Map<number, number>()
  private readonly tires: number[] = []
  constructor(private readonly n: number) {}
  rang(p: number): number | undefined {
    while (this.tires.length <= p && this.tires.length < this.n) {
      const i = this.tires.length
      const j = i + Math.floor(Math.random() * (this.n - i))
      const aJ = this.echanges.get(j) ?? j
      this.echanges.set(j, this.echanges.get(i) ?? i)
      this.echanges.delete(i)
      this.tires.push(aJ)
    }
    return this.tires[p]
  }
}

function tirageDAvant(
  tas: readonly (readonly QuestionDeLaBase[])[],
  marche: Niveau,
  combien: number,
  {
    sansVraiFaux,
    garde,
    vues,
    mesure,
    maintenant,
    posees = [],
  }: {
    sansVraiFaux: boolean
    garde?: (q: QuestionDeLaBase) => boolean
    vues: Pick<ReadonlyMap<string, number>, 'get'>
    mesure: ReadonlyMap<string, MesureDUneQuestion>
    maintenant: number
    posees?: readonly Intitule[]
  },
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  const n = tas.reduce((s, morceau) => s + morceau.length, 0)
  const question = (k: number): QuestionDeLaBase => {
    for (const morceau of tas) {
      if (k < morceau.length) return morceau[k]
      k -= morceau.length
    }
    throw new RangeError(`question ${k} hors du tas`)
  }
  const ordre = new OrdreDAvant(n)
  const marches = new Map<number, Niveau>()
  const marcheDeLa = (k: number, q: QuestionDeLaBase): Niveau => {
    let m = marches.get(k)
    if (m === undefined) marches.set(k, (m = niveauDeQuestion(q.meta.difficulte, mesure.get(q.id))))
    return m
  }
  const usage = new Map<string, number>()
  const prises = new Set<number>()
  const deja = new DejaPrises()
  for (const q of posees) deja.prendre(q)
  const fraicheur = fraicheurDAvant(vues, maintenant)
  const rang = (q: QuestionDeLaBase): number[] => {
    const f = fraicheur(q.id)
    return [f.recente, f.vue, usage.get(q.meta.sousTheme) ?? 0, deja.jumelle(q) ? 1 : 0, f.le]
  }
  const tirees: { question: QuestionDeLaBase; niveau: Niveau }[] = []
  for (let place = 0; place < combien; place++) {
    for (const m of EMPRUNTS_D_AVANT[marche]) {
      let meilleure = -1
      let sonRang: number[] | null = null
      for (let p = 0; ; p++) {
        const k = ordre.rang(p)
        if (k === undefined) break
        if (prises.has(k)) continue
        const q = question(k)
        if (sansVraiFaux && q.reponses.length === 2) continue
        if (marcheDeLa(k, q) !== m) continue
        if (garde && !garde(q)) continue
        const r = rang(q)
        if (!sonRang || passeAvantDAvant(r, sonRang)) {
          meilleure = k
          sonRang = r
          if (r.every(x => x === 0)) break
        }
      }
      if (meilleure >= 0) {
        const q = question(meilleure)
        prises.add(meilleure)
        deja.prendre(q)
        usage.set(q.meta.sousTheme, (usage.get(q.meta.sousTheme) ?? 0) + 1)
        tirees.push({ question: q, niveau: m })
        break
      }
    }
  }
  return melangerDAvant(tirees)
}

function laMoinsVueDAvant<T>(candidats: readonly T[], idDe: (x: T) => string, vues: Pick<ReadonlyMap<string, number>, 'get'>): T | undefined {
  const jamais: T[] = []
  let ancienne: T | undefined
  let le = Number.POSITIVE_INFINITY
  for (const x of candidats) {
    const v = vues.get(idDe(x))
    if (v === undefined) jamais.push(x)
    else if (v < le) {
      le = v
      ancienne = x
    }
  }
  return jamais.length > 0 ? jamais[Math.floor(Math.random() * jamais.length)] : ancienne
}

function versQuestionDAvant(q: QuestionDeLaBase, niveau: Niveau) {
  const ordre = q.reponses.length === 2 ? [0, 1] : melangerDAvant(q.reponses.map((_, i) => i))
  return { id: q.id, texte: q.texte, reponses: ordre.map(i => q.reponses[i]), bonne: ordre.indexOf(q.bonne), categorie: q.meta.categorie, anecdote: q.anecdote, niveau, sousTheme: q.meta.sousTheme }
}

/** Le choix d'une frise d'avant `n` : toujours quatre événements. */
function friseDAvant(candidats: readonly EvenementDeLaFrise[], ecart: number, hasard: () => number, dejaVu: (id: string) => boolean = () => false): EvenementDeLaFrise[] | null {
  const melanges = (tas: EvenementDeLaFrise[]) => {
    for (let i = tas.length - 1; i > 0; i--) {
      const j = Math.floor(hasard() * (i + 1))
      ;[tas[i], tas[j]] = [tas[j], tas[i]]
    }
    return tas
  }
  const ordre = [...melanges(candidats.filter(e => !dejaVu(e.id))), ...melanges(candidats.filter(e => dejaVu(e.id)))]
  for (let e = Math.max(1, Math.floor(ecart)); ; e = Math.max(1, Math.floor(e / 2))) {
    const gardes: EvenementDeLaFrise[] = []
    for (const x of ordre) {
      if (gardes.every(g => Math.abs(g.annee - x.annee) >= e)) gardes.push(x)
      if (gardes.length === 4) return gardes.sort((a, b) => a.annee - b.annee)
    }
    if (e === 1) return null
  }
}

// ── Le même hasard des deux côtés, et de quoi inventer des tas ──────────────

/** `f` sous un `Math.random` qui recommence de la même graine : les deux tirages lisent les mêmes cartes. */
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

/** Un hasard à soi, pour inventer les tas et les joueurs : il ne touche pas à celui des tirages. */
function inventeur(graine: number) {
  let g = graine
  return () => ((g = (g * 48271) % 2147483647) - 1) / 2147483646
}

const MAINTENANT = Date.UTC(2026, 9, 25, 9)
const JOUR_MS = 86_400_000
const SEPT_JOURS_MS = JOURS_SANS_REDITE * JOUR_MS

/** Une question d'essai : 2 facile, 3 moyenne, 4 difficile, 5 experte (sans mesure) ; ce que le tirage en lit, rien de plus. */
function question(id: string, difficulte: number, { texte, reponses, sousTheme = 'essai', categorie = 'Histoire' }: { texte?: string; reponses?: string[]; sousTheme?: string; categorie?: string } = {}): QuestionDeLaBase {
  return {
    id,
    texte: texte ?? `Question numéro ${id} de l'essai, laquelle est la bonne ?`,
    reponses: reponses ?? [`Bonne ${id}`, `Autre A${id}`, `Autre B${id}`, `Autre C${id}`],
    bonne: 0,
    anecdote: null,
    meta: { categorie, sousTheme, difficulte },
  } as unknown as QuestionDeLaBase
}

const lisible = (tirees: readonly { question: QuestionDeLaBase; niveau: Niveau }[]) => tirees.map(t => `${t.question.id}:${t.niveau}`)

/** Un tas au hasard : des catégories, des sous-thèmes, des formes d'intitulé qui se répètent, quelques vrai ou faux ; des vues de toute fraîcheur. */
function unEssai(hasard: () => number, essai: number) {
  const n = 1 + Math.floor(hasard() * 150)
  const questions = Array.from({ length: n }, (_, i) => {
    const forme = Math.floor(hasard() * 6)
    const vraiFaux = hasard() < 0.15
    return question(`q${essai}-${i}`, 1 + Math.floor(hasard() * 5), {
      texte: `Forme ${forme} de l'essai, numéro ${i} ?`,
      reponses: vraiFaux ? ['Vrai', 'Faux'] : ['A', 'B', 'C', `D${Math.floor(hasard() * 8)}`].map(r => `${r}${Math.floor(hasard() * 3)}`),
      sousTheme: `st${Math.floor(hasard() * 5)}`,
      categorie: ['Histoire', 'Sport', 'Musique'][Math.floor(hasard() * 3)],
    })
  })
  const vues = new Map<string, number>()
  for (const q of questions) {
    const r = hasard()
    // Jamais vue, vue il y a longtemps, cette semaine, ces vingt-quatre heures, ou d'une horloge en avance ; des vues au même instant.
    if (r < 0.35) continue
    vues.set(q.id, r < 0.5 ? MAINTENANT - 30 * JOUR_MS : r < 0.7 ? MAINTENANT - Math.floor(hasard() * 7 * JOUR_MS) : r < 0.95 ? MAINTENANT - Math.floor(hasard() * 2 * VUE_RECENTE_MS) : MAINTENANT + 60_000)
  }
  const mesure = new Map<string, MesureDUneQuestion>()
  for (const q of questions) {
    if (hasard() < 0.3) {
      const total = 1 + Math.floor(hasard() * 7)
      mesure.set(q.id, { justes: Math.floor(hasard() * (total + 1)), total })
    }
  }
  // En un, deux ou trois morceaux, comme les catégories d'un mélange.
  const coupes = [Math.floor(hasard() * (n + 1)), Math.floor(hasard() * (n + 1))].sort((a, b) => a - b)
  const morceaux = hasard() < 0.4 ? [questions] : [questions.slice(0, coupes[0]), questions.slice(coupes[0], coupes[1]), questions.slice(coupes[1])]
  const posees = hasard() < 0.5 ? questions.filter(() => hasard() < 0.1) : []
  const garde = hasard() < 0.3 ? (q: QuestionDeLaBase) => q.texte.includes('Forme 1') || q.texte.includes('Forme 3') : undefined
  return {
    tas: morceaux,
    marche: NIVEAUX[Math.floor(hasard() * NIVEAUX.length)],
    combien: 1 + Math.floor(hasard() * 8),
    options: { sansVraiFaux: hasard() < 0.5, garde, vues, mesure, maintenant: MAINTENANT, posees },
  }
}

// ── Le tirage d'avant, au même hasard ───────────────────────────────────────

test('sans fenêtre ni marche de plus, le tirage à la pièce est celui d’avant, question pour question, au même hasard', () => {
  const hasard = inventeur(17)
  for (let essai = 0; essai < 400; essai++) {
    const { tas, marche, combien, options } = unEssai(hasard, essai)
    const graine = 1 + essai
    const attendu = lisible(auHasard(graine, () => tirageDAvant(tas, marche, combien, options)))
    const dit = `essai ${essai}, ${tas.flat().length} questions, ${marche}, ${combien}`
    assert.deepEqual(lisible(auHasard(graine, () => tirerPourUneEscale(tas, marche, combien, options))), attendu, dit)
    // La fenêtre d'office et aucune marche de plus, dites en toutes lettres : le même tirage.
    assert.deepEqual(lisible(auHasard(graine, () => tirerPourUneEscale(tas, marche, combien, { ...options, fenetreMs: VUE_RECENTE_MS, aussi: [] }))), attendu, dit)
  }
})

test('le magasin de la campagne réexporte le même tirage et la même fraîcheur : ses lecteurs d’avant ne changent pas', () => {
  assert.equal(campagne.tirerPourUneEscale, tirerPourUneEscale)
  assert.equal(campagne.VUE_RECENTE_MS, VUE_RECENTE_MS)
  assert.equal(VUE_RECENTE_MS, D_AVANT_RECENTE_MS)
})

test('une question de la base garde le battage de ses réponses, et la moins vue son hasard, comme avant', () => {
  const hasard = inventeur(5)
  for (let essai = 0; essai < 200; essai++) {
    const q = question(`v${essai}`, 1 + (essai % 5), { reponses: essai % 7 === 0 ? ['Vrai', 'Faux'] : ['A', 'B', 'C', 'D'].slice(0, 3 + (essai % 2)) })
    const niveau = NIVEAUX[essai % 4]
    assert.deepEqual(
      auHasard(essai + 1, () => versQuestionDeSerie(q, niveau)),
      auHasard(essai + 1, () => versQuestionDAvant(q, niveau)),
    )
    const candidats = Array.from({ length: 1 + Math.floor(hasard() * 12) }, (_, i) => `c${i}`)
    const vues = new Map(candidats.filter(() => hasard() < 0.6).map(id => [id, MAINTENANT - Math.floor(hasard() * 30 * JOUR_MS)]))
    assert.equal(
      auHasard(essai + 1, () => laMoinsVue(candidats, id => `cab:lieu:${id}`, { get: (id: string) => vues.get(id.slice('cab:lieu:'.length)) })),
      auHasard(essai + 1, () => laMoinsVueDAvant(candidats, id => `cab:lieu:${id}`, { get: (id: string) => vues.get(id.slice('cab:lieu:'.length)) })),
    )
  }
  // « Vrai » et « Faux » restent dans cet ordre, et la bonne suit sa réponse.
  const vf = versQuestionDeSerie({ ...question('vf', 2), reponses: ['Vrai', 'Faux'], bonne: 1 } as QuestionDeLaBase, 'facile')
  assert.deepEqual([vf.reponses, vf.bonne], [['Vrai', 'Faux'], 1])
})

// ── La fenêtre de sept jours du Cabinet ─────────────────────────────────────

test('la fenêtre de sept jours : vue ces jours-ci, une question ne passe plus devant celle d’il y a trois semaines', () => {
  // La première prise sert le sous-thème « a » ; la seconde départage une vue d'il y a trois semaines de ce sous-thème servi et
  // une vue d'il y a trois jours d'un autre. Sur vingt-quatre heures, les deux sont « vues », et le sous-thème moins servi passe.
  const tas = [[question('servie', 3, { sousTheme: 'a' }), question('ancienne', 3, { sousTheme: 'a' }), question('cette-semaine', 3, { sousTheme: 'b' })]]
  const vues = new Map([
    ['ancienne', MAINTENANT - 21 * JOUR_MS],
    ['cette-semaine', MAINTENANT - 3 * JOUR_MS],
  ])
  const tirer = (fenetreMs?: number) =>
    tirerPourUneEscale(tas, 'moyen', 2, { sansVraiFaux: false, vues, mesure: new Map(), maintenant: MAINTENANT, ...(fenetreMs !== undefined && { fenetreMs }) })
      .map(t => t.question.id)
      .sort()
  for (let essai = 0; essai < 30; essai++) {
    assert.deepEqual(tirer(), ['cette-semaine', 'servie'], 'vingt-quatre heures, celles de toute la campagne')
    assert.deepEqual(tirer(SEPT_JOURS_MS), ['ancienne', 'servie'], 'sept jours, ceux du Cabinet')
  }
})

test('tout vu ces sept jours : la moins récemment vue sort quand même — une manche a toujours sa question', () => {
  const tas = [[question('hier', 3), question('avant-hier', 3), question('il-y-a-cinq-jours', 3)]]
  const vues = new Map([
    ['hier', MAINTENANT - JOUR_MS],
    ['avant-hier', MAINTENANT - 2 * JOUR_MS],
    ['il-y-a-cinq-jours', MAINTENANT - 5 * JOUR_MS],
  ])
  for (let essai = 0; essai < 20; essai++) {
    const [t] = tirerPourUneEscale(tas, 'moyen', 1, { sansVraiFaux: false, vues, mesure: new Map(), maintenant: MAINTENANT, fenetreMs: SEPT_JOURS_MS })
    assert.equal(t.question.id, 'il-y-a-cinq-jours')
  }
  // Ce que la partie a déjà posé passe pour vu à l'instant, comme à l'Expédition : il ne revient qu'en dernier.
  const posee = new Set(['il-y-a-cinq-jours'])
  const aLInstant = { get: (id: string) => (posee.has(id) ? MAINTENANT : vues.get(id)) }
  const [t] = tirerPourUneEscale(tas, 'moyen', 1, { sansVraiFaux: false, vues: aLInstant, mesure: new Map(), maintenant: MAINTENANT, fenetreMs: SEPT_JOURS_MS })
  assert.equal(t.question.id, 'avant-hier')
})

// ── Deux marches qui se valent ──────────────────────────────────────────────

test('deux marches qui se valent : la fraîcheur départage, jamais la marche, et chacune sort à sa marche', () => {
  const tas = [[question('facile-jamais-vue', 2), question('moyenne-vue', 3)]]
  const vues = new Map([['moyenne-vue', MAINTENANT - 30 * JOUR_MS]])
  const tirer = (aussi?: Niveau[]) => tirerPourUneEscale(tas, 'moyen', 1, { sansVraiFaux: false, vues, mesure: new Map(), maintenant: MAINTENANT, ...(aussi && { aussi }) }).map(t => [t.question.id, t.niveau])
  for (let essai = 0; essai < 20; essai++) {
    assert.deepEqual(tirer(), [['moyenne-vue', 'moyen']], 'sa marche d’abord, même déjà vue')
    assert.deepEqual(tirer(['facile']), [['facile-jamais-vue', 'facile']], 'facile ou moyenne : la jamais vue')
  }
  // Toutes jamais vues : les deux marches sortent, chacune à la sienne.
  const melees = [Array.from({ length: 20 }, (_, i) => question(`m${i}`, i % 2 ? 2 : 3, { sousTheme: `st${i}` }))]
  const sorties = new Map<string, number>()
  for (let essai = 0; essai < 300; essai++) {
    for (const t of tirerPourUneEscale(melees, 'moyen', 3, { sansVraiFaux: false, vues: new Map(), mesure: new Map(), maintenant: MAINTENANT, aussi: ['facile'] })) {
      assert.equal(t.niveau, niveauDeQuestion(t.question.meta.difficulte), `${t.question.id} sort à sa marche`)
      sorties.set(t.niveau, (sorties.get(t.niveau) ?? 0) + 1)
    }
  }
  assert.deepEqual([...sorties.keys()].sort(), ['facile', 'moyen'])
  assert.ok(Math.min(...sorties.values()) > 300, `les deux marches à parts comparables : ${[...sorties].join(', ')}`)
})

test('deux marches qui se valent, vides : les emprunts de la sienne, sans elles', () => {
  const tirer = (tas: QuestionDeLaBase[], marche: Niveau, aussi: Niveau[]) =>
    tirerPourUneEscale([tas], marche, 1, { sansVraiFaux: false, vues: new Map(), mesure: new Map(), maintenant: MAINTENANT, aussi }).map(t => [t.question.id, t.niveau])
  // Facile ou moyenne, aucune : la difficile d'abord, puis l'experte — les emprunts de la moyenne, la facile ôtée.
  assert.deepEqual(tirer([question('experte', 5), question('difficile', 4)], 'moyen', ['facile']), [['difficile', 'difficile']])
  assert.deepEqual(tirer([question('experte', 5)], 'moyen', ['facile']), [['experte', 'expert']])
  // La seconde question du Pari, difficile ou experte : la jamais vue des deux, l'experte s'il le faut, puis la moyenne.
  assert.deepEqual(tirer([question('experte', 5)], 'difficile', ['expert']), [['experte', 'expert']])
  assert.deepEqual(tirer([question('moyenne', 3), question('facile', 2)], 'difficile', ['expert']), [['moyenne', 'moyen']])
})

test('un tas de QCM d’une même catégorie, pour l’Éclair : cinq d’un coup, distinctes, sans vrai ou faux, sans jumelles tant qu’il en a d’autres', () => {
  // Un tas comme le Cabinet le garde : une catégorie, quatre réponses, des intitulés qui se ressemblent, quelques vrai ou faux.
  const film = (i: number) => question(`film${i}`, 2 + (i % 2), { texte: `Qui a réalisé le film « Titre ${i} » ?`, sousTheme: 'realisateurs', categorie: 'Cinéma' })
  const autre = (i: number) => question(`autre${i}`, 2 + (i % 2), { sousTheme: `st${i % 4}`, categorie: 'Cinéma' })
  const vraiFaux = (i: number) => question(`vf${i}`, 2, { texte: `Vrai ou faux numéro ${i} : est-ce bien ça ?`, reponses: ['Vrai', 'Faux'], categorie: 'Cinéma' })
  const tas = [[...Array.from({ length: 6 }, (_, i) => film(i)), ...Array.from({ length: 12 }, (_, i) => autre(i)), ...Array.from({ length: 6 }, (_, i) => vraiFaux(i))]]
  for (let essai = 0; essai < 50; essai++) {
    const tirees = tirerPourUneEscale(tas, 'moyen', 5, { sansVraiFaux: true, vues: new Map(), mesure: new Map(), maintenant: MAINTENANT, fenetreMs: SEPT_JOURS_MS, aussi: ['facile'] })
    assert.equal(tirees.length, 5)
    assert.equal(new Set(tirees.map(t => t.question.id)).size, 5, 'cinq questions distinctes')
    assert.ok(
      tirees.every(t => t.question.reponses.length === 4 && t.question.meta.categorie === 'Cinéma'),
      'cinq QCM de la catégorie',
    )
    assert.ok(
      tirees.every(t => t.niveau === 'facile' || t.niveau === 'moyen'),
      'faciles ou moyennes',
    )
    for (const [i, a] of tirees.entries()) for (const b of tirees.slice(i + 1)) assert.ok(!jumelles(a.question, b.question), `${a.question.id} et ${b.question.id}, jumelles`)
  }
})

// ── La moins vue ────────────────────────────────────────────────────────────

test('la moins vue : une jamais vue au hasard, puis la plus anciennement vue — rien de ces sept jours tant qu’il reste autre chose', () => {
  const vues = new Map([['vu-il-y-a-dix-jours', MAINTENANT - 10 * JOUR_MS]])
  const sorties = new Set<string>()
  for (let essai = 0; essai < 200; essai++) sorties.add(laMoinsVue(['jamais-a', 'jamais-b', 'vu-il-y-a-dix-jours'], id => id, vues)!)
  assert.deepEqual([...sorties].sort(), ['jamais-a', 'jamais-b'])
  // Sans fenêtre à lui passer : sur mille contenus au hasard, ce qui sort n'a été vu ces sept jours que si tout l'a été.
  const hasard = inventeur(23)
  for (let essai = 0; essai < 1000; essai++) {
    const candidats = Array.from({ length: 1 + Math.floor(hasard() * 10) }, (_, i) => `lieu-${i}`)
    const vuesDuJeu = new Map(candidats.map(id => [`cab:lieu:${id}`, MAINTENANT - Math.floor(hasard() * 20 * JOUR_MS)]))
    const sortie = laMoinsVue(candidats, id => `cab:lieu:${id}`, vuesDuJeu)!
    const recente = (id: string) => MAINTENANT - vuesDuJeu.get(`cab:lieu:${id}`)! < SEPT_JOURS_MS
    if (recente(sortie)) assert.ok(candidats.every(recente), `essai ${essai} : ${sortie} vue ces sept jours, alors qu’une autre ne l’était pas`)
    assert.equal(vuesDuJeu.get(`cab:lieu:${sortie}`), Math.min(...vuesDuJeu.values()), 'la plus anciennement vue')
  }
  assert.equal(laMoinsVue([], id => id, vues), undefined)
})

// ── Sept événements à une frise ─────────────────────────────────────────────

/** Des événements d'essai, chacun d'une année ; l'identifiant dit l'année. */
const evenements = (annees: readonly number[]): EvenementDeLaFrise[] => annees.map((annee, i) => ({ id: `e${i}-${annee}`, evenement: `L'événement numéro ${i}`, annee, categorie: 'Histoire' }))

test('choisirLaFrise(…, 7) : sept événements à trois ans d’écart au moins, dans l’ordre du temps, jamais vus d’abord', () => {
  const hasard = inventeur(31)
  for (let essai = 0; essai < 300; essai++) {
    // Sept à dix grappes d'années, à dix ans au moins l'une de l'autre, d'un à quatre événements serrés chacune : sept à trois
    // ans d'écart se trouvent toujours — un événement retenu n'écarte que ceux de sa grappe —, et rien n'oblige à moins.
    const grappes = Array.from({ length: 7 + Math.floor(hasard() * 4) }, (_, i) => 1600 + 40 * i + Math.floor(hasard() * 20))
    const candidats = evenements(grappes.flatMap(centre => Array.from({ length: 1 + Math.floor(hasard() * 4) }, () => centre + Math.floor(hasard() * 5) - 2)))
    const frise = choisirLaFrise(candidats, 3, hasard, undefined, 7)
    assert.ok(frise, `essai ${essai} : une frise`)
    assert.equal(frise.length, 7)
    assert.equal(new Set(frise.map(e => e.id)).size, 7)
    for (let i = 1; i < frise.length; i++) assert.ok(frise[i].annee - frise[i - 1].annee >= 3, `essai ${essai} : ${frise.map(e => e.annee).join(', ')}`)
  }
  // Sept jamais vus, bien écartés, parmi des vus : ce sont eux.
  const jamais = evenements([1800, 1810, 1820, 1830, 1840, 1850, 1860])
  const vus = evenements([1801, 1812, 1823, 1834, 1845, 1856, 1867, 1878]).map(e => ({ ...e, id: `vu-${e.id}` }))
  for (let essai = 0; essai < 50; essai++) {
    assert.deepEqual(
      choisirLaFrise([...vus, ...jamais], 3, hasard, id => id.startsWith('vu-'), 7)!.map(e => e.id),
      jamais.map(e => e.id),
    )
  }
  // Six années différentes ne font pas sept événements : pas de frise, même à un an d'écart.
  assert.equal(choisirLaFrise(evenements([1900, 1900, 1910, 1920, 1930, 1940, 1950, 1950]), 3, hasard, undefined, 7), null)
})

test('choisirLaFrise d’office : quatre événements, au même hasard qu’avant — la frise de l’Expédition ne change pas', () => {
  const hasard = inventeur(41)
  for (let essai = 0; essai < 300; essai++) {
    const candidats = evenements(Array.from({ length: Math.floor(hasard() * 25) }, () => 1500 + Math.floor(hasard() * 500)))
    const vus = new Set(candidats.filter(() => hasard() < 0.4).map(e => e.id))
    const ecart = [30, 10, 3, 1][essai % 4]
    const graine = 100 + essai
    assert.deepEqual(choisirLaFrise(candidats, ecart, inventeur(graine), id => vus.has(id)), friseDAvant(candidats, ecart, inventeur(graine), id => vus.has(id)), `essai ${essai}`)
  }
})

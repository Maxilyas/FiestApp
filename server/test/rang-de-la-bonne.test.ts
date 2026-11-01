// Le rang de la bonne réponse parmi des réponses qui se rangent — des années,
// des nombres, des jours de l'année — se tire au tirage, et ses leurres avec
// (`core/rangDeLaBonne.ts`).
//
// Le 1er novembre 2026, un joueur : « les réponses des dates étaient toujours
// ou presque dans le milieu ». Mesuré sur la base ce jour-là : rangées dans
// l'ordre, la bonne était la deuxième ou la troisième des quatre 97 fois sur
// cent pour les années, 91 pour les autres nombres, 84 pour les jours — en
// soirée, où le quiz tout prêt les montre rangées (`ordreDesReponses`), elle
// était sous ◆ ou ● ; ailleurs, écarter les deux extrêmes suffisait. Prendre,
// des deux du milieu, la plus proche de la moyenne trouvait 64 % des années
// sans rien savoir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { BaseDeLaCampagne, lireLaBase, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { POIDS_DES_RANGS, rangsPossibles, reponsesAuRangTire, seRange, valeurRangee } from '../src/core/rangDeLaBonne'
import { consigneDEcriture } from '../src/core/consigneCampagne'
import { versQuestionDeSerie } from '../src/core/tirageALaPiece'
import { composerUnQuiz, dejaDansLEspace, idDansLeQuiz, souffleeParLEpoque } from '../src/core/quizToutPret'
import { sujetsDeLaQuestion } from '../src/core/campagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import type { ChoixDuQuiz } from '../../shared/quizToutPret'
import { sujetParCle } from '../../shared/sujets'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'

/** La base livrée, lue une fois pour tout le fichier : le juge en prend une seconde. */
let lue: ReturnType<typeof lireLaBase> | null = null
const laBase = () => (lue ??= lireLaBase())

/** Un hasard qui recommence de sa graine : deux tirages le lisent pareil. */
function graine(g: number) {
  return () => ((g = (g * 16807) % 2147483647) - 1) / 2147483646
}

/** `f` sous un `Math.random` qui recommence de sa graine : `versQuestionDeSerie` tire comme une partie. */
function sousLeHasard<T>(g: number, f: () => T): T {
  const avant = Math.random
  Math.random = graine(g)
  try {
    return f()
  } finally {
    Math.random = avant
  }
}

/** Le rang d'une réponse parmi celles qu'on pose, rangées de la plus petite à la plus grande. */
function rangDe(reponses: readonly string[], bonne: number): number {
  const valeurs = reponses.map(r => valeurRangee(r)!.valeur)
  return [...valeurs].sort((a, b) => a - b).indexOf(valeurs[bonne])
}

/** Ce que joue qui ne sait rien : des deux réponses du milieu, la plus proche de la moyenne des quatre. */
function auJuge(reponses: readonly string[]): number {
  const valeurs = reponses.map(r => valeurRangee(r)!.valeur)
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length
  const triees = [...valeurs].sort((a, b) => a - b)
  const choisie = Math.abs(triees[1] - moyenne) <= Math.abs(triees[2] - moyenne) ? triees[1] : triees[2]
  return valeurs.indexOf(choisie)
}

/** Une question d'années écrite comme la base les écrit : la bonne entourée de ses leurres, de part et d'autre. */
function enAnnees(id: string, bonne: number, { ecarts = [-20, -10, 10], leurres = [-30, 20, 30], difficulte = 2 } = {}): QuestionDeLaBase {
  const annee = (d: number) => String(bonne + d)
  const lu = lireQuestionDeLaBase({
    id,
    texte: `En quelle année le fait d'essai ${id} a-t-il eu lieu ?`,
    reponses: [String(bonne), ...ecarts.map(annee)],
    bonne: 0,
    anecdote: `L'anecdote de ${id}.`,
    categorie: 'Histoire',
    sousTheme: SOUS_THEMES.Histoire[0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: { valeur: String(bonne), precision: 'annee' },
    entites: [],
    portee: 'monde',
    valeur: { nombre: bonne, unite: '' },
    leurres: [...ecarts, ...leurres].map(annee),
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`${id} : ${lu.refus}`)
  return lu.question
}

test('une réponse se range à sa forme : années, nombres et leur unité, jours de l’année, décennies, avant notre ère', () => {
  assert.deepEqual(valeurRangee('1830'), { valeur: 1830, forme: '|' })
  assert.deepEqual(valeurRangee('8 848 m'), { valeur: 8848, forme: '|m' })
  assert.deepEqual(valeurRangee('42,195 km'), { valeur: 42.195, forme: '|km' })
  assert.deepEqual(valeurRangee('−40 °C'), { valeur: -40, forme: '|°c' })
  assert.equal(valeurRangee('52 av. J.-C.')!.valeur, -52)
  assert.ok(valeurRangee('52 av. J.-C.')!.valeur < valeurRangee('44 av. J.-C.')!.valeur, 'César vient après Alésia')
  assert.deepEqual(valeurRangee('Les années 1960'), { valeur: 1960, forme: 'les années|' })
  // Un jour se range au calendrier, pas au numéro de son jour ; le 1er aussi.
  const jour = (t: string) => valeurRangee(t)!
  assert.equal(jour('Le 30 octobre').forme, jour('Le 2 novembre').forme)
  assert.ok(jour('Le 30 octobre').valeur < jour('Le 2 novembre').valeur)
  assert.ok(jour('Le 1er mai').valeur < jour('Le 21 juin').valeur)
  assert.ok(jour('Le 14 juillet 1789').valeur < jour('Le 4 août 1789').valeur)
  assert.notEqual(jour('Le 14 juillet').forme, jour('14 juillet').forme, 'avec et sans article, deux formes')
  // Deux formes qui ne se comparent pas.
  assert.notEqual(valeurRangee('33 cl')!.forme, valeurRangee('1 litre')!.forme)
  assert.notEqual(valeurRangee('Peugeot 205')!.forme, valeurRangee('Renault 5')!.forme)
  assert.equal(valeurRangee('Victor Hugo'), null)
})

test('le rang de la bonne se tire, ses leurres pris parmi les siens, de part et d’autre : rien d’inventé', () => {
  const q = enAnnees('a0000001', 1830)
  assert.ok(seRange(q))
  const vus = [0, 0, 0, 0]
  const hasard = graine(7)
  const N = 8000
  for (let i = 0; i < N; i++) {
    const t = reponsesAuRangTire(q, hasard)!
    assert.equal(t.reponses[t.bonne], '1830', 'la bonne reste la bonne')
    assert.equal(new Set(t.reponses).size, 4)
    for (const [k, r] of t.reponses.entries()) if (k !== t.bonne) assert.ok(q.meta.leurres.includes(r), `${r} est un de ses leurres`)
    vus[rangDe(t.reponses, t.bonne)]++
  }
  // Trois leurres de chaque côté : chaque rang se tire, à son poids.
  const total = POIDS_DES_RANGS.reduce((s, p) => s + p, 0)
  for (const [k, n] of vus.entries()) assert.ok(Math.abs(n / N - POIDS_DES_RANGS[k] / total) < 0.02, `rang ${k} : ${n} sur ${N}`)

  // Sans leurre de plus que ses mauvaises réponses, rien ne bouge : son rang écrit, ses réponses écrites.
  const seule = enAnnees('a0000002', 1900, { leurres: [] })
  for (let i = 0; i < 50; i++) assert.deepEqual([...reponsesAuRangTire(seule, hasard)!.reponses].sort(), [...seule.reponses].sort())
  // Deux leurres de plus, tous au-dessus : elle ne peut pas être la plus grande, jamais la plus petite non plus sans trois au-dessus.
  const dessus = enAnnees('a0000003', 1900, { ecarts: [-20, -10, 10], leurres: [40, 50] })
  const rangs = new Set(Array.from({ length: 400 }, () => reponsesAuRangTire(dessus, hasard)!).map(t => rangDe(t.reponses, t.bonne)))
  assert.deepEqual([...rangs].sort(), [0, 1, 2])
})

test('ce qui ne se range pas se pose tel qu’il est écrit, sans rien tirer au hasard', () => {
  let tirages = 0
  const compte = () => {
    tirages++
    return 0.5
  }
  const avec = (reponses: string[], leurres = reponses.slice(1)) => ({ reponses, bonne: 0, meta: { leurres } })
  assert.equal(reponsesAuRangTire(avec(['Victor Hugo', 'Émile Zola', 'Balzac', 'Flaubert']), compte), null, 'des mots')
  assert.equal(reponsesAuRangTire(avec(['Vrai', 'Faux']), compte), null, 'un vrai ou faux')
  assert.equal(reponsesAuRangTire(avec(['33 cl', '50 cl', '75 cl', '1 litre']), compte), null, 'deux unités')
  assert.equal(reponsesAuRangTire(avec(['1 000', '1000', '2000', '3000']), compte), null, 'deux valeurs égales')
  assert.equal(reponsesAuRangTire(avec(['Peugeot 205', 'Renault 5', 'Fiat 500', 'Austin 7']), compte), null, 'des noms qui portent un nombre')
  assert.equal(tirages, 0)
  // Une question de la base qui ne se range pas garde le battage d'avant (`tirage-a-la-piece.test.ts`) : les mêmes réponses.
  const mots = enAnnees('a0000004', 1850)
  const motsAuLieu = { ...mots, reponses: ['Lyon', 'Paris', 'Lille', 'Nantes'], meta: { ...mots.meta, leurres: ['Paris', 'Lille', 'Nantes', 'Brest'] } }
  assert.deepEqual([...versQuestionDeSerie(motsAuLieu, 'facile').reponses].sort(), ['Lille', 'Lyon', 'Nantes', 'Paris'])
})

test('les rangs qu’une question peut tirer, et la consigne qui demande des leurres de part et d’autre', () => {
  assert.deepEqual(rangsPossibles(enAnnees('b0000001', 1830)), [0, 1, 2, 3])
  assert.deepEqual(rangsPossibles(enAnnees('b0000002', 1830, { leurres: [40, 50] })), [0, 1, 2], 'deux au-dessous : jamais la plus grande')
  assert.deepEqual(rangsPossibles(enAnnees('b0000003', 1830, { ecarts: [10, 20, 30], leurres: [40, 50, 60] })), [0], 'tous au-dessus : toujours la plus petite')
  assert.equal(rangsPossibles({ reponses: ['Lyon', 'Paris', 'Lille', 'Nantes'], bonne: 0, meta: { leurres: ['Paris', 'Lille', 'Nantes'] } }), null)
  // La consigne des rédacteurs, de la routine et des générations en nombre : une seule.
  const consigne = consigneDEcriture('Histoire', [{ cle: SOUS_THEMES.Histoire[0].cle, n: 2, difficulte: 3 }], { sorte: 'routine' })
  assert.match(consigne, /ne cache pas la bonne au milieu/)
  assert.match(consigne, /trois plus petits et trois plus grands au moins/)
})

test('sur la base livrée, la bonne réponse qui se range ne se devine plus à son rang, ni à la moyenne', () => {
  const { questions } = laBase()
  const rangees = questions.filter(seRange)
  assert.ok(rangees.length >= 2000, `${rangees.length} questions qui se rangent`)
  const annees = rangees.filter(q => /^(1\d{3}|20\d{2})$/.test(q.reponses[q.bonne]))
  assert.ok(annees.length >= 600, `${annees.length} questions d'années`)
  // Telles qu'une partie les pose (`versQuestionDeSerie`), dix fois chacune.
  const mesurer = (qs: readonly QuestionDeLaBase[], g: number) =>
    sousLeHasard(g, () => {
      const rangs = [0, 0, 0, 0]
      let devinees = 0
      let n = 0
      for (const q of qs) {
        for (let i = 0; i < 10; i++) {
          const posee = versQuestionDeSerie(q, 'moyen')
          assert.equal(posee.reponses[posee.bonne], q.reponses[q.bonne])
          rangs[rangDe(posee.reponses, posee.bonne)]++
          if (auJuge(posee.reponses) === posee.bonne) devinees++
          n++
        }
      }
      return { rangs: rangs.map(r => r / n), devinees: devinees / n }
    })
  for (const [nom, qs] of [
    ['toutes', rangees],
    ['les années', annees],
  ] as const) {
    const { rangs, devinees } = mesurer(qs, nom.length)
    for (const [k, part] of rangs.entries()) assert.ok(part > 0.21 && part < 0.29, `${nom}, rang ${k} : ${Math.round(part * 100)} %`)
    // 64 % des années, avant ; le hasard en trouverait 25.
    assert.ok(devinees < 0.33, `${nom} : la plus proche de la moyenne trouve ${Math.round(devinees * 100)} %`)
  }
})

test('le quiz tout prêt tire les siennes aussi — sans laisser la bonne seule dans l’époque de son titre', () => {
  const { questions } = laBase()
  const parId = new Map(questions.map(q => [idDansLeQuiz(q.id), q]))
  const deja = dejaDansLEspace([], new Map())
  for (const sujet of ['annees-80', 'xixe', 'lumieres']) {
    const epoque = sujetParCle(sujet)!.annees!
    const choix: ChoixDuQuiz = { categories: [], sujet, difficulte: 'progressive', nombre: 30, estimations: false, enfants: false }
    let changees = 0
    for (let g = 1; g <= 8; g++) {
      for (const q of composerUnQuiz(questions, sujetsDeLaQuestion, new Map(), choix, deja, graine(g))) {
        const source = parId.get(q.id!)!
        assert.equal(q.answers[q.correct], source.reponses[source.bonne], 'la bonne reste la bonne')
        for (const [k, r] of q.answers.entries()) if (k !== q.correct) assert.ok(source.meta.leurres.includes(r), `${r} est un leurre de ${source.id}`)
        // « Les années 80 » en tête de chaque question, et 1988 seule des années 80 : le titre la soufflait.
        assert.ok(!souffleeParLEpoque({ reponses: q.answers, bonne: q.correct }, epoque), `${source.id} : la bonne seule dans l'époque du titre`)
        if ([...q.answers].sort().join() !== [...source.reponses].sort().join()) changees++
      }
    }
    assert.ok(changees > 0, `${sujet} : des leurres tirés`)
  }
})

/** Les questions d'une série telles que la base permanente les garde. */
function questionsDe(banc: Banc, serie: string): { id: string; reponses: string[]; bonne: number }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

test('en série, les leurres tirés viennent de la question, et la signaler ne la dit pas d’une version d’avant', async () => {
  const base = Array.from({ length: 16 }, (_, i) => enAnnees(`an${String(i).padStart(6, '0')}`, 1700 + i * 13, { difficulte: 1 + (i % 5) }))
  const banc = await demarrer({ baseDeLaCampagne: new BaseDeLaCampagne(base) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const admin = await connexionAnimateur(banc.url)
    const serie = (await (await ecrire(banc.url, '/api/campagne/serie', {}, lea)).json()) as { id: string }
    const posees = questionsDe(banc, serie.id)
    assert.equal(posees.length, 16)
    const parId = new Map(base.map(q => [q.id, q]))
    for (const p of posees) {
      const q = parId.get(p.id)!
      assert.equal(p.reponses[p.bonne], q.reponses[q.bonne])
      for (const [k, r] of p.reponses.entries()) if (k !== p.bonne) assert.ok(q.meta.leurres.includes(r))
    }
    // Celle qu'il signale a d'autres leurres que ceux de la base : la même version quand même.
    const position = posees.findIndex(p => [...p.reponses].sort().join() !== [...parId.get(p.id)!.reponses].sort().join())
    assert.ok(position >= 0, 'au moins une question a tiré d’autres leurres')
    for (let i = 0; i <= position; i++) {
      const r = await ecrire(banc.url, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: posees[i].bonne }, lea)
      assert.equal(r.status, 200)
    }
    const signale = await ecrire(banc.url, `/api/campagne/serie/${serie.id}/signalement`, { index: position, texte: 'Deux années possibles' }, lea)
    assert.equal(signale.status, 200)
    const etat = (await (await fetch(`${banc.url}/api/admin/campagne`, { headers: { Cookie: admin } })).json()) as { signalements: { questionId: string; rapports: { versionDAvant?: true }[] }[] }
    const s = etat.signalements.find(x => x.questionId === posees[position].id)!
    assert.equal(s.rapports[0].versionDAvant, undefined, 'la version de la base, ses leurres tirés')
  } finally {
    await banc.close()
  }
})

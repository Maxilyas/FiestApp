// Le Filet en deux temps, par sa règle pure (`shared/cabinet/jeux/filetEnDeuxTemps.ts`) — le nouveau Filet du cahier
// des charges (`retours/2026-11-09/le-nouveau-filet.md`, § 3 et § 6). Ce qu'il en exige : quatre époques aux bornes
// rondes qui ne passent jamais dans l'avenir, des ordres de grandeur où une réponse pile sur une borne est des deux
// tranches, une piste régulière où chaque « + » change la valeur jusqu'au bout, la distance qui juge d'abord — de
// part et d'autre d'une borne, l'écart d'une grandeur lu au dixième —, deux aides qui retirent chacune une étoile sans
// jamais coûter le cœur, Éclairer qui en offre une, des repères tirés sans regarder où est la réponse, la place de la
// réponse tirée avec des poids, et rien au téléphone qui dise où elle est avant le verdict (invariant 1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as B from '../../shared/cabinet/bareme'
import { hasardDe } from '../../shared/missions'
import { lireLeDepart, lireUnGeste } from '../../shared/cabinet/lecture'
import { chronoDuDepart, etoilesDesManches, pliDeLaPartie, type CarteDuDepart, type DepartDUnePartie } from '../../shared/cabinet/partie'
import { JOKER_D_ECLAIRER } from '../../shared/cabinet/pieces'
import { regleDe } from '../../shared/cabinet/jeux/index'
import { estEnDeuxTemps } from '../../shared/cabinet/jeux/filets'
import { eclairerSertEncore, rienAEclairer, type QuestionTiree } from '../../shared/cabinet/jeux/outils'
import { trancheLaManche, type VerdictDUneManche } from '../../shared/cabinet/jeux/regle'
import { MIDI, Partie, S, carte, departDe, ouvrir, tirageDe } from './cabinet-plans'
import {
  AIDES_DU_FILET,
  AIDE_DEJA_PRISE,
  CHOISIS_TON_AIDE,
  REGLE_DU_FILET_EN_DEUX_TEMPS as R,
  SANS_INDICE,
  borneDeGrandeur,
  cransDe,
  ecartEnPourCent,
  etoilesDuLancer,
  lancerDeLaComposee,
  largeurDesEpoques,
  milieuDeLaTranche,
  placesPossibles,
  poidsDesPlaces,
  reperesDuFilet,
  seTendEnDeuxTemps,
  tirageEnDeuxTemps,
  tirerLaPlace,
  tranchesDuFilet,
  valeurAuCran,
  type EtatDuFiletEnDeuxTemps,
  type FiletEnDeuxTempsTire,
  type RepereDuFilet,
} from '../../shared/cabinet/jeux/filetEnDeuxTemps'

/** L'année du départ : le tireur la lit au jour de Paris du départ, jamais à l'horloge. */
const DEPART = 2026

const question = (o: Partial<QuestionTiree> = {}): QuestionTiree => ({
  id: 'q1',
  texte: 'En quelle année l’Algérie devient-elle indépendante ?',
  reponses: ['1962', '1958', '1954', '1968'],
  bonne: 0,
  categorie: 'Histoire',
  anecdote: 'Les accords d’Évian sont signés en mars 1962.',
  niveau: 'facile',
  ...o,
})

/** Un tirage d'essai, au hasard du tireur rejoué : à cette place, avec ces repères et cet indice. */
function tirage(valeur: number, annee: boolean, place: number, o: { indice?: string | null; reperes?: RepereDuFilet[]; unite?: string; question?: Partial<QuestionTiree> } = {}): FiletEnDeuxTempsTire {
  const t = tirageEnDeuxTemps(
    {
      question: question({ reponses: [String(valeur), '1', '2', '3'], ...o.question }),
      valeur,
      annee,
      ...(o.unite !== undefined && { unite: o.unite }),
      place,
      anneeDuDepart: DEPART,
      reperes: o.reperes ?? [],
      indice: o.indice === undefined ? 'Quand le général de Gaulle revient au pouvoir' : o.indice,
    },
    hasardDe(`tirage:${valeur}:${place}`),
  )
  assert.ok(t, `${valeur} à la place ${place} : pas de tirage`)
  return t
}

/** Un geste joué comme le pli le jouera : lu, puis `trancheLaManche` dit s'il va à `juger` ou à `apresLeGeste`. */
function jouer(t: FiletEnDeuxTempsTire, e: EtatDuFiletEnDeuxTemps, brut: unknown): { etat: EtatDuFiletEnDeuxTemps } | { verdict: VerdictDUneManche } | { refus: string } {
  const g = R.lireLeGeste(brut, t)
  assert.ok(g !== null, `illisible : ${JSON.stringify(brut)}`)
  if (trancheLaManche(R, t, e, g)) return { verdict: R.juger(t, e, g) }
  const apres = R.apresLeGeste(t, e, g)
  return typeof apres === 'string' ? { refus: apres } : { etat: apres }
}
const etatDe = (x: ReturnType<typeof jouer>): EtatDuFiletEnDeuxTemps => {
  assert.ok('etat' in x, `un état attendu : ${JSON.stringify(x)}`)
  return x.etat
}
const verdictDe = (x: ReturnType<typeof jouer>): VerdictDUneManche => {
  assert.ok('verdict' in x, `un verdict attendu : ${JSON.stringify(x)}`)
  return x.verdict
}
const lancer = (epoque: number, x: number) => ({ quoi: 'repondre', manche: 0, reponse: { filet: { epoque, x } } })
const aide = (cle: string) => ({ quoi: 'aide', manche: 0, aide: cle })

// ── Les époques et les ordres de grandeur ───────────────────────────────

test('le Filet en deux temps : quatre époques aux bornes rondes, qui ne passent jamais dans l’avenir', () => {
  // On date plus grossièrement ce qui est loin : 25 ans depuis 1800, 50 de 1500 à 1799, un siècle avant.
  assert.deepEqual([largeurDesEpoques(1962), largeurDesEpoques(1800), largeurDesEpoques(1799), largeurDesEpoques(1500), largeurDesEpoques(1499), largeurDesEpoques(1001)], [25, 25, 50, 50, 100, 100])
  // Une réponse de 2000 à 2024 ne peut être que dans la quatrième, de 1975 à 1999 que dans les deux dernières, de 1950
  // à 1974 dans les trois dernières ; avant, partout. La dernière époque finit au plus l'année du départ.
  assert.deepEqual(placesPossibles(2001, true, DEPART), [3])
  assert.deepEqual(placesPossibles(1990, true, DEPART), [2, 3])
  assert.deepEqual(placesPossibles(1962, true, DEPART), [1, 2, 3])
  assert.deepEqual(placesPossibles(1930, true, DEPART), [0, 1, 2, 3])
  assert.deepEqual(placesPossibles(1650, true, DEPART), [0, 1, 2, 3])
  assert.deepEqual(placesPossibles(2025, true, DEPART), [], '2025–2049 passe dans l’avenir')
  for (const valeur of [1801, 1849, 1900, 1949, 1962, 1974, 1975, 1999, 2000, 2001, 1650, 1799, 1500, 1066, 1492]) {
    for (const place of placesPossibles(valeur, true, DEPART)) {
      const c = tranchesDuFilet(valeur, true, place, DEPART)!
      const largeur = largeurDesEpoques(valeur)
      assert.equal(c.tranches.length, B.TRANCHES_DU_FILET)
      c.tranches.forEach((x, k) => {
        assert.equal(x.de % largeur, 0, `${valeur} : ${x.de}, une borne ronde`)
        assert.equal(x.a, x.de + largeur - 1, `${valeur} : ${x.de}–${x.a}`)
        assert.equal(x.pas, 1, 'une année se vise an par an')
        if (k > 0) assert.equal(x.de, c.tranches[k - 1].a + 1, 'consécutives')
      })
      assert.deepEqual(c.bonnes, [place])
      assert.ok(valeur >= c.tranches[place].de && valeur <= c.tranches[place].a, `${valeur} dans sa tranche`)
      assert.ok(c.tranches[3].a <= DEPART, `${valeur} : la frise finit en ${c.tranches[3].a}`)
    }
  }
  assert.equal(tranchesDuFilet(2001, true, 2, DEPART), null, 'pas à une place que l’avenir interdit')
  // Les anneaux suivent l'époque : ★★★ à un douzième de sa largeur, ★★ à un quart.
  assert.deepEqual(tranchesDuFilet(1962, true, 1, DEPART)!.anneaux, { trois: 2, deux: 6 })
  assert.deepEqual(tranchesDuFilet(1650, true, 0, DEPART)!.anneaux, { trois: 4, deux: 12 })
  assert.deepEqual(tranchesDuFilet(1200, true, 0, DEPART)!.anneaux, { trois: 8, deux: 25 })
  assert.deepEqual(
    tranchesDuFilet(1962, true, 1, DEPART)!.tranches.map(x => `${x.de}–${x.a}`),
    ['1925–1949', '1950–1974', '1975–1999', '2000–2024'],
  )
})

test('le Filet en deux temps : des ordres de grandeur bornés par 1, 3, 10, 30… — une réponse pile sur une borne est des deux tranches', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(borneDeGrandeur), [1, 3, 10, 30, 100, 300, 1000, 3000, 10000])
  const c = tranchesDuFilet(2500, false, 2, DEPART)!
  assert.deepEqual(c.tranches.map(x => `${x.de}–${x.a}`), ['100–300', '300–1000', '1000–3000', '3000–10000'])
  assert.deepEqual(c.bonnes, [2])
  assert.deepEqual(c.anneaux, { trois: 6, deux: 25 })
  // 10 000 m² se range de 3 000 à 10 000 comme de 10 000 à 30 000 (« dans quelle case ? », Huguette).
  assert.deepEqual(tranchesDuFilet(10000, false, 2, DEPART)!.bonnes, [1, 2])
  assert.deepEqual(tranchesDuFilet(10000, false, 0, DEPART)!.bonnes, [0], 'à la première place, la tranche d’en dessous n’est pas sur la frise')
  // Une tranche ne descend pas sous un : 12,5 commence de 10 à 30, et ne se place pas dernière.
  assert.deepEqual(placesPossibles(12.5, false, DEPART), [0, 1, 2])
  assert.deepEqual(placesPossibles(0.5, false, DEPART), [])
  assert.deepEqual(placesPossibles(45_000, false, DEPART), [0, 1, 2, 3])
})

test('le Filet en deux temps : la piste d’une tranche est régulière, en crans ronds, et chaque « + » change la valeur jusqu’au bout', () => {
  const rond = (x: number) => [1, 2, 5].some(r => Math.abs(x / (r * 10 ** Math.floor(Math.log10(x / r) + 1e-9)) - 1) < 1e-9)
  const essais: [number, boolean][] = [
    [1962, true],
    [1650, true],
    [1200, true],
    [12.5, false],
    [16, false],
    [37.2, false],
    [250, false],
    [2500, false],
    [10000, false],
    [8848, false],
    [1_500_000, false],
    [67_000_000, false],
  ]
  for (const [valeur, annee] of essais) {
    for (const place of placesPossibles(valeur, annee, DEPART)) {
      for (const t of tranchesDuFilet(valeur, annee, place, DEPART)!.tranches) {
        const n = cransDe(t)
        assert.ok(n >= 1 && n <= B.CRANS_D_UNE_TRANCHE, `${valeur} : ${t.de}–${t.a} en ${n} crans`)
        assert.ok(rond(t.pas), `${valeur} : un cran rond, pas ${t.pas}`)
        assert.ok(t.pas >= (Number.isInteger(valeur) ? 1 : 0.1), `${valeur} : un cran de ${t.pas}`)
        assert.equal(valeurAuCran(t, 0), t.de)
        assert.equal(valeurAuCran(t, n), t.a)
        // La maquette en a joué 18 manches au navigateur : « + » restait coincé à 1380 et à 62, deux crans écrivaient le même nombre.
        for (let i = 1; i <= n; i++) assert.ok(valeurAuCran(t, i) > valeurAuCran(t, i - 1), `${valeur} : le cran ${i} de ${t.de}–${t.a} ne bouge pas`)
        const milieu = milieuDeLaTranche(t)
        assert.ok(milieu >= t.de && milieu <= t.a)
        assert.ok(Math.abs(milieu - (t.de + t.a) / 2) <= t.pas, `${valeur} : le milieu de ${t.de}–${t.a} est ${milieu}`)
      }
    }
  }
  // Le curseur se pose au milieu de l'époque, et le filet dit d'emblée ce qu'il couvre : 1962 ± 2 et ± 6.
  assert.equal(milieuDeLaTranche({ de: 1950, a: 1974, pas: 1 }), 1962)
  assert.deepEqual(tranchesDuFilet(2500, false, 2, DEPART)!.tranches.map(x => x.pas), [1, 5, 10, 50])
})

test('le Filet en deux temps : une année avec 25 ans de recul, une grandeur dès dix', () => {
  assert.equal(B.RECUL_DES_ANNEES_DU_FILET, 25)
  assert.ok(seTendEnDeuxTemps(2001, true, DEPART), '2001, l’iPod : 25 ans de recul')
  assert.ok(!seTendEnDeuxTemps(2002, true, DEPART))
  assert.ok(seTendEnDeuxTemps(1981, true, DEPART), '1981 : le Filet d’avant l’écartait, à 46 ans de recul')
  assert.ok(seTendEnDeuxTemps(1001, true, DEPART) && !seTendEnDeuxTemps(1000, true, DEPART) && !seTendEnDeuxTemps(1962.5, true, DEPART))
  assert.ok(seTendEnDeuxTemps(10, false, DEPART) && seTendEnDeuxTemps(12.5, false, DEPART) && !seTendEnDeuxTemps(9.9, false, DEPART) && !seTendEnDeuxTemps(Number.NaN, false, DEPART))
  assert.equal(tirageEnDeuxTemps({ question: question(), valeur: 2010, annee: true, place: 3, anneeDuDepart: DEPART, reperes: [], indice: null }, hasardDe('x')), null)
})

// ── Le jugement ─────────────────────────────────────────────────────────

test('le Filet en deux temps : la distance d’abord, de part et d’autre d’une borne ; sinon ★ pour la bonne époque', () => {
  // 1950, à la borne de 1925–1949 et 1950–1974 : posée de l'autre côté, la réponse garde ses étoiles de distance.
  const t = tirage(1950, true, 1)
  assert.deepEqual(t.tranches.map(x => x.de), [1925, 1950, 1975, 2000])
  const etoiles = (epoque: number, x: number) => etoilesDuLancer(t, { epoque, x })
  assert.equal(etoiles(0, 1948), 3, 'deux ans, la mauvaise époque : ★★★')
  assert.equal(etoiles(0, 1945), 2, 'cinq ans : ★★')
  assert.equal(etoiles(0, 1944), 2, 'six ans : ★★')
  assert.equal(etoiles(0, 1940), 0, 'dix ans, la mauvaise époque : rien')
  assert.equal(etoiles(1, 1974), 1, 'la bonne époque, loin : ★')
  assert.equal(etoiles(1, 1950), 3)
  assert.equal(etoilesDuLancer(t, null), 0)
  // Une grandeur : l'écart en pour cent de la réponse, au dixième, tel que l'écran l'écrit.
  assert.equal(ecartEnPourCent(17, 16), 6.3)
  assert.equal(ecartEnPourCent(15.04, 16), 6)
  assert.equal(ecartEnPourCent(190, 250), 24)
  const g = tirage(16, false, 0)
  assert.equal(etoilesDuLancer(g, { epoque: 0, x: 17 }), 2, '17 pour 16 : 6,3 %, pas ★★★')
  assert.equal(etoilesDuLancer(g, { epoque: 0, x: 15.04 }), 3)
  assert.equal(etoilesDuLancer(g, { epoque: 0, x: 20 }), 2, '25 % pile : ★★')
  assert.equal(etoilesDuLancer(g, { epoque: 0, x: 20.1 }), 1, 'au-delà, la bonne tranche : ★')
  assert.equal(etoilesDuLancer(g, { epoque: 1, x: 30.1 }), 0)
  // Le verdict : sa pièce est juste dès ★★ ; le lancer est gardé, et la révélation le relit.
  const v = verdictDe(jouer(t, R.ouvrir(t), lancer(0, 1948)))
  assert.deepEqual(v, { naturel: 3, pieces: [{ juste: true, choix: 0, composee: '1948|0' }] })
  const r = R.reveler(t, R.ouvrir(t), v)
  assert.equal(r.titre, 'Pile dedans')
  assert.deepEqual(r.criteres, { epoque: false, deux: true, trois: true }, 'la mauvaise époque, mais si près que la distance compte d’abord')
  assert.equal(r.ecart, 2)
  assert.deepEqual(r.lancer, { epoque: 0, x: 1948 })
  const loin = verdictDe(jouer(t, R.ouvrir(t), lancer(1, 1974)))
  assert.deepEqual(loin, { naturel: 1, pieces: [{ juste: false, choix: -1, composee: '1974|1' }] })
  assert.equal(R.reveler(t, R.ouvrir(t), loin).titre, 'La bonne époque')
  assert.equal(R.reveler(g, R.ouvrir(g), verdictDe(jouer(g, R.ouvrir(g), lancer(0, 25)))).titre, 'Le bon ordre de grandeur')
  assert.equal(R.reveler(t, R.ouvrir(t), verdictDe(jouer(t, R.ouvrir(t), lancer(0, 1930)))).titre, 'À côté')
})

test('le Filet en deux temps : la page ne lance que dans la piste de l’époque choisie', () => {
  const t = tirage(1962, true, 1)
  assert.equal(R.lireLeGeste(lancer(1, 1949), t), null, '1949 n’est pas dans 1950–1974')
  assert.equal(R.lireLeGeste(lancer(4, 1962), t), null)
  assert.equal(R.lireLeGeste(lancer(1.5, 1962), t), null)
  assert.equal(R.lireLeGeste({ quoi: 'repondre', reponse: { filet: { x: 1962, taille: 'moyen' } } }, t), null, 'un lancer du Filet d’avant')
  assert.equal(R.lireLeGeste({ quoi: 'repondre', reponse: { filet: { epoque: 1, x: Number.NaN } } }, t), null)
  assert.equal(R.lireLeGeste(aide('zone'), t), null)
  assert.equal(R.lireLeGeste({ quoi: 'reculer' }, t), null)
  assert.deepEqual(R.lireLeGeste(lancer(1, 1962), t), { quoi: 'repondre', lancer: { epoque: 1, x: 1962 } })
  // Le temps écoulé sans époque choisie : la page n'envoie rien, la manche ne vaut rien et n'a pas de réponse.
  assert.deepEqual(R.lireLeGeste({ quoi: 'repondre' }, t), { quoi: 'repondre', lancer: null })
  const expiree = R.juger(t, R.ouvrir(t), 'expiree')
  assert.deepEqual(expiree, { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] })
  assert.equal(R.reveler(t, R.ouvrir(t), expiree).titre, 'Le temps a filé')
  assert.deepEqual(R.juger(t, R.ouvrir(t), 'quittee'), { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] })
})

// ── Les aides ───────────────────────────────────────────────────────────

test('le Filet en deux temps : une aide payée retire une étoile, jamais le cœur ; offerte par Éclairer, rien', () => {
  const t = tirage(1962, true, 1)
  const e0 = R.ouvrir(t)
  // « Deux époques de moins » : deux mauvaises, tirées au départ ; l'aide ne tranche pas.
  const e1 = etatDe(jouer(t, e0, aide('epoques')))
  assert.deepEqual(e1.aides, [{ cle: 'epoques', offerte: false }])
  assert.equal(t.retirables.length, B.TRANCHES_RETIREES)
  assert.ok(t.retirables.every(i => !t.bonnes.includes(i)), 'jamais la bonne')
  assert.deepEqual(R.montrer(t, e1).retirees, [...t.retirables])
  // Une fois chacune par manche.
  assert.equal((jouer(t, e1, aide('epoques')) as { refus: string }).refus, AIDE_DEJA_PRISE)
  // ★★ moins une : ★, et la pièce reste juste — elle dit ce qu'il a su placer.
  const v1 = verdictDe(jouer(t, e1, lancer(1, 1957)))
  assert.deepEqual(v1, { naturel: 1, payees: 1, pieces: [{ juste: true, choix: 0, composee: '1957|1|e' }] })
  // Les deux : ★ moins deux — elles ne prennent que ce que le lancer valait. Réussie, la manche est à zéro, sans être
  // ratée : `payees` le dit à la traversée, qui garde le cœur.
  const e2 = etatDe(jouer(t, e1, aide('indice')))
  assert.equal(R.montrer(t, e2).indice, t.indice)
  const v2 = verdictDe(jouer(t, e2, lancer(1, 1974)))
  assert.deepEqual(v2, { naturel: 0, payees: 1, pieces: [{ juste: false, choix: -1, composee: '1974|1|ei' }] })
  const r2 = R.reveler(t, e2, v2)
  assert.deepEqual([r2.avantLesAides, r2.payees, r2.etoiles], [1, 1, 0])
  // Ratée — ni distance ni époque —, les aides ne prennent rien : la manche coûte son cœur comme toujours, jamais à cause d'elles.
  const rate = verdictDe(jouer(t, e2, lancer(3, 2010)))
  assert.deepEqual(rate, { naturel: 0, pieces: [{ juste: false, choix: -1, composee: '2010|3|ei' }] })
  // Offerte par Éclairer : choisie par son rang, sans étoile retirée ; le pli marque la pièce de son pouvoir.
  const offerte = R.eclairer(t, e0, () => 0, AIDES_DU_FILET.indexOf('indice'))
  assert.ok(typeof offerte !== 'string')
  assert.deepEqual(offerte.aides, [{ cle: 'indice', offerte: true }])
  assert.deepEqual(R.montrer(t, offerte).aides, [
    { cle: 'epoques', prise: null },
    { cle: 'indice', prise: 'offerte' },
  ])
  assert.deepEqual(verdictDe(jouer(t, offerte, lancer(1, 1962))), { naturel: 3, pieces: [{ juste: true, choix: 0, composee: '1962|1|I' }] })
  // Éclairer sans cible, ou sur une aide prise : en mots ; plus rien à offrir, le refus des pouvoirs — le pli y lit qu'il ne sert plus.
  assert.equal(R.eclairer(t, e0, () => 0), CHOISIS_TON_AIDE)
  assert.equal(R.eclairer(t, e0, () => 0, 2), CHOISIS_TON_AIDE)
  assert.equal(R.eclairer(t, e1, () => 0, 0), AIDE_DEJA_PRISE)
  assert.ok(eclairerSertEncore(R, t, e1))
  assert.equal(R.eclairer(t, e2, () => 0, 0), rienAEclairer('filet'))
  assert.ok(!eclairerSertEncore(R, t, e2))
  // Le temps écoulé après une aide : la manche ne vaut rien, et le journal garde l'aide.
  assert.deepEqual(R.juger(t, e1, 'expiree'), { naturel: 0, pieces: [{ juste: false, choix: null, composee: '.|.|e' }] })
})

test('le Filet en deux temps : sans indice honnête, la question ne propose que l’autre aide', () => {
  // Quand l'énoncé donne déjà l'époque — un sous-marin allemand coule un paquebot —, tout indice d'époque est la réponse.
  const t = tirage(1915, true, 2, { indice: null })
  assert.deepEqual(R.montrer(t, R.ouvrir(t)).aides, [{ cle: 'epoques', prise: null }])
  assert.equal((jouer(t, R.ouvrir(t), aide('indice')) as { refus: string }).refus, SANS_INDICE)
  assert.equal(R.eclairer(t, R.ouvrir(t), () => 0, 1), SANS_INDICE)
  const e = etatDe(jouer(t, R.ouvrir(t), aide('epoques')))
  assert.equal(R.eclairer(t, e, () => 0, 1), rienAEclairer('filet'), 'l’autre prise, plus rien à offrir')
})

test('le Filet en deux temps : la pièce garde le lancer et les aides, et la révélation les relit', () => {
  assert.deepEqual(lancerDeLaComposee('1962|2'), { x: 1962, epoque: 2 })
  assert.deepEqual(lancerDeLaComposee('12.5|0|Ie'), { x: 12.5, epoque: 0 })
  for (const c of [null, '', '.|.|e', '1962', '1962|moyen', '1962|7', 'x|1']) assert.equal(lancerDeLaComposee(c), null, String(c))
  const t = tirage(2500, false, 2, { unite: 'km' })
  const v = R.juger(t, R.ouvrir(t), { quoi: 'repondre', lancer: { epoque: 2, x: 2400 } })
  const r = R.reveler(t, R.ouvrir(t), v)
  assert.equal(r.ecart, 4)
  assert.equal(r.unite, 'km')
  assert.equal(r.reponse, '2500')
  assert.equal(r.savais, question().anecdote)
  assert.deepEqual(R.piece(t, R.ouvrir(t), v, { manche: 1, tirage: 1 }).cabinet, { jeu: 'filet', manche: 1, tirage: 1 })
  assert.equal(R.piece(t, R.ouvrir(t), v, { manche: 1, tirage: 1 }).forme, 'filet')
  assert.deepEqual(R.cartel(t, v), { sujet: t.question.texte, reponse: '2500', anecdote: question().anecdote })
})

// ── Ce que voit le téléphone ────────────────────────────────────────────

test('le Filet en deux temps : rien de ce qui dit où est la réponse ne part avant le verdict (invariant 1)', () => {
  const t = tirage(1962, true, 1, { reperes: [{ valeur: 1936, texte: 'Les congés payés' }] })
  const montre = R.montrer(t, R.ouvrir(t))
  const dit = JSON.stringify(montre)
  for (const champ of ['valeur', 'bonnes', 'retirables', 'question', 'reponse', 'savais']) assert.ok(!(champ in montre), champ)
  assert.ok(!dit.includes('1962'), 'la valeur')
  assert.ok(!dit.includes(t.question.anecdote!), 'l’anecdote')
  assert.ok(!dit.includes('Quand le général'), 'l’indice, avant d’être pris')
  assert.deepEqual(montre.retirees, [])
  assert.equal(montre.indice, null)
  // Les quatre époques partent, comme les bornes de la piste aujourd'hui ; les repères avec la manche.
  assert.deepEqual(montre.tranches, t.tranches)
  assert.deepEqual(montre.reperes, [{ valeur: 1936, texte: 'Les congés payés' }])
  // Une aide prise ne dit que ce qu'elle donne : deux époques retirées, ou l'indice.
  const apres = R.montrer(t, etatDe(jouer(t, R.ouvrir(t), aide('epoques'))))
  assert.ok(!JSON.stringify(apres).includes('1962'))
  assert.equal(apres.indice, null)
})

// ── Les repères ─────────────────────────────────────────────────────────

test('le Filet en deux temps : les repères — leur époque tirée d’abord, sans regarder la réponse ; un des siens au plus', () => {
  const q = { texte: 'En quelle année l’Algérie devient-elle indépendante ?', valeur: 1962, annee: true, tranches: tirage(1962, true, 1).tranches }
  const communs: RepereDuFilet[] = [
    { valeur: 1936, texte: 'Les congés payés' },
    { valeur: 1945, texte: 'La fin de la Seconde Guerre mondiale' },
    { valeur: 1958, texte: 'La Ve République' },
    { valeur: 1962, texte: 'Les accords d’Évian' },
    { valeur: 1954, texte: 'La guerre d’Algérie commence' },
    { valeur: 1969, texte: 'Le premier pas sur la Lune' },
    { valeur: 1981, texte: 'L’abolition de la peine de mort' },
    { valeur: 1989, texte: 'La chute du mur de Berlin' },
    { valeur: 2002, texte: 'L’euro dans les porte-monnaie' },
    { valeur: 2005, texte: 'Le premier clip sur YouTube' },
  ]
  const parTranche = [0, 0, 0, 0]
  const N = 4000
  for (let n = 0; n < N; n++) {
    const r = reperesDuFilet(q, { siens: [], communs }, hasardDe(`reperes:${n}`))
    assert.ok(r.length <= B.REPERES_DU_FILET)
    assert.ok(r.every(x => x.valeur !== 1962), 'jamais la réponse elle-même')
    assert.ok(r.every(x => x.valeur !== 1954), 'jamais du même sujet : « Algérie »')
    assert.deepEqual(
      r.map(x => x.valeur),
      [...r.map(x => x.valeur)].sort((a, b) => a - b),
      'rangés de gauche à droite',
    )
    const tranches = r.map(x => q.tranches.findIndex(t => x.valeur >= t.de && x.valeur <= t.a))
    assert.equal(new Set(tranches).size, tranches.length, 'un par époque')
    for (const i of tranches) parTranche[i]++
  }
  // Chaque époque la même chance, celle de la réponse comprise : choisis parmi ceux qui s'écartaient d'elle, ils
  // tombaient rarement dans sa case (0,34 par manche, contre 0,56 ailleurs, dans la maquette).
  for (const k of parTranche) assert.ok(Math.abs(k / N - 0.5) < 0.04, `${parTranche.map(k => (k / N).toFixed(2)).join(' · ')}`)
  // Les siens d'abord, un au plus, et jamais quand il donnerait la réponse : Brasília, 1960, ne vient pas pour 1960.
  const siens: RepereDuFilet[] = [
    { valeur: 1981, texte: 'L’abolition de la peine de mort' },
    { valeur: 1998, texte: 'La France championne du monde' },
    { valeur: 1962, texte: 'Les accords d’Évian' },
  ]
  for (let n = 0; n < 200; n++) {
    const r = reperesDuFilet(q, { siens, communs }, hasardDe(`siens:${n}`))
    assert.equal(r.filter(x => x.sien).length, 1, JSON.stringify(r))
    assert.ok(r.every(x => x.valeur !== 1962))
    assert.equal(r.length, 2)
  }
  // Une grandeur : jamais la réponse à 2 % près, et un repère pile sur une borne ne se tire qu'une fois.
  const g = { texte: 'Quelle est la hauteur du Sphinx de Gizeh ?', valeur: 20, annee: false, tranches: tirage(20, false, 0).tranches }
  for (let n = 0; n < 200; n++) {
    const r = reperesDuFilet(g, { siens: [], communs: [{ valeur: 20.2, texte: 'Un autobus à deux étages, couché' }, { valeur: 30, texte: 'Un immeuble de dix étages' }, { valeur: 324, texte: 'La tour Eiffel' }] }, hasardDe(`g:${n}`))
    assert.ok(r.every(x => x.valeur !== 20.2))
    assert.ok(r.filter(x => x.valeur === 30).length <= 1)
  }
})

// ── La place de la réponse ──────────────────────────────────────────────

test('le Filet en deux temps : la place de la réponse, tirée avec des poids, ne se devine plus', () => {
  // Des années comme celles d'un acte : un siècle et demi d'histoire, et des récentes que l'avenir force à droite.
  const annees: number[] = []
  for (let v = 1800; v <= 1999; v += 2) annees.push(v)
  annees.push(1981, 1989, 1990, 1997, 1998, 1999, 2000, 2001)
  const poids = poidsDesPlaces(annees, DEPART)
  const masse = [0, 0, 0, 0]
  for (const v of annees) {
    const places = placesPossibles(v, true, DEPART)
    for (const i of places) masse[i] += poids[places.length][i] / annees.length
  }
  // Un quart des réponses à chaque place : « toujours la dernière époque » ne gagne plus que 25 %.
  for (const m of masse) assert.ok(Math.abs(m - 0.25) < 0.005, masse.map(x => x.toFixed(3)).join(' · '))
  for (const [m, p] of Object.entries(poids)) assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9, `${m} places`)
  // Le tirage suit ses poids, du hasard du tireur.
  const compte = [0, 0, 0, 0]
  for (let n = 0; n < 4000; n++) compte[tirerLaPlace([1, 2, 3], hasardDe(`place:${n}`), poids)!]++
  for (const i of [1, 2, 3]) assert.ok(Math.abs(compte[i] / 4000 - poids[3][i]) < 0.03, `${i} : ${compte[i] / 4000} pour ${poids[3][i].toFixed(3)}`)
  assert.equal(compte[0], 0)
  // Sans poids, au hasard parmi celles qui restent — une grandeur ; sans place, rien.
  const auHasard = [0, 0, 0, 0]
  for (let n = 0; n < 4000; n++) auHasard[tirerLaPlace([0, 1, 2, 3], hasardDe(`g:${n}`))!]++
  for (const k of auHasard) assert.ok(Math.abs(k / 4000 - 0.25) < 0.03)
  assert.equal(tirerLaPlace([], hasardDe('x')), null)
  // Quand les réponses forcées dépassent le quart, aucun poids ne referme tout : la dernière garde plus.
  const recentes = [...Array(60).fill(2000), ...Array(40).fill(1900)] as number[]
  const p = poidsDesPlaces(recentes, DEPART)
  const derniere = recentes.reduce((s, v) => s + p[placesPossibles(v, true, DEPART).length][3], 0) / recentes.length
  assert.ok(derniere > 0.5, `${derniere}`)
})

test('le Filet en deux temps : le tirage fige ses tranches, ses époques à retirer et le prix d’une aide', () => {
  const a = tirage(1962, true, 2)
  const b = tirage(1962, true, 2)
  assert.deepEqual(a, b, 'le même hasard, le même tirage')
  assert.deepEqual(a.bonnes, [2])
  assert.equal(a.prixDUneAide, B.ETOILES_D_UNE_AIDE)
  assert.deepEqual([...a.retirables].sort((x, y) => x - y), a.retirables)
  // Pile sur une borne, une grandeur a deux bonnes tranches : l'aide retire les deux autres.
  assert.deepEqual(tirage(10000, false, 2).retirables, [0, 3])
  assert.equal(tirageEnDeuxTemps({ question: question(), valeur: 1962, annee: true, place: 0, anneeDuDepart: DEPART, reperes: [], indice: null }, hasardDe('x')), null, '1950–1974 n’est jamais la première')
})

// ── Le branchement ──────────────────────────────────────────────────────

/** Un départ d'épreuve du nouveau Filet, trois manches tirées comme le serveur les tirera, et une carte qui éclaire. */
function departEnDeuxTemps(cartes: CarteDuDepart[] = [carte('eclairer', 1)]): DepartDUnePartie {
  const tirages = [tirage(1962, true, 1), tirage(2500, false, 2, { unite: 'km' }), tirage(1789, true, 0)]
  return departDe('filet', { v: 3, origine: 'traversee', traversee: { id: 'tr-1', etape: 'a0r0c0', assaut: 0 }, cartes, carte: null, chrono: chronoDuDepart('filet', cartes), tirages })
}

test('le Filet en deux temps : le registre choisit la règle par la forme du tirage, et le Filet d’avant garde ses parties', () => {
  const r = regleDe('filet')
  const nouveau = tirage(1962, true, 1)
  const avant = tirageDe('filet', 0)
  assert.equal((r.montrer(nouveau, r.ouvrir(nouveau)) as { deuxTemps?: true }).deuxTemps, true)
  assert.deepEqual((r.montrer(avant, r.ouvrir(avant)) as { piste: unknown }).piste, { min: 1800, max: 1900, pas: 1 })
  // Un lancer de l'un ne se lit pas à l'autre.
  assert.equal(r.lireLeGeste({ quoi: 'repondre', reponse: { filet: { x: 1852, taille: 'moyen' } } }, nouveau), null)
  assert.equal(r.lireLeGeste({ quoi: 'repondre', reponse: { filet: { epoque: 1, x: 1962 } } }, avant), null)
  assert.equal(r.lireLeGeste({ quoi: 'aide', aide: 'epoques' }, avant), null, 'le Filet d’avant n’a pas d’aide')
  assert.ok(estEnDeuxTemps(nouveau) && !estEnDeuxTemps(avant as never))
})

test('le Filet en deux temps : une épreuve jouée au pli — une aide payée, une offerte par Éclairer, une manche laissée au chrono', () => {
  const d = departEnDeuxTemps()
  const p = new Partie(d)
  p.joue(ouvrir(0), MIDI)
  p.joue({ quoi: 'aide', manche: 0, aide: 'epoques' }, MIDI + 3 * S)
  assert.equal(p.refuse({ quoi: 'aide', manche: 0, aide: 'epoques' }, MIDI + 4 * S), AIDE_DEJA_PRISE)
  p.joue({ quoi: 'repondre', manche: 0, reponse: { filet: { epoque: 1, x: 1957 } } }, MIDI + 10 * S)
  // ★★ à la distance, moins l'aide payée : ★, la pièce juste, le cœur gardé — `payees` le dit à la traversée.
  assert.deepEqual(p.etat.pieces[0].composee, '1957|1|e')
  assert.equal(p.etat.pieces[0].juste, true)
  assert.equal(p.etat.pieces[0].joker, null)
  // Éclairer offre l'indice : la carte sert, la pièce porte son pouvoir, et rien n'est retiré.
  p.joue(ouvrir(1), MIDI + 20 * S)
  assert.equal(p.refuse({ quoi: 'eclairer', manche: 1 }, MIDI + 21 * S), CHOISIS_TON_AIDE)
  p.joue({ quoi: 'eclairer', manche: 1, affirmation: AIDES_DU_FILET.indexOf('indice') }, MIDI + 22 * S)
  p.joue({ quoi: 'repondre', manche: 1, reponse: { filet: { epoque: 2, x: 2400 } } }, MIDI + 30 * S)
  assert.equal(p.etat.pieces[1].composee, '2400|2|I')
  assert.equal(p.etat.pieces[1].joker, JOKER_D_ECLAIRER)
  // La troisième, ouverte puis laissée au chrono : rien, sans réponse.
  p.joue(ouvrir(2), MIDI + 40 * S)
  p.joue({ quoi: 'repondre', manche: 2, auto: true }, MIDI + 40 * S + d.chrono.etapesMs[0] + 1)
  assert.deepEqual(
    etoilesDesManches(d, p.etat).map(m => [m.naturel, m.payees]),
    [
      [1, 1],
      [3, 0],
      [0, 0],
    ],
  )
  assert.equal(p.etat.pieces[2].choix, null)
  assert.ok(p.etat.fin)
  // Le pli rejoué d'une traite redonne la même partie.
  assert.deepEqual(pliDeLaPartie(d, p.gestes), p.etat)
})

test('le Filet en deux temps : son départ et ses gestes se relisent à leur forme', () => {
  const d = departEnDeuxTemps()
  assert.deepEqual(lireLeDepart(JSON.stringify(d)), d)
  const casse = (f: (t: Record<string, unknown>) => void) => {
    const x = JSON.parse(JSON.stringify(d))
    f(x.tirages[0])
    return lireLeDepart(JSON.stringify(x))
  }
  assert.equal(
    casse(t => {
      t.bonnes = [0]
    }),
    null,
    'la réponse hors de sa tranche',
  )
  assert.equal(
    casse(t => {
      ;(t.tranches as { de: number }[])[1].de = 1940
    }),
    null,
    'deux tranches qui se chevauchent',
  )
  assert.equal(
    casse(t => {
      t.retirables = [1, 2]
    }),
    null,
    'une époque retirée qui serait la bonne',
  )
  assert.equal(
    casse(t => {
      t.prixDUneAide = -1
    }),
    null,
  )
  assert.equal(
    casse(t => {
      ;(t.tranches as { a: number }[])[3].a = 2030
    }),
    null,
    'une époque dans l’avenir',
  )
  assert.equal(
    casse(t => {
      t.reperes = [{ valeur: 1936 }]
    }),
    null,
    'un repère sans texte',
  )
  // Les gestes : l'aide, par sa clé ; le lancer, l'époque et le curseur — et celui d'avant se lit encore.
  assert.deepEqual(lireUnGeste({ quoi: 'aide', manche: 0, aide: 'indice' }), { quoi: 'aide', manche: 0, aide: 'indice' })
  assert.equal(lireUnGeste({ quoi: 'aide', manche: 0, aide: 'zone' }), null)
  assert.equal(lireUnGeste({ quoi: 'aide', manche: 0, aide: 'constructor' }), null)
  assert.deepEqual(lireUnGeste({ quoi: 'repondre', manche: 1, reponse: { filet: { epoque: 2, x: 2400 } } }), { quoi: 'repondre', manche: 1, reponse: { filet: { epoque: 2, x: 2400 } } })
  assert.deepEqual(lireUnGeste({ quoi: 'repondre', manche: 1, reponse: { filet: { x: 1852, taille: 'moyen' } } }), { quoi: 'repondre', manche: 1, reponse: { filet: { x: 1852, taille: 'moyen' } } })
  assert.equal(lireUnGeste({ quoi: 'repondre', manche: 1, reponse: { filet: { epoque: -1, x: 2400 } } }), null)
  assert.equal(lireUnGeste({ quoi: 'repondre', manche: 1, reponse: { filet: { epoque: 1, x: 1852, taille: 'moyen' } } }), null, 'des deux Filets à la fois')
})

// Le Filet en deux temps, par sa règle pure (`shared/cabinet/jeux/filetEnDeuxTemps.ts`) — le nouveau Filet du cahier
// des charges (`retours/2026-11-09/le-nouveau-filet.md`, § 3 et § 6). Ce qu'il en exige : quatre époques aux bornes
// rondes qui ne passent jamais dans l'avenir, des ordres de grandeur où une réponse pile sur une borne est des deux
// tranches, une piste régulière où chaque « + » change la valeur jusqu'au bout, la distance qui juge d'abord — de
// part et d'autre d'une borne, l'écart d'une grandeur lu au dixième —, deux aides qui retirent chacune une étoile sans
// jamais coûter le cœur, Éclairer qui en offre une, des repères tirés sans regarder où est la réponse, la place de la
// réponse tirée avec des poids, et rien au téléphone qui dise où elle est avant le verdict (invariant 1). Puis son
// tireur, sur de vraies questions de son contenu : à l'acte de l'épreuve, par le pli comme par les routes.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import type { QuestionDeLaBase } from '../src/core/baseCampagne'
import { lireLaBase } from '../src/core/baseCampagne'
import { contenuDuCabinet } from '../src/core/cabinet/contenu'
import { valeurDuFilet } from '../src/core/cabinet/tirages/tas'
import { tirerLePlan, type ContexteDuTirage } from '../src/core/cabinet/tirages/index'
import { categoriesDuFiletALAnnee } from '../src/core/cabinet/tirages/filetEnDeuxTemps'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import type { FiletTire } from '../../shared/cabinet/jeux/filet'
import { ENJEU_ORDINAIRE } from '../../shared/cabinet/partie'
import { VERSION_DE_LA_TRAVERSEE, etatDeLaTraversee, tracerLaCarte, type DepartDeLaTraversee, type GesteDeLaTraversee } from '../../shared/cabinet/traversee'
import type { PageDeLaTraversee, VueDeLaPartie } from '../../shared/cabinet/vues'
import { inscrireProfil } from './banc'
import { DIX_HEURES, aLaMain, bancDuCabinet, baseDuCabinet, commencer, departEnBase, fermerLesMagasins, jouer as unGeste, lire, ok, ouvrir as ouvrirLaManche, poster, vraiesQuestionsDuFilet } from './cabinet-banc'
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
  acteDuFilet,
  borneDeGrandeur,
  categoriesDuFilet,
  cransDe,
  ecartEnPourCent,
  etoilesDuLancer,
  lancerDeLaComposee,
  largeurDesEpoques,
  milieuDeLaTranche,
  placesPossibles,
  poidsDesPlaces,
  reperesDuFilet,
  sePoseALActe,
  seTendEnDeuxTemps,
  tirageEnDeuxTemps,
  tirerLaPlace,
  tranchesDuFilet,
  valeurAuCran,
  type EtatDuFiletEnDeuxTemps,
  type FiletEnDeuxTempsMontre,
  type FiletEnDeuxTempsRevele,
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

test('le Filet en deux temps : les repères — un par époque, sans regarder la réponse ; un des siens au plus ; aucun si le sujet en vide une', () => {
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
  // Chaque époque a le sien, celle de la réponse comprise (`REPERES_DU_FILET`, un par ligne depuis le 12 novembre 2026) :
  // choisis parmi ceux qui s'écartaient d'elle, ils tombaient rarement dans sa case (0,34 par manche, contre 0,56
  // ailleurs, dans la maquette du 9) ; deux au plus, tirés époque d'abord, chaque époque en avait un une fois sur deux.
  assert.equal(B.REPERES_DU_FILET, B.TRANCHES_DU_FILET)
  assert.deepEqual(parTranche, [N, N, N, N], `${parTranche.map(k => (k / N).toFixed(2)).join(' · ')}`)
  // Le sujet de la question écarte le seul repère d'une époque qui en avait un : sa ligne muette serait celle de la
  // réponse. Aucune époque n'en montre alors — seuls les siens restent, qui ne disent rien d'elle.
  const louis = { texte: 'En quelle année meurt Louis XIV, après soixante-douze ans de règne ?', valeur: 1715, annee: true, tranches: tirage(1715, true, 2).tranches }
  const anciens: RepereDuFilet[] = [
    { valeur: 1610, texte: 'L’assassinat d’Henri IV' },
    { valeur: 1682, texte: 'La cour s’installe à Versailles' },
    { valeur: 1715, texte: 'La mort de Louis XIV' },
    { valeur: 1789, texte: 'La prise de la Bastille' },
  ]
  for (let n = 0; n < 50; n++) {
    assert.deepEqual(reperesDuFilet(louis, { siens: [], communs: anciens }, hasardDe(`videe:${n}`)), [], 'une époque vidée par le sujet : aucun repère commun')
    assert.deepEqual(reperesDuFilet(louis, { siens: [{ valeur: 1789, texte: 'La prise de la Bastille' }], communs: anciens }, hasardDe(`videe:${n}`)), [{ valeur: 1789, texte: 'La prise de la Bastille', sien: true }])
    // Une époque sans repère au contenu ne dit rien de la réponse : les autres gardent le leur.
    const sansLe1715 = reperesDuFilet(louis, { siens: [], communs: anciens.filter(r => r.valeur !== 1715) }, hasardDe(`videe:${n}`))
    assert.deepEqual(sansLe1715.map(r => r.valeur), [1610, 1682, 1789])
  }
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
    // Le sien tient la ligne de son époque, les trois autres ont le leur.
    assert.equal(r.length, B.TRANCHES_DU_FILET)
    assert.equal(new Set(r.map(x => q.tranches.findIndex(t => x.valeur >= t.de && x.valeur <= t.a))).size, B.TRANCHES_DU_FILET)
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

// ── Le tireur, sur de vraies questions de son contenu ─────────────────────

/** La base livrée, et le contenu du Filet : il ne porte que l'identifiant d'une question, le tireur relit sa valeur dans la base. */
const LA_BASE = new Map(lireLaBase().questions.map(q => [q.id, q]))
const CONTENU = new Map(contenuDuCabinet().filet.map(e => [e.id, e]))
const acteDe = (id: string) => acteDuFilet(CONTENU.get(id)!)

/** Dix vraies questions de chaque acte, chacune sa valeur : ce qu'une base d'essai ajoute aux siennes, que le Filet ne pose pas. */
const REELLES: readonly QuestionDeLaBase[] = vraiesQuestionsDuFilet(10)

const PORTE = { deLaCategorie: (jouables: readonly QuestionDeLaBase[], c: Categorie) => jouables.filter(q => q.meta.categorie === c) }
const contexte = (jouables: readonly QuestionDeLaBase[], o: { acte?: 0 | 1 | 2; enDeuxTemps?: boolean } = {}): ContexteDuTirage => ({
  porte: PORTE,
  jouables,
  mesures: new Map(),
  vues: new Map(),
  maintenant: DIX_HEURES,
  hasard: Math.random,
  enjeu: ENJEU_ORDINAIRE,
  leurres: new Map(),
  filetEnDeuxTemps: o.enDeuxTemps ?? true,
  ...(o.acte !== undefined && { vise: { categorie: null, theme: null, acte: o.acte } }),
})

test('le tireur du Filet en deux temps : une question du contenu à l’acte de l’épreuve, son indice jugé, ses repères — jamais deux fois la même valeur', () => {
  assert.equal(REELLES.length, 30, 'dix questions de chaque acte dans le contenu')
  const jouables = baseDuCabinet(8, REELLES).questions
  const { reperes } = contenuDuCabinet()
  for (const acte of [0, 1, 2] as const) {
    for (let essai = 0; essai < 5; essai++) {
      const plan = tirerLePlan('filet', contexte(jouables, { acte }), 2) as FiletEnDeuxTempsTire[] | null
      assert.ok(plan, `l’acte ${acte + 1}`)
      assert.equal(plan.length, 5, 'trois manches et deux rechanges')
      assert.equal(new Set(plan.map(t => t.valeur)).size, plan.length, 'jamais deux fois la même valeur')
      for (const t of plan) {
        const e = CONTENU.get(t.question.id)
        assert.ok(e, `${t.question.id} : une question hors du contenu du Filet`)
        assert.equal(t.deuxTemps, true)
        assert.ok(sePoseALActe(e, acte), `${t.question.id} ne se pose pas à l’acte ${acte + 1} : son premier acte est ${acteDuFilet(e)} (de zéro à deux ; null, plus posée)`)
        assert.equal(t.indice, e.indice, 'l’indice jugé du contenu, ou rien')
        const v = valeurDuFilet(LA_BASE.get(t.question.id)!)!
        assert.deepEqual([t.valeur, t.annee, t.unite], [v.valeur, v.annee, v.unite])
        assert.ok(t.bonnes.length > 0 && t.bonnes.every(k => t.tranches[k].de <= t.valeur && t.valeur <= t.tranches[k].a), 'la bonne époque la tient')
        if (t.annee) assert.ok(t.tranches[B.TRANCHES_DU_FILET - 1].a <= DEPART, 'jamais dans l’avenir')
        // Les repères : des dates pour une année, la même unité pour une grandeur — jamais la réponse.
        assert.ok(t.reperes.length <= B.REPERES_DU_FILET)
        for (const r of t.reperes) {
          const commun = reperes.find(c => c.valeur === r.valeur && c.texte === r.texte)
          assert.ok(commun, `« ${r.texte} » : un repère du contenu`)
          assert.equal(commun.unite === null, t.annee, `« ${r.texte} » pour ${t.valeur}`)
          assert.notEqual(r.valeur, t.valeur)
        }
      }
    }
  }
  // Hors d'une traversée, l'acte I ; sans rien à l'acte promis, les autres — une épreuve qui ne partirait pas serait pire.
  assert.ok((tirerLePlan('filet', contexte(jouables), 0) as FiletEnDeuxTempsTire[]).every(t => acteDe(t.question.id) === 0))
  const sansLActeIII = baseDuCabinet(8, REELLES.filter(q => acteDe(q.id) !== 2)).questions
  const ailleurs = tirerLePlan('filet', contexte(sansLActeIII, { acte: 2 }), 0) as FiletEnDeuxTempsTire[] | null
  assert.ok(ailleurs && ailleurs.every(t => t.deuxTemps && acteDe(t.question.id) !== 2))
  // Le serveur qui ne tire pas en deux temps pose le Filet d'avant, ses parties intactes.
  assert.ok((tirerLePlan('filet', contexte(jouables, { enDeuxTemps: false }), 0) as FiletTire[]).every(t => 'piste' in t))
})

// ── Ses repères à soi ──────────────────────────────────────────────────────

/** Les années de l'acte I du contenu qui ont leur étiquette de repère : de quoi en placer, et en retrouver. */
const ANNEES_DE_L_ACTE_I = vraiesQuestionsDuFilet(400).filter(q => acteDe(q.id) === 0 && valeurDuFilet(q)?.annee === true && !!CONTENU.get(q.id)?.repere)
const PORTE_PAR_ID = { ...PORTE, parIdDe: (jouables: readonly QuestionDeLaBase[]) => new Map(jouables.map(q => [q.id, q])) }

test('ses repères à soi : une année qu’il a su placer revient, marquée sienne, sur la frise d’une autre année — une au plus', () => {
  const jouables = baseDuCabinet(8, ANNEES_DE_L_ACTE_I).questions
  const placees = ANNEES_DE_L_ACTE_I.filter((_, i) => i % 2 === 0)
  const placesAuFilet = new Set(placees.map(q => q.id))
  let siens = 0
  for (let essai = 0; essai < 12; essai++) {
    const plan = tirerLePlan('filet', { ...contexte(jouables, { acte: 0 }), porte: PORTE_PAR_ID, placesAuFilet }, 2) as FiletEnDeuxTempsTire[]
    for (const t of plan) {
      const a = t.reperes.filter(r => r.sien)
      assert.ok(a.length <= B.REPERES_SIENS_DU_FILET, 'un des siens au plus')
      for (const r of a) {
        assert.ok(
          placees.some(q => valeurDuFilet(q)!.valeur === r.valeur && CONTENU.get(q.id)!.repere === r.texte),
          `« ${r.texte} » (${r.valeur}) : une année qu’il a placée, sous l’étiquette du contenu`,
        )
        assert.notEqual(r.valeur, t.valeur, 'jamais la réponse')
      }
      siens += a.length
    }
  }
  assert.ok(siens > 0, 'ses repères reviennent')
  // Rien de placé, ou une porte qui ne lit pas la base : aucun des siens.
  for (const ctx of [{ ...contexte(jouables, { acte: 0 }), porte: PORTE_PAR_ID }, { ...contexte(jouables, { acte: 0 }), placesAuFilet }]) {
    assert.ok((tirerLePlan('filet', ctx, 2) as FiletEnDeuxTempsTire[]).every(t => t.reperes.every(r => !r.sien)))
  }
})

// ── Le tracé : un Filet seulement où son acte a de quoi tirer ─────────────

test('les catégories du Filet, acte par acte : celles qui ont assez de valeurs distinctes pour une épreuve', () => {
  const n = B.VALEURS_D_UN_THEME_DU_FILET
  const valeurs = (categorie: string, acte: number, combien: number, depuis = 0) => Array.from({ length: combien }, (_, i) => ({ categorie, acte, valeur: depuis + i }))
  const categories = categoriesDuFilet([
    ...valeurs('Histoire', 0, n),
    // Une valeur deux fois ne compte qu'une : le tireur ne la pose jamais deux fois dans une partie.
    ...valeurs('Nature', 0, n - 1),
    ...valeurs('Nature', 0, 1, n - 2),
    ...valeurs('Nature', 1, n),
    ...valeurs('Musique', 2, n + 5),
    // Ce qui n'est ni une catégorie ni un acte ne compte pas.
    ...valeurs('Rome', 0, n),
    ...valeurs('Histoire', 3, n),
  ])
  assert.deepEqual(categories, [['Histoire'], ['Nature'], ['Musique']])
  // Sur le contenu livré, à l'année du banc : l'acte I, qui ne pose que ce que chaque Français sait placer, n'avait de
  // quoi tirer qu'en Histoire et en Culture générale depuis le décalage du 12 novembre 2026 ; les questions neuves du
  // même jour (`retours/2026-11-12/acte-i-du-filet.md`) lui en donnent six de plus — la Musique, le Cinéma & séries, le
  // Sport, les Sciences, Autour de la fête et la Géographie, les deux dernières à douze valeurs, au seuil. Le lendemain,
  // les années que le juge des faits fermait (`retours/2026-11-13/annees-de-l-acte-i.md`) y mettent le Jeux & pop culture,
  // au seuil (12), et Autour de la fête passe à 18 ; la Géographie reste à 12. Pas la Cuisine (9), les Arts & lettres (10)
  // ni la Nature (3). L'acte II, qui pose aussi ce que l'acte I
  // pose, y ajoute les Arts & lettres, toujours pas la Cuisine ni la Nature ; l'acte III les a toutes.
  const jouables = [...LA_BASE.values()]
  const livrees = categoriesDuFiletALAnnee({ porte: PORTE, jouables }, DEPART)
  assert.deepEqual(
    [...livrees[0]].sort(),
    ['Autour de la fête', 'Cinéma & séries', 'Culture générale', 'Géographie', 'Histoire', 'Jeux & pop culture', 'Musique', 'Sciences', 'Sport'],
    `l’acte I : ${livrees[0].join(', ')}`,
  )
  assert.ok(livrees[0].every(c => livrees[1].includes(c)) && livrees[1].length > livrees[0].length, `l’acte II : ${livrees[1].join(', ')}`)
  assert.ok(!livrees[1].includes('Nature') && !livrees[1].includes('Cuisine'), 'l’acte II n’a pas de quoi tirer en Nature ni en Cuisine')
  assert.equal(livrees[2].length, CATEGORIES.length)
})

test('la carte ne promet au nouveau Filet qu’une catégorie où son acte a de quoi tirer, et sans liste, celle d’avant', () => {
  const gardiens = ['lg:renard', 'lg:sphinx', 'lg:dragon'] as const
  const themes = { epingle: ['Rome'], frise: ['Rome'] }
  const filet: Categorie[][] = [['Histoire', 'Musique'], ['Nature'], []]
  const vues: Set<string>[] = [new Set(), new Set(), new Set()]
  for (let n = 0; n < 60; n++) {
    const actes = tracerLaCarte(hasardDe(`trace:${n}`), gardiens, { ...themes, filet })
    actes.forEach((acte, a) => {
      for (const e of acte.etapes.filter(x => x.jeu === 'filet' && x.sorte === 'epreuve')) {
        vues[a].add(e.theme!)
        if (filet[a].length > 0) assert.ok(filet[a].includes(e.theme as Categorie), `l’acte ${a + 1} promet « ${e.theme} » au Filet`)
      }
    })
    // Une liste vide à un acte, ou pas de liste : toutes les catégories, et le même hasard — une carte d'avant reste la sienne.
    assert.deepEqual(tracerLaCarte(hasardDe(`trace:${n}`), gardiens, { ...themes, filet: [[], [], []] }), tracerLaCarte(hasardDe(`trace:${n}`), gardiens, themes))
  }
  assert.deepEqual([vues[0].size, vues[1].size], [2, 1], 'les deux catégories de l’acte I, la seule de l’acte II')
  assert.ok(vues[2].size > 4, `sans liste, l’acte III promet de tout : ${[...vues[2]].join(', ')}`)
})

// ── Par les routes ───────────────────────────────────────────────────────

const ouverts: { close(): unknown }[] = []
after(() => ouverts.forEach(o => o.close()))
after(fermerLesMagasins)

/** Un vrai serveur qui tire le Filet en deux temps, sur une base d'essai qui porte les vraies questions de son contenu. */
async function unServeur() {
  const b = await bancDuCabinet({ filetEnDeuxTemps: true, baseDeLaCampagne: baseDuCabinet(8, REELLES) })
  ouverts.push(b.banc)
  return b
}

test('le Filet en deux temps par les routes : une partie libre se tire à l’acte I, et se joue en deux temps — l’époque, puis la valeur', async () => {
  const b = await unServeur()
  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  const v0 = ok(await commencer(b, lea, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'commencer')
  const tirages = departEnBase(b.fichier, v0.id).tirages as FiletEnDeuxTempsTire[]
  assert.ok(
    tirages.every(t => t.deuxTemps && acteDe(t.question.id) === 0),
    'l’acte I, hors d’une traversée',
  )
  const montree = v0.enCours as FiletEnDeuxTempsMontre
  assert.equal(montree.deuxTemps, true)
  assert.deepEqual(montree.tranches, tirages[0].tranches)
  // Pile sur la valeur, dans la bonne époque : trois étoiles, sans aide.
  const t = tirages[0]
  const revelee = ok(await unGeste(b, lea, v0, { quoi: 'repondre', manche: 0, reponse: { filet: { epoque: t.bonnes[0], x: t.valeur } } }), 'le lancer')
  const corps = revelee.revelation?.corps as FiletEnDeuxTempsRevele
  assert.deepEqual([corps.valeur, corps.etoiles, corps.payees], [t.valeur, 3, 0])
})

test('une épreuve du Filet à l’acte II se tire à l’acte II : l’acte de l’étape va jusqu’au tireur', async () => {
  const b = await unServeur()
  const cookie = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  const profil = (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
  // Une traversée écrite à la main jusqu'à l'acte II, ses épreuves conclues sans faute, rejouée par le pli comme le serveur
  // l'aurait écrite ; sa carte tracée de trois jeux, qu'une rangée de trois épreuves pose tous.
  let x = 7
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const depart: DepartDeLaTraversee = {
    v: VERSION_DE_LA_TRAVERSEE,
    jour: '2026-10-24',
    actes: tracerLaCarte(hasard, ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: [], frise: [] }, ['filet', 'pari', 'eclair']),
  }
  const gestes: GesteDeLaTraversee[] = [{ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }]
  const etat = () =>
    etatDeLaTraversee(
      depart,
      gestes.map(geste => ({ geste, faitLe: 0 })),
    )
  let e = etat()
  let p = 0
  while (!(e.acte === 1 && e.ameliorations === 0)) {
    if (e.ameliorations > 0) gestes.push({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 3)!.cle })
    else {
      const ici = depart.actes[e.acte].etapes
      const suivantes = e.ou.sorte === 'gardien' ? [e.ou.etape] : ici.find(s => s.id === e.position)!.suivantes
      const etape = ici.find(s => s.id === (suivantes.find(id => ici.find(s => s.id === id)?.sorte === 'epreuve') ?? suivantes[0]))!
      if (etape.sorte === 'coffre' || etape.sorte === 'marchand') gestes.push({ quoi: 'aller', etape: etape.id })
      else {
        const partie = `fausse-${++p}`
        gestes.push({ quoi: 'epreuve', etape: etape.id, partie }, { quoi: 'conclure', partie, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })) })
      }
    }
    e = etat()
  }
  assert.equal(e.ignores, 0)
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  aLaMain(
    b.fichier,
    [
      `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES ('filet-acte-2', ${q(profil)}, ${q(JSON.stringify(depart))}, 1)`,
      ...gestes.map((g, k) => `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES ('filet-acte-2', ${k + 1}, ${q(JSON.stringify(g))}, ${k + 2}, 'u${k}')`),
    ].join(';\n'),
  )
  const t = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page').traversee!
  assert.equal(t.acte, 1)
  const etape = t.atteignables.find(id => depart.actes[1].etapes.find(s => s.id === id)?.jeu === 'filet')
  assert.ok(etape, 'un Filet au premier rang de l’acte II')
  const entree = ok(await poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'aller', etape } }), 'l’entrée').traversee!
  const partie = entree.partie as VueDeLaPartie
  assert.equal(partie.jeu, 'filet')
  const tirages = departEnBase(b.fichier, partie.id).tirages as FiletEnDeuxTempsTire[]
  // L'acte II pose ce que le panel donne à 50 % et plus, et ce que l'acte I pose (`sePoseALActe`) — jamais l'acte III.
  assert.deepEqual(
    tirages.map(x => [x.deuxTemps, sePoseALActe(CONTENU.get(x.question.id)!, 1)]),
    tirages.map(() => [true, true]),
    `chaque manche, et chaque rechange, de ce que l’acte II pose : ${tirages.map(x => acteDe(x.question.id)).join(', ')}`,
  )
  // Une aide payée, puis le lancer juste : deux étoiles, et la traversée lira l'aide payée.
  const aidee = ok(await unGeste(b, cookie, partie, { quoi: 'aide', manche: 0, aide: 'epoques' }), 'l’aide')
  const revelee = ok(await unGeste(b, cookie, aidee, { quoi: 'repondre', manche: 0, reponse: { filet: { epoque: tirages[0].bonnes[0], x: tirages[0].valeur } } }), 'le lancer')
  assert.deepEqual([(revelee.revelation?.corps as FiletEnDeuxTempsRevele).etoiles, (revelee.revelation?.corps as FiletEnDeuxTempsRevele).payees], [2, 1])
  // La note de la manche le dit : sans elle, deux étoiles pour un lancer pile dessus se lisaient comme un lancer à côté.
  assert.equal(revelee.manches[0].note, '−1 : ton aide')
})

test('une traversée qui commence ne promet au Filet, à chaque acte, qu’une catégorie où il a de quoi tirer', async () => {
  // L'acte I n'a de quoi tirer qu'en Histoire et en Culture générale : les autres catégories n'y gardent que trois questions.
  const gardees = new Map<string, number>()
  const reelles = vraiesQuestionsDuFilet(1000).filter(q => {
    if (acteDe(q.id) !== 0 || q.meta.categorie === 'Histoire' || q.meta.categorie === 'Culture générale') return true
    const n = gardees.get(q.meta.categorie) ?? 0
    gardees.set(q.meta.categorie, n + 1)
    return n < 3
  })
  const attendues = categoriesDuFiletALAnnee({ porte: PORTE, jouables: baseDuCabinet(8, reelles).questions }, DEPART)
  assert.deepEqual([...attendues[0]].sort(), ['Culture générale', 'Histoire'])
  const b = await bancDuCabinet({ filetEnDeuxTemps: true, baseDeLaCampagne: baseDuCabinet(8, reelles) })
  ouverts.push(b.banc)
  // Des traversées jusqu'à huit Filets promis à l'acte I, jamais un nombre fixe de cartes. Un acte a huit épreuves pour dix
  // jeux : une carte sur cinq n'y a aucun Filet — et non « une sur trente-cinq », comme l'épreuve le croyait d'abord. Ses
  // quatre cartes n'en avaient donc aucun une fois sur 625, et la CI a tiré cette fois-là le 9 novembre 2026. Huit
  // promesses : une carte qui ne lirait pas la liste du serveur les tirerait des douze catégories, toutes dans les deux
  // permises moins d'une fois sur un million. Dix cartes y suffisent en moyenne ; soixante sans y arriver n'arrive pas.
  const VOULUES = 8
  const promises: string[][] = [[], [], []]
  for (let n = 0; n < 60 && promises[0].length < VOULUES; n++) {
    const cookie = await inscrireProfil(b.banc.url, `voyageur${n}`, `Voyageur ${n}`)
    const t = ok(await poster<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee', {}), 'la traversée').traversee!
    t.actes.forEach((acte, a) => acte.etapes.filter(e => e.jeu === 'filet' && e.sorte === 'epreuve').forEach(e => promises[a].push(e.theme!)))
  }
  assert.ok(promises[0].length >= VOULUES, `${promises[0].length} Filets à l’acte I, en soixante traversées`)
  assert.ok(
    promises[0].every(c => attendues[0].includes(c as Categorie)),
    `l’acte I promet au Filet : ${promises[0].join(', ')}`,
  )
})

test('par les routes : l’année placée sans aide revient en repère à soi à la partie suivante ; celle placée avec une aide, non', async () => {
  // Des années de l'acte I d'une même époque, 1975–1999 : la frise de chacune tient toutes les autres. De 1950 à 1974
  // jusqu'au décalage du 12 novembre 2026 : l'acte I ne pose plus que ce que chaque Français sait placer, et cette
  // époque-là n'en garde pas six de valeurs distinctes.
  const epoque = ANNEES_DE_L_ACTE_I.filter(q => valeurDuFilet(q)!.valeur >= 1975 && valeurDuFilet(q)!.valeur <= 1999)
  // Deux parties de trois manches sans revoir une question : six au moins.
  assert.ok(epoque.length >= 6, `${epoque.length} années de 1975 à 1999 à l’acte I`)
  const b = await bancDuCabinet({ filetEnDeuxTemps: true, baseDeLaCampagne: baseDuCabinet(8, epoque) })
  ouverts.push(b.banc)
  const lou = await inscrireProfil(b.banc.url, 'lou', 'Lou')
  // La première manche placée pile, sans aide ; la deuxième pile aussi, « Deux époques de moins » payée ; la troisième à côté.
  let v = ok(await commencer(b, lou, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'commencer')
  const tirages = departEnBase(b.fichier, v.id).tirages as FiletEnDeuxTempsTire[]
  const pile = (t: FiletEnDeuxTempsTire) => ({ filet: { epoque: t.bonnes[0], x: t.valeur } })
  v = ok(await unGeste(b, lou, v, { quoi: 'repondre', manche: 0, reponse: pile(tirages[0]) }), 'la première, pile')
  v = await ouvrirLaManche(b, lou, v, 1)
  v = ok(await unGeste(b, lou, v, { quoi: 'aide', manche: 1, aide: 'epoques' }), 'l’aide payée')
  v = ok(await unGeste(b, lou, v, { quoi: 'repondre', manche: 1, reponse: pile(tirages[1]) }), 'la deuxième, pile et aidée')
  v = await ouvrirLaManche(b, lou, v, 2)
  const ailleurs = tirages[2].tranches.findIndex((_, k) => !tirages[2].bonnes.includes(k))
  v = ok(await unGeste(b, lou, v, { quoi: 'repondre', manche: 2, reponse: { filet: { epoque: ailleurs, x: milieuDeLaTranche(tirages[2].tranches[ailleurs]) } } }), 'la troisième, à côté')
  const repere = (t: FiletEnDeuxTempsTire) => ({ valeur: t.valeur, texte: CONTENU.get(t.question.id)!.repere! })
  // La partie suivante : ses frises le montrent, marqué sien — jamais l'année qu'une aide lui a fait placer.
  const suite = ok(await commencer(b, lou, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'la partie suivante')
  const siens = (departEnBase(b.fichier, suite.id).tirages as FiletEnDeuxTempsTire[]).flatMap(t => t.reperes.filter(r => r.sien))
  assert.ok(siens.length > 0, 'son repère revient')
  assert.ok(
    siens.every(r => r.valeur === repere(tirages[0]).valeur && r.texte === repere(tirages[0]).texte),
    `ses repères : ${siens.map(r => `${r.valeur} ${r.texte}`).join(' ; ')} — seule « ${repere(tirages[0]).texte} » est à lui`,
  )
})

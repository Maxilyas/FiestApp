// Les règles pures du soin et du jardin (la maquette validée le 20 octobre
// 2026, `retours/2026-10-20/mon-compagnon/`) : trente trouvailles en cinq
// raretés, le cadeau tiré à ses chances — les doubles admis, les neuves
// d'abord —, les deux légendaires par exploit, le terrain qui grandit avec la
// complicité, et le jardin vérifié place par place.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasardDe } from '../../shared/missions'
import { suiteFixe } from '../../shared/hasard'
import {
  CHANCES_DU_CADEAU,
  EXPLOITS_DU_JARDIN,
  exploitsAtteints,
  inventaire,
  jardinMontre,
  niveauDuTerrain,
  placeLibre,
  placesOuvertes,
  PLACES_DU_JARDIN,
  POIDS_D_UNE_NEUVE,
  TERRAINS,
  tirerUneTrouvaille,
  TROUVAILLES,
  trouvailleDe,
  vaDans,
  verifierLeJardin,
} from '../../shared/trouvailles'
import {
  etoilesDeLaCueillette,
  lireLeScore,
  prochainCadeauGrand,
  prochainGrandCadeau,
  prochainTour,
  SCORE_MAX_DE_LA_CUEILLETTE,
  tourDuJour,
  toursAppris,
} from '../../shared/soins'

test('trente trouvailles, cinq raretés : dix, huit, six, quatre, deux — les légendaires seules ont un exploit', () => {
  assert.equal(TROUVAILLES.length, 30)
  assert.equal(new Set(TROUVAILLES.map(t => t.cle)).size, 30)
  const parRarete = (r: string) => TROUVAILLES.filter(t => t.rarete === r).length
  assert.deepEqual(['commune', 'peucommune', 'rare', 'epique', 'legendaire'].map(parRarete), [10, 8, 6, 4, 2])
  for (const t of TROUVAILLES) assert.equal(!!t.exploit, t.rarete === 'legendaire', t.cle)
  assert.deepEqual(new Set(TROUVAILLES.filter(t => t.exploit).map(t => t.exploit)), new Set(Object.keys(EXPLOITS_DU_JARDIN)))
})

test('le terrain : trois, cinq, sept puis dix places, à 0, 7, 25 et 60 jours de complicité', () => {
  assert.deepEqual(TERRAINS.map(t => [t.places, t.jours]), [[3, 0], [5, 7], [7, 25], [10, 60]])
  TERRAINS.forEach((t, i) => assert.equal(placesOuvertes(i).length, t.places, t.nom))
  assert.deepEqual([0, 6, 7, 24, 25, 59, 60, 400].map(niveauDuTerrain), [0, 0, 1, 1, 2, 2, 3, 3])
  // Le petit coin a sa place dans le ciel et deux au sol : n'importe quelle première trouvaille s'y pose, sauf un grand objet.
  assert.deepEqual(placesOuvertes(0).map(p => PLACES_DU_JARDIN[p].sorte).sort(), ['bas', 'bas', 'ciel'])
})

test('ce qui vole va dans son ciel, un grand objet sur une grande place, un petit partout au sol', () => {
  const t = (cle: string) => trouvailleDe(cle)!
  assert.ok(vaDans(t('cerfvolant'), 's5'))
  assert.ok(!vaDans(t('cerfvolant'), 's2'))
  assert.ok(vaDans(t('lanterne'), 's4'))
  assert.ok(!vaDans(t('lanterne'), 's2'))
  assert.ok(vaDans(t('gamelle'), 's2'))
  assert.ok(vaDans(t('gamelle'), 's4'), 'un petit objet tient aussi sur une grande place')
  assert.ok(!vaDans(t('gamelle'), 's5'))
  assert.ok(!vaDans(t('gamelle'), 's42'))
})

test('le cadeau du jour : surtout des communes, jamais d’épique ni de légendaire ; le grand cadeau : rare ou épique', () => {
  const rien: Record<string, number> = {}
  const compte = (grand: boolean) => {
    const n: Record<string, number> = {}
    for (let i = 0; i < 6000; i++) {
      const r = trouvailleDe(tirerUneTrouvaille(grand, rien, hasardDe(`essai:${grand}:${i}`)))!.rarete
      n[r] = (n[r] ?? 0) + 1
    }
    return n
  }
  const jour = compte(false)
  assert.deepEqual(Object.keys(jour).sort(), ['commune', 'peucommune', 'rare'])
  for (const [r, c] of Object.entries(CHANCES_DU_CADEAU.jour)) assert.ok(Math.abs(jour[r] / 6000 - c! / 100) < 0.03, `${r} : ${jour[r]}`)
  const grand = compte(true)
  assert.deepEqual(Object.keys(grand).sort(), ['epique', 'rare'])
  for (const [r, c] of Object.entries(CHANCES_DU_CADEAU.grand)) assert.ok(Math.abs(grand[r] / 6000 - c! / 100) < 0.03, `${r} : ${grand[r]}`)
})

test('les doubles viennent, mais une trouvaille neuve pèse trois fois une qu’il a déjà', () => {
  const communes = TROUVAILLES.filter(t => t.rarete === 'commune').map(t => t.cle)
  // Il a toutes les communes sauf la dernière : sur les communes tirées, elle revient trois fois sur douze.
  const siennes = Object.fromEntries(communes.slice(0, -1).map(c => [c, 1]))
  let communesTirees = 0
  let neuve = 0
  for (let i = 0; i < 8000; i++) {
    const cle = tirerUneTrouvaille(false, siennes, hasardDe(`double:${i}`))
    if (trouvailleDe(cle)!.rarete !== 'commune') continue
    communesTirees++
    if (cle === communes[communes.length - 1]) neuve++
  }
  const attendu = POIDS_D_UNE_NEUVE / (POIDS_D_UNE_NEUVE + communes.length - 1)
  assert.ok(Math.abs(neuve / communesTirees - attendu) < 0.03, `${neuve} sur ${communesTirees}`)
  // Et tout a déjà été trouvé : le tirage donne un double, il ne s'arrête pas.
  const tout = Object.fromEntries(TROUVAILLES.map(t => [t.cle, 2]))
  assert.ok(trouvailleDe(tirerUneTrouvaille(true, tout, suiteFixe(7))))
})

test('ses trouvailles se comptent des cadeaux ouverts, doubles compris, et ses exploits ajoutent leur légendaire', () => {
  assert.deepEqual(inventaire(['lanterne', 'gamelle', 'lanterne', 'inconnue'], new Set()), { lanterne: 2, gamelle: 1 })
  assert.deepEqual(inventaire([], new Set(['cent-jours'])), { fontaine: 1 })
  assert.deepEqual(exploitsAtteints([12, 99], 9), new Set())
  assert.deepEqual(exploitsAtteints([12, 100], 10), new Set(['cent-jours', 'trois-etoiles']))
})

test('le jardin se vérifie place par place : ouverte, à sa sorte, et pas plus de copies qu’il n’en a', () => {
  const siennes = { lanterne: 1, gamelle: 2, cerfvolant: 1 }
  assert.deepEqual(verifierLeJardin({ s2: 'gamelle', s3: 'gamelle', s5: 'cerfvolant', s1: null }, 1, siennes), { s2: 'gamelle', s3: 'gamelle', s5: 'cerfvolant' })
  assert.deepEqual(verifierLeJardin({ s4: 'lanterne' }, 1, siennes), { s4: 'lanterne' })
  assert.throws(() => verifierLeJardin({ s4: 'lanterne' }, 0, siennes), /pas encore à lui/)
  assert.throws(() => verifierLeJardin({ s2: 'lanterne' }, 1, siennes), /grande place/)
  assert.throws(() => verifierLeJardin({ s2: 'cerfvolant' }, 1, siennes), /son ciel/)
  assert.throws(() => verifierLeJardin({ s1: 'lanterne', s4: 'lanterne' }, 1, siennes), /pas d’autre à poser/)
  assert.throws(() => verifierLeJardin({ s2: 'coussin' }, 1, siennes), /Pas encore dans tes trouvailles : le coussin moelleux\./)
  assert.throws(() => verifierLeJardin({ s2: 'licorne' }, 1, siennes), /n’existe pas/)
  assert.throws(() => verifierLeJardin({ s99: 'gamelle' }, 3, siennes), /n’existe pas/)
  assert.throws(() => verifierLeJardin('s2=gamelle', 1, siennes), /ne se lit pas/)
  // Relu des mois plus tard, un jardin ne montre que ce qui tient encore.
  assert.deepEqual(jardinMontre({ s4: 'lanterne', s2: 'gamelle', s3: 'gamelle' }, 0, { gamelle: 1, lanterne: 1 }), { s2: 'gamelle' })
})

test('la première place libre d’une trouvaille neuve : la cour d’abord, et rien quand il n’y en a plus', () => {
  assert.equal(placeLibre({}, 1, 'lanterne'), 's1')
  assert.equal(placeLibre({ s1: 'bouleau' }, 1, 'lanterne'), 's4')
  assert.equal(placeLibre({ s1: 'bouleau', s4: 'boite' }, 1, 'lanterne'), null)
  assert.equal(placeLibre({ s1: 'bouleau', s4: 'boite' }, 2, 'lanterne'), 's6')
  assert.equal(placeLibre({}, 0, 'gamelle'), 's2')
  assert.equal(placeLibre({ s5: 'ballons' }, 0, 'fanions'), null)
})

test('la complicité : un grand cadeau tous les sept jours, quatre tours appris en route', () => {
  assert.deepEqual([0, 5, 6, 7, 13, 20].map(prochainCadeauGrand), [false, false, true, false, true, true])
  assert.deepEqual([0, 6, 7, 13].map(prochainGrandCadeau), [7, 7, 14, 14])
  assert.equal(tourDuJour(3), 'la pirouette')
  assert.equal(tourDuJour(4), null)
  assert.deepEqual(toursAppris(12), ['la pirouette', 'le salut'])
  assert.deepEqual(prochainTour(12), { jours: 20, nom: 'la danse' })
  assert.equal(prochainTour(40), null)
})

test('la cueillette : trois étoiles à 10, 20 et 30 points, et un score qui ne se lit pas est refusé', () => {
  assert.deepEqual([0, 9, 10, 29, 30, 80].map(etoilesDeLaCueillette), [0, 0, 1, 2, 3, 3])
  assert.equal(lireLeScore(31), 31)
  for (const faux of [-1, 2.5, SCORE_MAX_DE_LA_CUEILLETTE + 1, '31', null, Number.NaN]) assert.throws(() => lireLeScore(faux), /rejoue/, String(faux))
})

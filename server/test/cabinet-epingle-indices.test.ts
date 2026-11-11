// Les indices de l'Épingle (le 11 novembre 2026). Le jeu était le plus évité
// après la Frise — pris 19 fois sur cent quand la carte le proposait, un tiers
// de ses manches justes, 28 % à zéro étoile, du 1er au 8 novembre —, et le
// propriétaire : « l'épingle était aussi trop dur, c'est parfois des choses
// qu'on n'arrive pas à savoir. J'avais une idée d'avoir une sorte de texte qui
// se déroule au fur et à mesure et les étoiles baissent, mais qui donne de plus
// en plus d'indices précis sur la localisation. »
//
// Deux indices par lieu, écrits avec lui et demandés un à un. La première
// version disait le coin de France, puis calculait la place du lieu depuis une
// ville de la carte (« À 170 km à l'ouest de Paris. ») ; le propriétaire, le
// même jour : « les indices doivent être beaucoup plus subtils, et soit relater
// un fait là où se situe le point, soit même son histoire. […] Je trouve
// dommage d'avoir des "à 100 km de Paris" : il n'y a plus aucune réflexion. »
// Ce sont donc des faits à déduire, jamais une adresse. Chacun retire une
// étoile de ce que la manche met en jeu ; la distance décide dessous. Ici : la
// règle pure, les indices de chaque lieu livré — deux faits, sans sa commune ni
// son département, sans distance ni direction —, puis par les routes : rien
// d'un indice ne part avant d'être demandé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import { bancDuCabinet, commencer, epingleDe, jouer as unGeste, jouerUneEpingle, ok, ouvrir as ouvrirLaManche } from './cabinet-banc'
import { departDe } from './cabinet-plans'
import { contenuDuCabinet, ecritDans, refusDuLieu } from '../src/core/cabinet/contenu'
import { ETOILES_AUX_INDICES_DE_L_EPINGLE, INDICE_DE_L_EPINGLE_MAX, KM_DE_L_EPINGLE } from '../../shared/cabinet/bareme'
import type { Lieu } from '../../shared/cabinet/contenu'
import type { Point } from '../../shared/cabinet/france'
import { INDICES_D_UN_LIEU, PAS_D_INDICE, PLUS_D_INDICE, REGLE_DE_L_EPINGLE, epingleTiree, etoilesEnJeu, pointADistance, type EpingleMontree, type EpingleRevelee, type EtatDeLEpingle } from '../../shared/cabinet/jeux/epingle'
import { JEUX, motsDesIndicesDeLEpingle, trancheLaManche } from '../../shared/cabinet/jeux/regle'
import { lireLeDepart } from '../../shared/cabinet/lecture'

const R = REGLE_DE_L_EPINGLE
const toujours = (x: number) => () => x
/** Un hasard qui ne doit pas servir : ni un indice ni son jugement ne tirent rien. */
const SANS_HASARD = () => {
  throw new Error('un indice a tiré au hasard')
}

const INDICES = ["Le duc en question régnait jusqu'en Flandre, mais sa capitale était la ville de la moutarde.", 'La ville se dit capitale des vins de Bourgogne, au milieu de vignes de grands crus.']
/** Le lieu tel qu'une partie d'avant les indices l'a figé. */
const BEAUNE_D_AVANT: Lieu = {
  id: 'arts-hospices-de-beaune',
  theme: "Les lieux de l'art",
  nom: "L'Hôtel-Dieu de Beaune",
  commune: 'Beaune',
  departement: "Côte-d'Or",
  lat: 47.022,
  lon: 4.837,
  annee: 1443,
  date: '1443',
  recit: "Le chancelier d'un puissant duc et sa femme fondent un hôpital pour les pauvres.",
  question: 'Où se trouve cet hôpital aux toits multicolores ?',
  savais: 'Ses vins sont vendus aux enchères depuis 1859.',
  categorie: 'Arts & lettres',
}
const BEAUNE: Lieu = { ...BEAUNE_D_AVANT, indices: INDICES }
const AVEC = epingleTiree(BEAUNE, toujours(0.5))
/** Un tirage d'avant les indices : une partie commencée avant eux, que le pli rejoue. */
const SANS = epingleTiree(BEAUNE_D_AVANT, toujours(0.5))
/** Une épingle à tant de kilomètres du lieu, vers le sud. */
const a = (km: number): Point => (km === 0 ? { lat: BEAUNE.lat, lon: BEAUNE.lon } : pointADistance(BEAUNE, km, 180))
const planter = (km: number) => ({ quoi: 'repondre' as const, epingle: a(km) })
/** L'état d'une manche après tant d'indices demandés. */
function apres(t: typeof AVEC, combien: number): EtatDeLEpingle {
  let e = R.ouvrir(t)
  for (let k = 0; k < combien; k++) {
    const suite = R.apresLeGeste(t, e, { quoi: 'indice' })
    assert.ok(typeof suite !== 'string', `le ${k + 1}ᵉ indice : ${String(suite)}`)
    e = suite as EtatDeLEpingle
  }
  return e
}

test('un indice se demande, il ne tranche rien : la manche met en jeu une étoile de moins à chacun, jamais zéro', () => {
  assert.deepEqual(ETOILES_AUX_INDICES_DE_L_EPINGLE, [3, 2, 1])
  assert.deepEqual(
    [0, 1, 2, 3, 9, -1].map(n => etoilesEnJeu(n)),
    [3, 2, 1, 1, 1, 3],
    'au-delà du dernier, et en deçà du premier, le barème tient ses bords',
  )
  // Le geste se lit, et ne tranche pas : « Reculer d'un pas », au Détail, est de la même famille.
  const g = R.lireLeGeste({ quoi: 'indice', manche: 0 }, AVEC)
  assert.deepEqual(g, { quoi: 'indice' })
  assert.equal(trancheLaManche(R, AVEC, R.ouvrir(AVEC), g!), false)
  assert.equal(trancheLaManche(R, AVEC, R.ouvrir(AVEC), planter(0)), true)
  // Un à un, dans l'ordre du tirage ; le troisième se refuse en mots, et l'état ne bouge pas.
  assert.deepEqual([0, 1, 2].map(n => apres(AVEC, n).indices ?? 0), [0, 1, 2])
  assert.equal(R.apresLeGeste(AVEC, apres(AVEC, 2), { quoi: 'indice' }), PLUS_D_INDICE)
  assert.equal(R.apresLeGeste(SANS, R.ouvrir(SANS), { quoi: 'indice' }), PAS_D_INDICE, 'un tirage d’avant les indices n’en a pas')
  // Éclairer n'y touche pas, et un indice ne touche pas à la zone : deux aides à part, l'une d'une carte, l'autre d'une étoile.
  const eclairee = R.eclairer(AVEC, apres(AVEC, 1), SANS_HASARD) as EtatDeLEpingle
  assert.deepEqual([eclairee.indices, !!eclairee.zone], [1, true])
  assert.equal((R.apresLeGeste(AVEC, eclairee, { quoi: 'indice' }) as EtatDeLEpingle).zone, eclairee.zone)
})

test('la distance décide, sous ce que les indices ont laissé en jeu', () => {
  const [pres, moyen, loin] = KM_DE_L_EPINGLE
  const etoiles = (km: number, indices: number) => R.juger(AVEC, apres(AVEC, indices), planter(km)).naturel
  // Sans indice : le barème d'avant, au kilomètre.
  assert.deepEqual([0, pres - 1, pres + 1, moyen - 1, moyen + 1, loin - 1, loin + 1].map(km => etoiles(km, 0)), [3, 3, 2, 2, 1, 1, 0])
  // Un indice : deux étoiles au plus — sur le lieu même.
  assert.deepEqual([0, pres - 1, moyen - 1, loin - 1, loin + 1].map(km => etoiles(km, 1)), [2, 2, 2, 1, 0])
  // Deux : une étoile, pour qui tombe dans les trois cents kilomètres ; au-delà, rien — un indice ne donne pas l'étoile.
  assert.deepEqual([0, pres - 1, moyen - 1, loin - 1, loin + 1].map(km => etoiles(km, 2)), [1, 1, 1, 1, 0])
  // La pièce du journal garde l'épingle et la distance, comme avant : juste dès deux étoiles naturelles.
  const v = R.juger(AVEC, apres(AVEC, 2), planter(0))
  assert.deepEqual([v.pieces.length, v.pieces[0].juste, v.pieces[0].composee], [1, false, `${BEAUNE.lat},${BEAUNE.lon}|0`])
  assert.equal(R.juger(AVEC, apres(AVEC, 1), planter(0)).pieces[0].juste, true)
  // Sans épingle, expirée ou quittée : rien, quels que soient ses indices.
  for (const reponse of [{ quoi: 'repondre' as const, epingle: null }, 'expiree' as const, 'quittee' as const]) assert.equal(R.juger(AVEC, apres(AVEC, 2), reponse).naturel, 0)
  // Un tirage d'avant les indices se rejoue tel qu'il s'est joué : ses trois étoiles sur le lieu, quoi que dise un état.
  assert.equal(R.juger(SANS, { zone: null, indices: 2 }, planter(0)).naturel, 3)
})

test('la manche ne montre que les indices demandés — jamais le suivant —, et la révélation les redit', () => {
  const montree = (n: number) => R.montrer(AVEC, apres(AVEC, n))
  assert.deepEqual([0, 1, 2].map(n => [montree(n).indices, montree(n).enJeu, montree(n).aDemander]), [
    [[], 3, 2],
    [[INDICES[0]], 2, 1],
    [INDICES, 1, 0],
  ])
  // Le second ne part pas avec le premier : rien de la vue d'un premier indice ne l'écrit.
  assert.ok(!JSON.stringify(montree(1)).includes(INDICES[1]))
  assert.ok(!JSON.stringify(montree(0)).includes(INDICES[0]))
  const v = R.juger(AVEC, apres(AVEC, 1), planter(10))
  assert.deepEqual((R.reveler(AVEC, apres(AVEC, 1), v) as EpingleRevelee).indices, [INDICES[0]])
  // Un tirage d'avant : aucun indice à montrer ni à demander, et la page n'a pas de bouton à poser.
  assert.deepEqual([R.montrer(SANS, R.ouvrir(SANS)).indices, R.montrer(SANS, R.ouvrir(SANS)).aDemander, R.montrer(SANS, R.ouvrir(SANS)).enJeu], [[], 0, 3])
})

test('les indices se figent dans le tirage avec le lieu, et se relisent tels quels — un tirage d’avant se relit sans', () => {
  // Un départ comme le serveur l'écrit (`departDe`, `cabinet-plans.ts`), ses trois tirages remplacés.
  const depart = (tirages: unknown[]) => ({ ...departDe('epingle'), tirages })
  const relu = (t: unknown) => lireLeDepart(JSON.stringify(depart([t, t, t])))?.tirages[0]
  // Lu d'abord tel que le serveur l'écrit : sans cela, ce qui suit ne prouverait rien.
  assert.deepEqual(relu(AVEC), AVEC, 'un tirage et les indices de son lieu')
  assert.deepEqual(AVEC.lieu.indices, INDICES)
  // Un lieu d'avant ses indices se relit aussi : la partie en route à la mise en ligne ne se perd pas.
  assert.deepEqual(relu(SANS), SANS, 'un tirage d’avant le 11 novembre 2026')
  assert.equal('indices' in ((relu(SANS) as typeof SANS).lieu as object), false)
  for (const [abime, pourquoi] of [
    [{ ...AVEC, lieu: { ...BEAUNE, indices: 'Un fait.' } }, 'un texte seul'],
    [{ ...AVEC, lieu: { ...BEAUNE, indices: [] } }, 'une liste vide : un lieu sans indice ne la porte pas'],
    [{ ...AVEC, lieu: { ...BEAUNE, indices: [INDICES[0], 42] } }, 'un nombre'],
    [{ ...AVEC, etoilesAuxIndices: [3, 4] }, 'quatre étoiles en jeu'],
    [{ ...AVEC, etoilesAuxIndices: [] }, 'un barème vide'],
  ] as [unknown, string][]) assert.equal(lireLeDepart(JSON.stringify(depart([abime, AVEC, AVEC]))), null, pourquoi)
  // Leur barème se fige avec eux : une manche tirée sous un autre se rejoue au sien — son cartel, « Mes réponses » —,
  // quel que soit celui du jour.
  assert.deepEqual(AVEC.etoilesAuxIndices, ETOILES_AUX_INDICES_DE_L_EPINGLE)
  assert.equal('etoilesAuxIndices' in SANS, false)
  const dAvant = { ...AVEC, etoilesAuxIndices: [3, 3, 2] }
  assert.deepEqual(relu(dAvant), dAvant)
  assert.deepEqual([0, 1, 2].map(n => [R.juger(dAvant, apres(dAvant, n), planter(0)).naturel, R.montrer(dAvant, apres(dAvant, n)).enJeu]), [[3, 3], [3, 3], [2, 2]])
})

test('les mots des indices viennent du barème : le bouton, son nom à l’oreille, la révélation, l’annonce', () => {
  assert.deepEqual(motsDesIndicesDeLEpingle(0), { mot: 'Indice', cout: '−★', nom: 'Un indice, contre une étoile : la manche en vaudra deux au plus', revelation: null })
  assert.deepEqual(motsDesIndicesDeLEpingle(1), { mot: 'Indice', cout: '−★', nom: 'Un indice, contre une étoile : la manche en vaudra une au plus', revelation: 'Avec un indice : ★★ au plus.' })
  assert.equal(motsDesIndicesDeLEpingle(2).revelation, 'Avec deux indices : ★ au plus.')
  assert.match(JEUX.epingle.geste, /Un indice aide, et retire une étoile du jeu\.$/)
  assert.match(JEUX.epingle.bareme, /— un indice, ★★ au plus · deux indices, ★ au plus$/)
})

// ── Des faits à déduire, jamais une adresse ─────────────────────────────────

test('un indice raconte un fait : le juge refuse une distance, une durée de trajet, une direction — et la commune, et le département', () => {
  const avec = (indices: unknown) => refusDuLieu({ ...BEAUNE, indices })
  assert.equal(avec(INDICES), null, 'les deux indices du lieu se posent')
  // Ce que la première version écrivait, et que le propriétaire a refusé : « il n'y a plus aucune réflexion ».
  for (const adresse of [
    'À 170 km à l’ouest de Paris.',
    'À une centaine de kilomètres de la mer.',
    'En Normandie, à deux heures de route de la capitale.',
    'Au nord de la Loire, dans une plaine à blé.',
    'Dans le sud-est du pays, face à l’Italie.',
    'À l’est de la capitale, sur la route de l’Allemagne.',
    'Une ville à mi-chemin entre deux capitales régionales.',
  ]) {
    assert.match(String(avec([adresse, INDICES[1]])), /^son indice 1 : ni distance, ni durée de trajet, ni direction/, adresse)
    assert.match(String(avec([INDICES[0], adresse])), /^son indice 2 : ni distance/, adresse)
  }
  // Ce qui ressemble à une direction et n'en est pas une se pose : un verbe, un nom propre.
  for (const fait of ['La ville est de celles qui ont vu naître un roi de France.', 'Le journal Ouest-France y a longtemps eu sa plus grosse édition.', 'Le pôle Sud a ici son musée, celui d’un explorateur du pays.']) {
    assert.equal(avec([fait, INDICES[1]]), null, fait)
  }
  for (const [indices, refus, pourquoi] of [
    [undefined, /^il manque indices$/, 'un lieu sans indices'],
    ['Un fait.', /^ses indices : 2 textes/, 'un texte seul'],
    [[INDICES[0]], /^ses indices : 2 textes/, 'un seul indice'],
    [[...INDICES, 'Un troisième fait, de trop.'], /^ses indices : 2 textes/, 'trois indices : la manche n’a que deux étoiles à leur céder'],
    [[INDICES[0], INDICES[0]], /^ses indices : deux faits, pas deux fois le même$/, 'le même deux fois'],
    [[INDICES[0], 'Quelle ville se dit capitale des vins de Bourgogne ?'], /^son indice 2 : une phrase qui raconte un fait/, 'une question de plus'],
    [[INDICES[0], 'La ville se dit capitale des vins de Bourgogne'], /^son indice 2 : une phrase qui raconte un fait/, 'sans son point'],
    [[`${'Un duc très puissant, '.repeat(5)}et sa capitale.`, INDICES[1]], /^son indice 1 : \d+ signes, pour \d+ au plus$/, 'trop long pour ses trois lignes'],
    [['Les Hospices de Beaune vendent leurs vins aux enchères.', INDICES[1]], /^son indice 1 dit « Beaune »/, 'sa commune'],
    [[INDICES[0], 'Les vignes de la Côte-d’Or donnent ici de grands crus.'], /^son indice 2 dit « Côte-d'Or »/, 'son département'],
  ] as [unknown, RegExp, string][]) {
    const lieu = indices === undefined ? BEAUNE_D_AVANT : { ...BEAUNE, indices }
    assert.match(String(refusDuLieu(lieu)), refus, pourquoi)
  }
  assert.equal(INDICES_D_UN_LIEU, ETOILES_AUX_INDICES_DE_L_EPINGLE.length - 1, 'autant d’indices que d’étoiles à leur céder')
})

test('chaque lieu livré a ses deux indices, que le tirage fige avec lui', () => {
  const lieux = contenuDuCabinet().lieux
  for (const l of lieux) {
    assert.equal(l.indices?.length, INDICES_D_UN_LIEU, `${l.id} : ses indices`)
    for (const [i, indice] of l.indices!.entries()) {
      assert.ok(indice.length <= INDICE_DE_L_EPINGLE_MAX, `${l.id} : indice ${i + 1}, ${indice.length} signes`)
      // Invariant 1 : ni l'un ni l'autre avant le verdict — pas même « le nord » pour un lieu du Nord.
      for (const nom of [l.commune, l.departement]) assert.ok(!ecritDans(indice, nom), `${l.id} : son indice ${i + 1} dit « ${nom} »`)
    }
    assert.equal(refusDuLieu(l), null, l.id)
    const t = epingleTiree(l, toujours(0.5))
    assert.deepEqual([t.lieu.indices, t.etoilesAuxIndices], [l.indices, ETOILES_AUX_INDICES_DE_L_EPINGLE], l.id)
    assert.deepEqual([R.montrer(t, apres(t, 0)).aDemander, R.montrer(t, apres(t, 2)).indices], [INDICES_D_UN_LIEU, l.indices], l.id)
  }
  // Deux lieux ne partagent pas un indice : copié d'un voisin, il mènerait au mauvais endroit.
  const tous = lieux.flatMap(l => l.indices!)
  assert.equal(new Set(tous).size, tous.length, 'un indice écrit deux fois')
  // Que le tireur du serveur ne tire que de ces lieux-là, tels quels : `cabinet-jeux-neufs.test.ts`.
})

// ── Par les routes ──────────────────────────────────────────────────────────

test('par les routes : un indice à la fois, rien du suivant avant sa demande, et la manche jugée sous ce qu’ils laissent en jeu', async () => {
  const b = await bancDuCabinet()
  try {
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'epingle', carte: null }), 'l’Épingle')
    const t0 = epingleDe(b, v.id, 0)
    const [premier, second] = t0.lieu.indices!
    assert.ok(premier && second && premier !== second, 'le lieu tiré porte ses deux indices')
    const vue = () => v.enCours as EpingleMontree
    assert.deepEqual([vue().indices, vue().enJeu, vue().aDemander], [[], 3, 2])
    // Avant toute demande, la réponse du serveur n'écrit ni l'un ni l'autre.
    assert.ok(!JSON.stringify(v).includes(premier) && !JSON.stringify(v).includes(second))
    // Le premier, et pas un mot du second — la manche se joue encore, rien n'est tranché.
    const phase = v.phase
    v = ok(await unGeste(b, lea, v, { quoi: 'indice', manche: 0 }), 'un indice')
    assert.deepEqual([vue().indices, vue().enJeu, vue().aDemander, v.phase, v.manches[0].naturel ?? null], [[premier], 2, 1, phase, null])
    assert.ok(!JSON.stringify(v).includes(second), 'le second indice ne part qu’à sa demande')
    // Le second, puis plus rien : le refus se dit en mots, et la manche continue.
    v = ok(await unGeste(b, lea, v, { quoi: 'indice', manche: 0 }), 'le second')
    assert.deepEqual([vue().indices, vue().enJeu, vue().aDemander], [[premier, second], 1, 0])
    const deTrop = await unGeste(b, lea, v, { quoi: 'indice', manche: 0 })
    assert.deepEqual([deTrop.status, deTrop.corps], [400, { error: PLUS_D_INDICE }])
    // Ni la commune ni le département dans ce qu'il a reçu (invariant 1).
    for (const nom of [t0.lieu.commune, t0.lieu.departement]) for (const indice of vue().indices) assert.ok(!ecritDans(indice, nom), `« ${indice} » dit « ${nom} »`)
    // Sur le lieu même, avec ses deux indices : une étoile, et la révélation dit pourquoi.
    v = await jouerUneEpingle(b, lea, v, 0)
    assert.deepEqual([v.manches[0].naturel, (v.revelation?.corps as EpingleRevelee).indices], [1, [premier, second]])
    // Un seul à la manche suivante, à cinquante kilomètres : deux étoiles, celles de la distance.
    v = await ouvrirLaManche(b, lea, v, 1)
    assert.deepEqual(vue().indices, [], 'une manche neuve repart sans indice')
    v = ok(await unGeste(b, lea, v, { quoi: 'indice', manche: 1 }), 'un indice')
    v = await jouerUneEpingle(b, lea, v, 1, 50)
    assert.equal(v.manches[1].naturel, 2)
    // Aucun à la dernière, sur le lieu : ses trois étoiles, comme avant.
    v = await ouvrirLaManche(b, lea, v, 2)
    v = await jouerUneEpingle(b, lea, v, 2)
    assert.deepEqual([v.phase, v.bilan?.naturel, v.bilan?.total], ['finie', [1, 2, 3], 6])
  } finally {
    await b.banc.close()
  }
})

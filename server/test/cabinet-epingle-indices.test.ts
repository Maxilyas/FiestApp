// Les indices de l'Épingle (le 11 novembre 2026). Le jeu était le plus évité
// après la Frise — pris 19 fois sur cent quand la carte le proposait, un tiers
// de ses manches justes, 28 % à zéro étoile, du 1er au 8 novembre —, et le
// propriétaire : « l'épingle était aussi trop dur, c'est parfois des choses
// qu'on n'arrive pas à savoir. J'avais une idée d'avoir une sorte de texte qui
// se déroule au fur et à mesure et les étoiles baissent, mais qui donne de plus
// en plus d'indices précis sur la localisation. »
//
// Deux indices par lieu, demandés un à un : sa piste, écrite — le coin de
// France —, puis son repère, calculé — sa place dite par une ville de la carte,
// dans les mots mêmes où la page dit celle de l'épingle. Chacun retire une
// étoile de ce que la manche met en jeu ; la distance décide dessous. Ici : la
// règle pure, le repère de chaque lieu livré — vrai, sans sa commune ni son
// département, et qui mène à l'étoile —, puis par les routes : rien d'un indice
// ne part avant d'être demandé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import { bancDuCabinet, commencer, epingleDe, jouer as unGeste, jouerUneEpingle, ok, ouvrir as ouvrirLaManche } from './cabinet-banc'
import { departDe } from './cabinet-plans'
import { contenuDuCabinet, ecritDans } from '../src/core/cabinet/contenu'
import { indicesDuLieu, repereDuLieu } from '../src/core/cabinet/tirages/epingle'
import { ETOILES_AUX_INDICES_DE_L_EPINGLE, KM_DE_L_EPINGLE, PISTE_MAX } from '../../shared/cabinet/bareme'
import type { Lieu } from '../../shared/cabinet/contenu'
import { DANS_LA_FRANCE, distanceKm, type Point } from '../../shared/cabinet/france'
import { PAS_D_INDICE, PLUS_D_INDICE, REGLE_DE_L_EPINGLE, epingleTiree, etoilesEnJeu, pointADistance, type EpingleMontree, type EpingleRevelee, type EtatDeLEpingle } from '../../shared/cabinet/jeux/epingle'
import { JEUX, motsDesIndicesDeLEpingle, trancheLaManche } from '../../shared/cabinet/jeux/regle'
import { lireLeDepart } from '../../shared/cabinet/lecture'
import { VILLES_DE_LA_CARTE, faconsDeDireCePoint, ouEstCePoint } from '../../shared/cabinet/villesReperes'

const R = REGLE_DE_L_EPINGLE
const toujours = (x: number) => () => x
/** Un hasard qui ne doit pas servir : ni un indice ni son jugement ne tirent rien. */
const SANS_HASARD = () => {
  throw new Error('un indice a tiré au hasard')
}

const BEAUNE: Lieu = {
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
  piste: 'En Bourgogne, à mi-chemin entre Paris et Lyon.',
  savais: 'Ses vins sont vendus aux enchères depuis 1859.',
  categorie: 'Arts & lettres',
}
const INDICES = ['En Bourgogne, à mi-chemin entre Paris et Lyon.', 'À 140 km au nord de Lyon.']
const AVEC = epingleTiree(BEAUNE, toujours(0.5), INDICES)
/** Un tirage d'avant les indices : une partie commencée avant eux, que le pli rejoue. */
const SANS = epingleTiree(BEAUNE, toujours(0.5))
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
  // Le repère ne part pas avec la piste : rien de la vue d'un premier indice ne l'écrit.
  assert.ok(!JSON.stringify(montree(1)).includes(INDICES[1]))
  assert.ok(!JSON.stringify(montree(0)).includes(INDICES[0]))
  const v = R.juger(AVEC, apres(AVEC, 1), planter(10))
  assert.deepEqual((R.reveler(AVEC, apres(AVEC, 1), v) as EpingleRevelee).indices, [INDICES[0]])
  // Un tirage d'avant : aucun indice à montrer ni à demander, et la page n'a pas de bouton à poser.
  assert.deepEqual([R.montrer(SANS, R.ouvrir(SANS)).indices, R.montrer(SANS, R.ouvrir(SANS)).aDemander, R.montrer(SANS, R.ouvrir(SANS)).enJeu], [[], 0, 3])
})

test('les indices se figent dans le tirage, et se relisent tels quels — un tirage d’avant se relit sans', () => {
  // Un départ comme le serveur l'écrit (`departDe`, `cabinet-plans.ts`), ses trois tirages remplacés.
  const depart = (tirages: unknown[]) => ({ ...departDe('epingle'), tirages })
  const relu = (t: unknown) => lireLeDepart(JSON.stringify(depart([t, t, t])))?.tirages[0]
  // Lu d'abord tel que le serveur l'écrit : sans cela, ce qui suit ne prouverait rien.
  assert.deepEqual(relu(AVEC), AVEC, 'un tirage et ses indices')
  assert.deepEqual(relu(SANS), SANS, 'un tirage d’avant le 11 novembre 2026')
  assert.equal('indices' in (relu(SANS) as object), false)
  // Un lieu d'avant sa piste se relit aussi : la partie en route à la mise en ligne ne se perd pas.
  const { piste: _, ...sansPiste } = BEAUNE
  assert.deepEqual(relu({ ...SANS, lieu: sansPiste }), { ...SANS, lieu: sansPiste })
  for (const [abime, pourquoi] of [
    [{ ...AVEC, indices: 'En Bourgogne.' }, 'un texte seul'],
    [{ ...AVEC, indices: [] }, 'une liste vide : un tirage sans indice ne la porte pas'],
    [{ ...AVEC, indices: [INDICES[0], 42] }, 'un nombre'],
    [{ ...AVEC, lieu: { ...BEAUNE, piste: 7 } }, 'une piste qui n’est pas un texte'],
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
  assert.deepEqual(motsDesIndicesDeLEpingle(0), { bouton: 'Indice −★', nom: 'Un indice, contre une étoile : la manche en vaudra deux au plus', revelation: null })
  assert.deepEqual(motsDesIndicesDeLEpingle(1), { bouton: 'Indice −★', nom: 'Un indice, contre une étoile : la manche en vaudra une au plus', revelation: 'Avec un indice : ★★ au plus.' })
  assert.equal(motsDesIndicesDeLEpingle(2).revelation, 'Avec deux indices : ★ au plus.')
  assert.match(JEUX.epingle.geste, /Un indice aide, et retire une étoile du jeu\.$/)
  assert.match(JEUX.epingle.bareme, /— un indice, ★★ au plus · deux indices, ★ au plus$/)
})

// ── Le repère, calculé ──────────────────────────────────────────────────────

/** Ce que la page dirait d'une épingle posée en chaque point d'un quadrillage de la France, tous les dixièmes de degré. */
function quadrillage(): Map<string, Point[]> {
  const parTexte = new Map<string, Point[]>()
  for (let lat = DANS_LA_FRANCE.latMin; lat <= DANS_LA_FRANCE.latMax; lat += 0.1) {
    for (let lon = DANS_LA_FRANCE.lonMin; lon <= DANS_LA_FRANCE.lonMax; lon += 0.1) {
      const p = { lat, lon }
      const texte = ouEstCePoint(p)
      parTexte.set(texte, [...(parTexte.get(texte) ?? []), p])
    }
  }
  return parTexte
}

test('le repère d’un lieu livré : sa place dans les mots de l’épingle, sans sa commune ni son département — et y mener l’épingle vaut l’étoile', () => {
  const lieux = contenuDuCabinet().lieux
  const ouOnDit = quadrillage()
  let ditsAutrement = 0
  for (const l of lieux) {
    const repere = repereDuLieu(l)
    assert.ok(repere, `${l.id} : un repère`)
    assert.ok(repere.length <= PISTE_MAX, `${l.id} : ${repere.length} signes — il se lit sur la ligne de l’épingle`)
    // Invariant 1 : ni l'un ni l'autre avant le verdict — pas même « au nord » pour un lieu du Nord.
    for (const nom of [l.commune, l.departement]) assert.ok(!ecritDans(repere, nom), `${l.id} : son repère dit « ${nom} »`)
    // C'est une des façons de dire ce point, la première qui se peut : vraie par construction, jamais écrite à la main.
    const facons = faconsDeDireCePoint(l).map(f => `${f}.`)
    const rang = facons.indexOf(repere)
    assert.ok(rang >= 0, `${l.id} : « ${repere} » n’est pas une façon de dire ce point`)
    for (const avant of facons.slice(0, rang)) assert.ok(ecritDans(avant, l.commune) || ecritDans(avant, l.departement), `${l.id} : « ${avant} » passait devant`)
    if (rang > 0) ditsAutrement++
    assert.deepEqual(indicesDuLieu(l), [l.piste, repere], `${l.id} : sa piste, puis son repère`)
    // La promesse du second indice : l'épingle menée là où la page dit la même chose que lui tombe à moins de trois cents
    // kilomètres — l'étoile qu'il laisse en jeu. Un repère dit par la première façon se retrouve sur le quadrillage.
    if (rang === 0) {
      const ici = ouOnDit.get(facons[0].slice(0, -1)) ?? []
      for (const p of ici) assert.ok(distanceKm(p, l) < KM_DE_L_EPINGLE[2], `${l.id} : « ${repere} » se dit aussi à ${Math.round(distanceKm(p, l))} km de lui`)
    }
  }
  // Les lieux d'une ville de la carte, et ceux du Nord que tout situe « au nord » : une poignée, pas la règle.
  assert.ok(ditsAutrement > 0 && ditsAutrement <= lieux.length / 10, `${ditsAutrement} lieux dits autrement, sur ${lieux.length}`)
})

test('le repère ne dit jamais la réponse par un détour : une ville de la carte qui est la commune, « au nord » pour le Nord', () => {
  const lieuA = (ville: string, o: Partial<Lieu> = {}): Lieu => {
    const v = VILLES_DE_LA_CARTE.find(x => x.nom === ville)!
    return { ...BEAUNE, id: `essai-${ville.toLowerCase()}`, commune: ville, departement: 'Essai', lat: v.lat + 0.011, lon: v.lon + 0.011, ...o }
  }
  // Chaque ville de la carte : un lieu dans ses murs se dit par une autre.
  for (const v of VILLES_DE_LA_CARTE) {
    const repere = repereDuLieu(lieuA(v.nom))!
    assert.equal(ouEstCePoint(lieuA(v.nom)), `Près de ${v.nom}`)
    assert.ok(!ecritDans(repere, v.nom), `${v.nom} : « ${repere} »`)
    assert.match(repere, /^À \d+ km .+ de \p{Lu}\p{L}+\.$/u, `${v.nom} : par une autre ville, sa distance et sa direction`)
  }
  // Paris, commune et département : même règle. Un voisin, lui, se dit près d'elle.
  assert.ok(!ecritDans(repereDuLieu(lieuA('Paris', { departement: 'Paris' }))!, 'Paris'))
  assert.equal(repereDuLieu(lieuA('Lyon', { commune: 'Villeurbanne', departement: 'Rhône' })), 'Près de Lyon.')
  // Un lieu du Nord, hors de Lille : toute direction depuis une ville plus au sud écrit son département. Deux distances, sans direction.
  const bergues = { ...BEAUNE, id: 'essai-bergues', commune: 'Bergues', departement: 'Nord', lat: 50.968, lon: 2.433 }
  assert.match(ouEstCePoint(bergues), /nord/)
  const repere = repereDuLieu(bergues)!
  assert.match(repere, /^À \d+ km de Lille et à \d+ km de Paris\.$/)
  assert.ok(!ecritDans(repere, 'Nord'))
})

// ── Par les routes ──────────────────────────────────────────────────────────

test('par les routes : un indice à la fois, rien du suivant avant sa demande, et la manche jugée sous ce qu’ils laissent en jeu', async () => {
  const b = await bancDuCabinet()
  try {
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'epingle', carte: null }), 'l’Épingle')
    const t0 = epingleDe(b, v.id, 0)
    const [piste, repere] = t0.indices!
    assert.deepEqual([piste, repere], [t0.lieu.piste, repereDuLieu(t0.lieu)])
    const vue = () => v.enCours as EpingleMontree
    assert.deepEqual([vue().indices, vue().enJeu, vue().aDemander], [[], 3, 2])
    // Avant toute demande, la réponse du serveur n'écrit ni l'un ni l'autre.
    assert.ok(!JSON.stringify(v).includes(piste) && !JSON.stringify(v).includes(repere))
    // Le premier : la piste, et pas un mot du repère — la manche se joue encore, rien n'est tranché.
    const phase = v.phase
    v = ok(await unGeste(b, lea, v, { quoi: 'indice', manche: 0 }), 'un indice')
    assert.deepEqual([vue().indices, vue().enJeu, vue().aDemander, v.phase, v.manches[0].naturel ?? null], [[piste], 2, 1, phase, null])
    assert.ok(!JSON.stringify(v).includes(repere), 'le second indice ne part qu’à sa demande')
    // Le second, puis plus rien : le refus se dit en mots, et la manche continue.
    v = ok(await unGeste(b, lea, v, { quoi: 'indice', manche: 0 }), 'le second')
    assert.deepEqual([vue().indices, vue().enJeu, vue().aDemander], [[piste, repere], 1, 0])
    const deTrop = await unGeste(b, lea, v, { quoi: 'indice', manche: 0 })
    assert.deepEqual([deTrop.status, deTrop.corps], [400, { error: PLUS_D_INDICE }])
    // Ni la commune ni le département dans ce qu'il a reçu (invariant 1).
    for (const nom of [t0.lieu.commune, t0.lieu.departement]) for (const indice of vue().indices) assert.ok(!ecritDans(indice, nom), `« ${indice} » dit « ${nom} »`)
    // Sur le lieu même, avec ses deux indices : une étoile, et la révélation dit pourquoi.
    v = await jouerUneEpingle(b, lea, v, 0)
    assert.deepEqual([v.manches[0].naturel, (v.revelation?.corps as EpingleRevelee).indices], [1, [piste, repere]])
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

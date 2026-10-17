// La carte d'un acte de l'Expédition (`carteDUnActe`, `shared/expedition.ts`) :
// tirée de la graine, la même graine redonne la même carte ; cinq chemins qui
// ne se croisent jamais ; chaque escale mène à un campement ; une source au
// moins ; les proportions du brief, sur des milliers de graines. Et ce que la
// page en lit : la chance d'arriver, le tracé le plus sûr, les gardiens.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTES,
  COLONNES,
  ETAGES,
  GARDIEN,
  MARCHES_DES_ACTES,
  auGardien,
  carteDUnActe,
  chanceDeVaincre,
  chanceSelonLaForme,
  chancesDuTrace,
  escalesAtteignables,
  gardienAuFeminin,
  gardiensDe,
  graineDe,
  leGardien,
  marcheDe,
  nomDuGardien,
  numeroDeLaCarte,
  traceLePlusSur,
  viesAuBout,
  type CarteDUnActe,
} from '../../shared/expedition'
import { CATEGORIES } from '../../shared/categories'
import { hasardDe } from '../../shared/missions'
import { LEGENDAIRES } from '../../shared/legendaires'
import { LEGENDAIRES_A_JOKER } from '../../shared/jokers'

const SUJETS = ['annees-80', 'astronomie', 'pieges']

/** Tous les tracés d'ici à un campement, comptés un à un. */
function tousLesTraces(carte: CarteDUnActe, ici: string | null = null): string[][] {
  const tous: string[][] = []
  const explorer = (t: string[]) => {
    const dernier = t.length ? t[t.length - 1] : ici
    const e = dernier ? carte.escales.find(x => x.id === dernier) : null
    if (e?.sorte === 'campement') return tous.push(t)
    for (const id of dernier === null ? carte.depart : e!.suite) if (id !== GARDIEN) explorer([...t, id])
  }
  explorer([])
  return tous
}

/** Les escales d'où l'on atteint un campement, en remontant les liens. */
function versUnCampement(carte: CarteDUnActe): Set<string> {
  const ok = new Set(carte.escales.filter(e => e.sorte === 'campement').map(e => e.id))
  for (let tour = 0; tour < ETAGES + 2; tour++) for (const e of carte.escales) if (e.suite.some(id => ok.has(id))) ok.add(e.id)
  return ok
}

test('la même graine redonne la même carte ; une autre, une autre carte', () => {
  assert.deepEqual(carteDUnActe('lea:0', 0, SUJETS), carteDUnActe('lea:0', 0, SUJETS))
  assert.notDeepEqual(carteDUnActe('lea:0', 0, SUJETS), carteDUnActe('lea:1', 0, SUJETS))
  assert.notDeepEqual(carteDUnActe('lea:0', 0, SUJETS), carteDUnActe('lea:0', 1, SUJETS), 'chaque acte a la sienne')
  assert.equal(numeroDeLaCarte('lea:0'), numeroDeLaCarte('lea:0'))
  assert.ok(numeroDeLaCarte('lea:0') >= 10_000 && numeroDeLaCarte('lea:0') < 100_000)
  assert.equal(graineDe('lea', 3), 'lea:3')
})

test('sur deux mille cartes : des chemins qui ne se croisent pas, chaque escale vers un campement, une source et un coffre au moins, le premier étage en questions', () => {
  const comptes = new Map<string, number>()
  let escales = 0
  let melanges = 0
  let pointus = 0
  let questions = 0
  const formesDuBas = new Map<string, number>()
  const formesDuHaut = new Map<string, number>()
  for (let i = 0; i < 2000; i++) {
    const carte = carteDUnActe(`essai:${i}`, i % ACTES, SUJETS)
    const parId = new Map(carte.escales.map(e => [e.id, e]))
    // Deux pas d'un étage qui se croisent — c vers c+1, c+1 vers c — feraient un X illisible.
    for (const e of carte.escales) {
      for (const id of e.suite) {
        const s = parId.get(id)
        assert.ok(s, `${e.id} mène à ${id}, qui existe`)
        if (e.etage < ETAGES - 1) {
          assert.equal(s.etage, e.etage + 1)
          assert.ok(Math.abs(s.colonne - e.colonne) <= 1, 'une colonne voisine au plus')
          const croise = carte.escales.some(o => o.etage === e.etage && o.colonne === s.colonne && o.suite.includes(`e${e.etage + 1}${e.colonne}`) && s.colonne !== e.colonne)
          assert.ok(!croise, `carte ${i} : deux chemins se croisent à l’étage ${e.etage}`)
        }
      }
    }
    const atteint = versUnCampement(carte)
    for (const e of carte.escales) if (e.sorte !== 'gardien') assert.ok(atteint.has(e.id), `carte ${i} : ${e.id} mène à un campement`)
    assert.ok(carte.depart.length >= 1 && carte.depart.every(id => parId.get(id)?.etage === 0))
    assert.ok(carte.escales.some(e => e.sorte === 'source'), `carte ${i} : une source au moins`)
    assert.ok(carte.escales.some(e => e.sorte === 'coffre'), `carte ${i} : un coffre au moins`)
    assert.ok(carte.escales.some(e => e.sorte === 'campement'))
    assert.equal(carte.escales.filter(e => e.sorte === 'gardien').length, 1)
    assert.ok(carte.escales.filter(e => e.etage === 0).every(e => e.sorte === 'question' && e.theme && 'categories' in e.theme && e.theme.categories.length === 1))
    for (const e of carte.escales) {
      if (e.etage >= ETAGES) continue
      assert.ok(e.colonne >= 0 && e.colonne < COLONNES)
      escales++
      comptes.set(e.sorte, (comptes.get(e.sorte) ?? 0) + 1)
      if (e.sorte === 'elite') {
        assert.ok(e.etage >= 2, 'une élite, dès le troisième étage')
        assert.ok(e.theme && e.forme)
      }
      if (e.sorte === 'coffre' || e.sorte === 'source') assert.ok(!e.theme && !e.forme, 'un coffre, une source n’ont ni thème ni forme')
      // Les formes (l'étape 3) : le premier étage à quatre choix ou en vrai ou faux, les autres de toutes les formes.
      if (e.sorte === 'question' || e.sorte === 'elite') {
        const etage = e.etage === 0 ? formesDuBas : formesDuHaut
        etage.set(e.forme!, (etage.get(e.forme!) ?? 0) + 1)
        if (e.etage === 0) assert.ok(e.forme === 'quatre' || e.forme === 'vrai-faux', `${e.id} : ${e.forme} au premier étage`)
      }
      if (e.sorte === 'question') {
        questions++
        assert.ok(e.theme, `${e.id} a un thème`)
        if (e.theme && 'sujet' in e.theme) {
          pointus++
          assert.ok(SUJETS.includes(e.theme.sujet))
        } else if (e.theme && e.theme.categories.length > 1) {
          melanges++
          assert.ok(e.theme.categories.length <= 3 && new Set(e.theme.categories).size === e.theme.categories.length)
          assert.ok(e.theme.categories.every(c => (CATEGORIES as readonly string[]).includes(c)))
        }
      }
    }
  }
  // Avant les écus (l'étape 4), l'échoppe et l'inconnu deviennent des questions ; les élites et les coffres sont venus avec les jokers.
  assert.deepEqual([...comptes.keys()].sort(), ['coffre', 'elite', 'question', 'source'])
  const part = (n: number, sur: number) => n / sur
  // Sur deux mille cartes, le 17 octobre 2026 : 9 % de sources, 10 % de coffres, 6 % d'élites.
  assert.ok(part(comptes.get('source')!, escales) > 0.06 && part(comptes.get('source')!, escales) < 0.14, `sources : ${part(comptes.get('source')!, escales)}`)
  assert.ok(part(comptes.get('coffre')!, escales) > 0.07 && part(comptes.get('coffre')!, escales) < 0.15, `coffres : ${part(comptes.get('coffre')!, escales)}`)
  assert.ok(part(comptes.get('elite')!, escales) > 0.03 && part(comptes.get('elite')!, escales) < 0.1, `élites : ${part(comptes.get('elite')!, escales)}`)
  assert.ok(part(melanges, questions) > 0.1 && part(melanges, questions) < 0.2, `mélanges : ${part(melanges, questions)}`)
  assert.ok(part(pointus, questions) > 0.07 && part(pointus, questions) < 0.16, `thèmes pointus : ${part(pointus, questions)}`)
  // Les formes (l'étape 3, `POIDS_DES_FORMES`) : le premier étage pose un vrai ou faux trois fois sur dix ; au-dessus, quatre
  // choix 40 %, les trois autres 20 % chacune — et l'échoppe et l'inconnu, devenus des questions avant les écus, à quatre choix.
  const sur = (m: Map<string, number>) => [...m.values()].reduce((s, n) => s + n, 0)
  assert.ok(part(formesDuBas.get('vrai-faux') ?? 0, sur(formesDuBas)) > 0.2 && part(formesDuBas.get('vrai-faux') ?? 0, sur(formesDuBas)) < 0.4, `vrai ou faux en bas : ${part(formesDuBas.get('vrai-faux') ?? 0, sur(formesDuBas))}`)
  for (const forme of ['vrai-faux', 'six', 'devoilement']) {
    const p = part(formesDuHaut.get(forme) ?? 0, sur(formesDuHaut))
    assert.ok(p > 0.1 && p < 0.25, `${forme} au-dessus : ${p}`)
  }
  assert.ok(part(formesDuHaut.get('quatre') ?? 0, sur(formesDuHaut)) > 0.4, `quatre choix au-dessus : ${part(formesDuHaut.get('quatre') ?? 0, sur(formesDuHaut))}`)
})

test('sans thème pointu à tirer, la carte n’en pose aucun', () => {
  for (let i = 0; i < 200; i++) {
    const carte = carteDUnActe(`sans:${i}`, 0, [])
    assert.ok(carte.escales.every(e => !e.theme || 'categories' in e.theme))
  }
})

test('les marches des actes : facile, puis moyenne, puis difficile — jamais d’experte ; le gardien demande quatre, trois, trois', () => {
  assert.deepEqual(
    MARCHES_DES_ACTES.map(m => [m.bas, m.haut, m.gardien, m.aTrouver]),
    [
      ['facile', 'facile', 'facile', 4],
      ['facile', 'moyen', 'moyen', 3],
      ['moyen', 'moyen', 'difficile', 3],
    ],
  )
  assert.ok(MARCHES_DES_ACTES.every(m => m.bas !== 'expert' && m.haut !== 'expert' && m.elite !== 'expert' && m.gardien !== 'expert'))
  assert.equal(marcheDe(1, { sorte: 'question', etage: 2 }), 'facile')
  assert.equal(marcheDe(1, { sorte: 'question', etage: 3 }), 'moyen')
  assert.equal(marcheDe(1, { sorte: 'gardien', etage: 7 }), 'moyen')
})

test('la chance d’une forme, de vaincre un gardien, d’arriver : ce que la page calcule', () => {
  // Le savoir se lit sous le hasard d'un sur quatre ; un vrai ou faux en donne un sur deux, six choix un sur six.
  assert.equal(chanceSelonLaForme(0.55, 'quatre'), 0.55)
  assert.ok(Math.abs(chanceSelonLaForme(0.25, 'vrai-faux') - 0.5) < 1e-9)
  assert.ok(Math.abs(chanceSelonLaForme(0.25, 'six') - 1 / 6) < 1e-9)
  assert.ok(Math.abs(chanceSelonLaForme(1, 'six') - 1) < 1e-9)
  // Vaincre : trouver n fois avant de rater autant de fois qu'on a de vies.
  assert.equal(chanceDeVaincre(1, 4, 1), 1)
  assert.equal(chanceDeVaincre(0, 4, 3), 0)
  assert.ok(Math.abs(chanceDeVaincre(0.5, 1, 1) - 0.5) < 1e-9)
  assert.ok(Math.abs(chanceDeVaincre(0.5, 1, 2) - 0.75) < 1e-9, 'une chance de plus à la seconde vie')
  assert.ok(chanceDeVaincre(0.7, 4, 3) > chanceDeVaincre(0.7, 4, 2))
  // Le hasard de chanceDeVaincre, rejoué : trouver n fois avant v erreurs.
  let gagne = 0
  const r = hasardDe('vaincre')
  for (let i = 0; i < 40_000; i++) {
    let trouvees = 0
    let ratees = 0
    while (trouvees < 3 && ratees < 2) r() < 0.6 ? trouvees++ : ratees++
    if (trouvees === 3) gagne++
  }
  assert.ok(Math.abs(gagne / 40_000 - chanceDeVaincre(0.6, 3, 2)) < 0.01)

  const carte = carteDUnActe('trace:1', 0, SUJETS)
  for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'source') e.chance = 0.8
  carte.chanceDuGardien = 0.9
  const trace = traceLePlusSur(carte, null, 3, 0)
  assert.equal(carte.escales.find(e => e.id === trace[trace.length - 1])?.sorte, 'campement', 'le tracé finit au campement')
  assert.ok(carte.depart.includes(trace[0]))
  for (let i = 1; i < trace.length; i++) assert.ok(carte.escales.find(e => e.id === trace[i - 1])!.suite.includes(trace[i]), 'il suit les liens')
  // Une vie de plus au campement, jamais plus de trois.
  const campement = carte.escales.find(e => e.sorte === 'campement')!.id
  assert.deepEqual(viesAuBout(carte, [campement], 2), [0, 0, 0, 1])
  assert.deepEqual(viesAuBout(carte, [campement], 3), [0, 0, 0, 1])
  const { arriver, vaincre } = chancesDuTrace(carte, trace, 3, 0)
  assert.ok(arriver > 0.9 && vaincre <= arriver)
  // Le plus sûr : aucun autre tracé ne fait mieux.
  for (const t of tousLesTraces(carte)) assert.ok(chancesDuTrace(carte, t, 3, 0).vaincre <= vaincre + 1e-9)
})

test('une escale touchée redessine le tracé : il passe par elle, garde le début choisi, et reste le plus sûr ainsi', () => {
  const carte = carteDUnActe('trace:2', 1, SUJETS)
  const r = hasardDe('chances:2')
  for (const e of carte.escales) if (e.sorte === 'question' || e.sorte === 'source') e.chance = 0.35 + 0.6 * r()
  carte.chanceDuGardien = 0.7
  const tous = tousLesTraces(carte)
  const vaincre = (t: readonly string[]) => chancesDuTrace(carte, t, 2, 1).vaincre
  for (const par of new Set(tous.flat())) {
    const t = traceLePlusSur(carte, null, 2, 1, { par })
    assert.ok(t.includes(par), `il passe par ${par}`)
    const meilleur = Math.max(...tous.filter(x => x.includes(par)).map(vaincre))
    assert.ok(Math.abs(vaincre(t) - meilleur) < 1e-9, `le plus sûr par ${par}`)
  }
  // Le début qu'il a choisi reste le sien, la suite est la plus sûre après lui.
  const debut = tous[tous.length - 1].slice(0, 2)
  const t = traceLePlusSur(carte, null, 2, 1, { debut })
  assert.deepEqual(t.slice(0, 2), debut)
  const meilleur = Math.max(...tous.filter(x => x[0] === debut[0] && x[1] === debut[1]).map(vaincre))
  assert.ok(Math.abs(vaincre(t) - meilleur) < 1e-9)
  // D'une escale du milieu, rien en dessous d'elle : aucun tracé n'y retourne.
  const milieu = carte.escales.find(e => e.etage === 3)!
  const dessous = carte.escales.find(e => e.etage === 1)!
  assert.deepEqual(traceLePlusSur(carte, milieu.id, 2, 1, { par: dessous.id }), [])
  // Au campement, plus rien à tracer : le gardien attend.
  assert.deepEqual(traceLePlusSur(carte, carte.escales.find(e => e.sorte === 'campement')!.id, 2, 1), [])
})

test('ce qu’il peut encore atteindre : d’en bas, toute la carte ; d’une escale, ce qui monte d’elle', () => {
  const carte = carteDUnActe('atteint:1', 0, SUJETS)
  assert.equal(escalesAtteignables(carte, null).size, carte.escales.length, 'chaque escale est au bout d’un chemin qui part d’en bas')
  const e = carte.escales.find(x => x.etage === 3)!
  const d = escalesAtteignables(carte, e.id)
  assert.ok(!d.has(e.id) && d.has(GARDIEN))
  for (const id of d) assert.ok(carte.escales.find(x => x.id === id)!.etage > e.etage, `${id} est au-dessus de ${e.id}`)
  assert.deepEqual([...escalesAtteignables(carte, GARDIEN)], [], 'le gardien : rien après lui')
})

test('le nom d’un gardien dans une phrase : « vers le Kraken », « arriver à la Chouette », « la Comète est vaincue »', () => {
  assert.deepEqual(
    ['lg:kraken', 'lg:chouette', 'lg:oracle', 'lg:janus'].map(leGardien),
    ['le Kraken', 'la Chouette d’Argent', 'l’Oracle', 'Janus'],
  )
  assert.deepEqual(
    ['lg:kraken', 'lg:chouette', 'lg:oracle', 'lg:janus'].map(auGardien),
    ['au Kraken', 'à la Chouette d’Argent', 'à l’Oracle', 'à Janus'],
  )
  assert.deepEqual(['lg:comete', 'lg:kraken', 'lg:oracle'].map(gardienAuFeminin), [true, false, false])
  // Chaque gardien possible commence par un article que la page sait accorder, ou c'est un nom propre.
  for (const cle of LEGENDAIRES_A_JOKER) assert.match(nomDuGardien(cle), /^(Le |La |L’|Janus$)/, cle)
})

test('trois gardiens qu’il n’a pas, qui ont leur joker, jamais de saison ; il les a presque tous : les siens complètent', () => {
  const gardiens = gardiensDe('lea:0', new Set())
  assert.equal(new Set(gardiens).size, 3)
  for (const g of gardiens) {
    assert.ok(LEGENDAIRES_A_JOKER.includes(g))
    assert.equal(LEGENDAIRES.find(l => l.key === g)?.saison, undefined)
  }
  assert.deepEqual(gardiensDe('lea:0', new Set()), gardiens, 'la même graine, les mêmes gardiens')
  // Il les a tous sauf un : celui-là d'abord, puis deux des siens.
  const possibles = LEGENDAIRES.filter(l => LEGENDAIRES_A_JOKER.includes(l.key) && !l.saison).map(l => l.key)
  const tousSaufUn = new Set(possibles.slice(1))
  const g2 = gardiensDe('lea:0', tousSaufUn)
  assert.equal(g2[0], possibles[0])
  assert.equal(g2.length, 3)
})

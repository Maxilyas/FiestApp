// La traversée du Cabinet jouée en pur (`shared/cabinet/traversee.ts`) : les
// dix cartes et leurs phrases, les gardiens, la carte de trois actes tracée au
// départ, le pli de ses gestes — l'or, les cœurs, la Parade, la mise, le
// Second souffle, le coffre, le marchand, les assauts contre un gardien, le
// légendaire au bout —, et ce qui s'en relit. L'épreuve elle-même est une
// partie du Cabinet (`cabinet-regles.test.ts`) : ici, ses étoiles seulement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as B from '../../shared/cabinet/bareme'
import { legendaire } from '../../shared/legendaires'
import { voieDuGardien } from '../../shared/cabinet/salles'
import { CATEGORIES } from '../../shared/categories'
import { lireLeDepart } from '../../shared/cabinet/lecture'
import { chronoDuDepart, etoilesDesManches, pliDeLaPartie, refusDuGeste, type DepartDUnePartie } from '../../shared/cabinet/partie'
import {
  AMELIORE_D_ABORD,
  CARTES,
  CARTES_DEJA_CHOISIES,
  CARTE_AU_PLUS_HAUT,
  CHOISIS_D_ABORD,
  CHOISIS_TROIS_CARTES,
  CLES_DES_CARTES,
  COEURS_AU_COMPLET,
  EPREUVE_EN_COURS,
  ETAPE_A_JOUER,
  GARDIENS_DES_ACTES,
  GARDIENS_DE_LA_TRAVERSEE,
  GARDIEN_D_HALLOWEEN,
  LE_GARDIEN_T_ATTEND,
  PAS_ASSEZ_D_OR,
  PAS_PAR_LA,
  RANGEE_DU_GARDIEN,
  RANGEE_DU_MARCHAND,
  atteignables,
  carteDeLaTraversee,
  cartesDeLEpreuve,
  choisirLesGardiens,
  coeursMax,
  consequencesDe,
  departDeLActe,
  etapeDe,
  etatDeLaTraversee,
  idDEtape,
  jeuDeLAssaut,
  jouerUnGesteDeLaTraversee,
  lireLeDepartDeLaTraversee,
  lireLesCartesChoisies,
  lireUnGesteDeLaTraversee,
  nomAuNiveau,
  prixAuMarchand,
  pvDuGardien,
  tracerLaCarte,
  viseeDeLEtape,
  type CleDeCarte,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraversee,
  type MancheConclue,
} from '../../shared/cabinet/traversee'
import { JOUR, MIDI, S, departDe, ouvrir } from './cabinet-plans'

/** Un hasard qui se rejoue : la carte d'un essai est toujours la même. */
function graine(n: number): () => number {
  let x = n >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 1_000_000) / 1_000_000
  }
}

const THEMES = { epingle: ['Les grands sièges', 'La France sauvage', 'Terres d’écrivains', 'Savants et ingénieurs'], frise: ['L’aviation', 'Rome', 'La médecine'] }
const GARDIENS: [string, string, string] = ['lg:renard', 'lg:sphinx', 'lg:dragon']

function departDeLaTraversee(n = 7): DepartDeLaTraversee {
  return { v: 1, jour: JOUR, actes: tracerLaCarte(graine(n), GARDIENS, THEMES) }
}

/** Une traversée qu'on joue geste à geste : chaque geste accepté s'écrit, comme au serveur — ses cartes choisies d'abord. */
class Traversee {
  etat: EtatDeLaTraversee
  gestes: { geste: GesteDeLaTraversee; faitLe: number }[] = []
  t = MIDI
  n = 0
  readonly depart: DepartDeLaTraversee
  constructor(cartes: CleDeCarte[], n = 7) {
    this.depart = departDeLaTraversee(n)
    this.etat = etatDeLaTraversee(this.depart, [])
    this.joue({ quoi: 'cartes', cartes })
  }
  joue(geste: GesteDeLaTraversee): EtatDeLaTraversee {
    this.t += S
    const r = jouerUnGesteDeLaTraversee(this.depart, this.etat, geste, this.t)
    assert.ok(typeof r !== 'string', `${JSON.stringify(geste)} refusé : ${r}`)
    this.etat = r
    this.gestes.push({ geste, faitLe: this.t })
    return r
  }
  refuse(geste: GesteDeLaTraversee): string {
    const r = jouerUnGesteDeLaTraversee(this.depart, this.etat, geste, this.t)
    assert.ok(typeof r === 'string', `${JSON.stringify(geste)} aurait dû se refuser`)
    return r
  }
  /** La première étape où il peut aller, d'une sorte donnée. */
  vers(sorte: 'epreuve' | 'coffre' | 'marchand' | 'gardien'): string {
    const id = atteignables(this.depart, this.etat).find(x => etapeDe(this.depart, x)?.sorte === sorte)
    assert.ok(id, `aucune étape « ${sorte} » atteignable depuis ${this.etat.position}`)
    return id
  }
  /** Une épreuve jouée de bout en bout : la partie commence, puis rend ces étoiles. */
  epreuve(etoiles: (number | null)[], misees: boolean[] = [], etape = this.vers('epreuve')): EtatDeLaTraversee {
    const partie = `p${++this.n}`
    this.joue({ quoi: 'epreuve', etape, partie })
    return this.joue({ quoi: 'conclure', partie, manches: manches(etoiles, misees) })
  }
}

const manches = (etoiles: (number | null)[], misees: boolean[] = []): MancheConclue[] => etoiles.map((e, k) => ({ etoiles: e, misee: misees[k] === true }))

/** Une épreuve de chaque rangée jusqu'au marchand, sans coffre si possible : la carte se traverse. */
function jusquAuMarchand(t: Traversee) {
  while (etapeDe(t.depart, t.etat.position)!.rangee < B.RANGEES_D_UN_ACTE) {
    const ids = atteignables(t.depart, t.etat)
    const epreuve = ids.find(x => etapeDe(t.depart, x)?.sorte === 'epreuve')
    if (epreuve) t.epreuve([2, 2, 2], [], epreuve)
    else t.joue({ quoi: 'aller', etape: ids[0] })
    // Un coffre ouvert attend son amélioration avant le pas suivant.
    if (t.etat.ameliorations > 0) t.joue({ quoi: 'ameliorer', carte: t.etat.cartes.find(c => c.niveau < 3)!.cle })
  }
  t.joue({ quoi: 'aller', etape: t.vers('marchand') })
}

test('les dix cartes : une clé chacune, une phrase à chaque niveau, lue par une Map', () => {
  assert.equal(CARTES.length, 10)
  assert.equal(new Set(CLES_DES_CARTES).size, 10)
  for (const c of CARTES) {
    for (const n of [1, 2, 3] as const) {
      const dit = c.dit(n)
      assert.doesNotMatch(dit, /undefined|NaN|null/, `${c.cle} au niveau ${n} : ${dit}`)
      assert.match(dit, /\.$/, 'une phrase')
    }
    assert.notEqual(c.dit(1), c.dit(2), `${c.cle} : le + change quelque chose`)
    assert.notEqual(c.dit(2), c.dit(3), `${c.cle} : le ++ change quelque chose`)
  }
  assert.equal(carteDeLaTraversee('constructor'), null, 'une clé du prototype ne trouve rien')
  assert.equal(carteDeLaTraversee(undefined), null)
  assert.equal(nomAuNiveau(CARTES[0], 3), 'Coup d’œil ++', 'le signe ne passe jamais seul à la ligne')
  // Les quatre pouvoirs qui jouent dans une manche passent à l'épreuve, à la force de leur niveau ; les autres restent à la traversée.
  assert.deepEqual(
    cartesDeLEpreuve([
      { cle: 'coup-d-oeil', niveau: 2 },
      { cle: 'parade', niveau: 3 },
      { cle: 'concentration', niveau: 1 },
    ]),
    [
      { cle: 'coup-d-oeil', pouvoir: 'eclairer', force: 2 },
      { cle: 'concentration', pouvoir: 'temps', force: 1 },
    ],
  )
  assert.deepEqual(lireLesCartesChoisies(['parade', 'cagnotte', 'panacee']), ['parade', 'cagnotte', 'panacee'])
  for (const casse of [['parade', 'parade', 'panacee'], ['parade', 'cagnotte'], ['parade', 'cagnotte', 'bastion'], 'parade', null]) {
    assert.equal(lireLesCartesChoisies(casse), CHOISIS_TROIS_CARTES, JSON.stringify(casse))
  }
})

test('les gardiens : des légendaires du Cabinet, rangeables, jamais la Frise ni un Divin', () => {
  for (const g of GARDIENS_DE_LA_TRAVERSEE) {
    const l = legendaire(g.cle)
    assert.ok(l, `${g.cle} : un légendaire`)
    assert.ok(voieDuGardien(g.cle), `${g.cle} : une voie où le ranger`)
    assert.ok(!g.jeux.includes('frise'), `${g.cle} : la Frise ne se joue pas contre un gardien`)
    assert.equal(new Set(g.jeux).size, 3)
    assert.doesNotMatch(g.cle, /divin/)
  }
  for (const acte of GARDIENS_DES_ACTES) for (const g of acte) assert.ok(GARDIENS_DE_LA_TRAVERSEE.some(x => x.cle === g), g)
  // Ceux qu'il n'a pas d'abord ; tous à lui, l'acte en tire un quand même.
  const possedes = new Set(GARDIENS_DES_ACTES[0].filter(g => g !== 'lg:coq'))
  for (let n = 1; n < 30; n++) assert.equal(choisirLesGardiens(graine(n), possedes, false)[0], 'lg:coq')
  const tous = new Set(GARDIENS_DES_ACTES.flat())
  assert.ok(GARDIENS_DES_ACTES[0].includes(choisirLesGardiens(graine(3), tous, false)[0]))
  // À Halloween, la Citrouille garde l'acte I une fois sur deux à peu près.
  const citrouilles = Array.from({ length: 200 }, (_, n) => choisirLesGardiens(graine(n + 1), new Set(), true)[0]).filter(g => g === GARDIEN_D_HALLOWEEN).length
  assert.ok(citrouilles > 60 && citrouilles < 140, `${citrouilles} sur 200`)
  assert.ok(!choisirLesGardiens(graine(5), new Set(), false).includes(GARDIEN_D_HALLOWEEN))
  assert.equal(jeuDeLAssaut('lg:renard', 1), 'eclair')
  assert.equal(jeuDeLAssaut('lg:renard', 4), 'eclair', 'à tour de rôle')
  assert.equal(jeuDeLAssaut('lg:renard', 3), 'replique')
})

test('la carte : trois actes, trois chemins, un coffre, le marchand, le gardien — des diagonales qui ne se croisent jamais', () => {
  for (let n = 1; n <= 40; n++) {
    const actes = tracerLaCarte(graine(n), GARDIENS, THEMES)
    assert.equal(actes.length, B.ACTES_D_UNE_TRAVERSEE)
    const themesDuContenu = new Map<string, number>()
    actes.forEach((acte, a) => {
      assert.equal(acte.gardien, GARDIENS[a])
      const ici = (r: number, c: number) => acte.etapes.find(x => x.id === idDEtape(a, r, c))
      assert.equal(acte.etapes.length, 1 + B.RANGEES_D_UN_ACTE * B.CHEMINS_D_UNE_RANGEE + 2)
      assert.equal(acte.etapes.filter(x => x.sorte === 'coffre').length, 1)
      assert.equal(acte.etapes.find(x => x.sorte === 'coffre')!.rangee, B.RANGEE_DU_COFFRE)
      assert.equal(ici(RANGEE_DU_MARCHAND, 1)?.sorte, 'marchand')
      assert.equal(ici(RANGEE_DU_GARDIEN, 1)?.sorte, 'gardien')
      assert.deepEqual(ici(0, 1)?.suivantes, [0, 1, 2].map(c => idDEtape(a, 1, c)))
      for (let r = 1; r <= B.RANGEES_D_UN_ACTE; r++) {
        const rangee = [0, 1, 2].map(c => ici(r, c)!)
        const jeux = rangee.filter(x => x.sorte === 'epreuve').map(x => x.jeu!)
        assert.equal(new Set(jeux).size, jeux.length, 'jamais deux fois le même jeu sur une rangée')
        const categories = rangee.map(x => x.theme).filter(t => CATEGORIES.includes(t as never))
        assert.equal(new Set(categories).size, categories.length, 'deux voisines n’ont pas la même catégorie')
        for (const x of rangee) {
          if (x.sorte === 'epreuve') assert.ok(x.theme, `${x.id} : un thème vu d'avance`)
          if (x.jeu === 'epingle' || x.jeu === 'frise') themesDuContenu.set(x.theme!, (themesDuContenu.get(x.theme!) ?? 0) + 1)
          assert.ok(x.suivantes.includes(idDEtape(a, r + 1, x.colonne)) || r === B.RANGEES_D_UN_ACTE, 'chaque chemin file tout droit')
        }
        if (r < B.RANGEES_D_UN_ACTE) {
          for (let c = 0; c < 2; c++) {
            const montante = ici(r, c)!.suivantes.includes(idDEtape(a, r + 1, c + 1))
            const descendante = ici(r, c + 1)!.suivantes.includes(idDEtape(a, r + 1, c))
            assert.ok(!(montante && descendante), `${a}/${r}/${c} : deux diagonales qui se croisent`)
          }
        }
      }
    })
    for (const [t, k] of themesDuContenu) assert.equal(k, 1, `« ${t} » deux fois dans une traversée`)
    const parJeu = new Map<string, number>()
    for (const e of actes.flatMap(a => a.etapes)) if (e.jeu) parJeu.set(e.jeu, (parJeu.get(e.jeu) ?? 0) + 1)
    for (const [jeu, k] of parJeu) assert.ok(k <= (B.EPREUVES_D_UN_JEU_MAX[jeu as keyof typeof B.EPREUVES_D_UN_JEU_MAX] ?? Infinity), `${jeu} : ${k}`)
    assert.ok(parJeu.size >= 7, 'les jeux tournent')
  }
  // La même graine, la même carte : rien ne la retrace.
  assert.deepEqual(tracerLaCarte(graine(9), GARDIENS, THEMES), tracerLaCarte(graine(9), GARDIENS, THEMES))
})

test('ses trois cartes se choisissent devant ses gardiens, une fois : rien ne part avant elles', () => {
  const d = departDeLaTraversee()
  const e = etatDeLaTraversee(d, [])
  assert.equal(e.ou.sorte, 'cartes')
  assert.deepEqual(atteignables(d, e), [])
  assert.equal(jouerUnGesteDeLaTraversee(d, e, { quoi: 'aller', etape: idDEtape(0, 1, 0) }, MIDI), CHOISIS_D_ABORD)
  assert.equal(jouerUnGesteDeLaTraversee(d, e, { quoi: 'cartes', cartes: ['parade', 'parade', 'cagnotte'] }, MIDI), CHOISIS_TROIS_CARTES)
  const apres = jouerUnGesteDeLaTraversee(d, e, { quoi: 'cartes', cartes: ['panacee', 'parade', 'cagnotte'] }, MIDI)
  assert.ok(typeof apres !== 'string')
  assert.equal(apres.coeurs, B.COEURS_DE_DEPART + B.COEURS_DE_LA_PANACEE[1], 'la Panacée compte dès le départ')
  assert.equal(apres.ou.sorte, 'carte')
  assert.equal(jouerUnGesteDeLaTraversee(d, apres, { quoi: 'cartes', cartes: ['echange', 'parade', 'cagnotte'] }, MIDI), CARTES_DEJA_CHOISIES)
  // Renoncer reste possible devant ses gardiens.
  const renonce = jouerUnGesteDeLaTraversee(d, e, { quoi: 'abandonner' }, MIDI)
  assert.ok(typeof renonce !== 'string' && renonce.fin?.issue === 'abandonnee')
})

test('une épreuve : chaque étoile rapporte de l’or, une manche ratée coûte un cœur, et quitter ne fuit rien', () => {
  const t = new Traversee(['coup-d-oeil', 'echange', 'concentration'])
  assert.equal(t.etat.coeurs, B.COEURS_DE_DEPART)
  const etape = t.vers('epreuve')
  // La page demande d'y aller ; seul le serveur y entre, en commençant sa partie.
  assert.equal(t.refuse({ quoi: 'aller', etape }), ETAPE_A_JOUER)
  assert.equal(t.refuse({ quoi: 'aller', etape: idDEtape(0, 2, 0) }), PAS_PAR_LA)
  t.joue({ quoi: 'epreuve', etape, partie: 'p1' })
  assert.equal(t.refuse({ quoi: 'abandonner' }), EPREUVE_EN_COURS)
  assert.deepEqual(atteignables(t.depart, t.etat), [], 'rien d’autre pendant une épreuve')
  t.joue({ quoi: 'conclure', partie: 'p1', manches: manches([3, 0, 1]) })
  assert.equal(t.etat.or, 4 * B.OR_PAR_ETOILE)
  assert.equal(t.etat.coeurs, B.COEURS_DE_DEPART - 1)
  assert.deepEqual(
    t.etat.derniere?.manches.map(m => [m.or, m.coeurs]),
    [
      [15, 0],
      [0, 1],
      [5, 0],
    ],
  )
  assert.equal(t.etat.ou.sorte, 'carte')
  // Quittée après une manche : les deux autres comptent ratées.
  t.epreuve([2, null, null])
  assert.equal(t.etat.coeurs, B.COEURS_DE_DEPART - 3)
  assert.equal(t.etat.reussies, 3)
  // La relecture redonne le même état, geste pour geste.
  assert.deepEqual(etatDeLaTraversee(t.depart, t.gestes), t.etat)
})

test('les cartes de la traversée : Cagnotte, Parade, Quitte ou double, Second souffle', () => {
  const t = new Traversee(['cagnotte', 'parade', 'quitte-ou-double'])
  // Parade : la première manche ratée de l'épreuve ne coûte rien ; la Cagnotte paie chaque manche réussie.
  t.epreuve([0, 0, 2])
  assert.equal(t.etat.coeurs, B.COEURS_DE_DEPART - 1)
  assert.equal(t.etat.or, 2 * B.OR_PAR_ETOILE + B.OR_DE_LA_CAGNOTTE[1])
  assert.deepEqual(
    t.etat.derniere?.manches.map(m => m.paree),
    [true, false, false],
  )
  // Quitte ou double : misée et réussie, l'or double ; misée et ratée, deux cœurs (la Parade couvre d'abord la première ratée).
  const avant = t.etat.or
  t.epreuve([3, 0, 0], [true, false, true])
  assert.equal(t.etat.or - avant, (3 * B.OR_PAR_ETOILE + B.OR_DE_LA_CAGNOTTE[1]) * B.MULTIPLICATEUR_DE_LA_MISE[1])
  assert.equal(t.etat.coeurs, B.COEURS_DE_DEPART - 1 - B.COEURS_D_UNE_MISE_PERDUE)
  // Le dernier cœur tombe : sans Second souffle, la traversée est perdue, et les manches d'après ne comptent plus.
  t.epreuve([0, 0, 3], [false, true, false])
  assert.equal(t.etat.fin?.issue, 'perdue')
  assert.equal(t.etat.coeurs, 0)
  assert.deepEqual(
    t.etat.derniere?.manches.map(m => [m.paree, m.coeurs, m.comptee]),
    [
      [true, 0, true],
      [false, B.COEURS_D_UNE_MISE_PERDUE, true],
      [false, 0, false],
    ],
  )
  assert.equal(t.etat.derniere?.perdue, true)

  const s = new Traversee(['second-souffle', 'panacee', 'pourboire'])
  assert.equal(s.etat.coeurs, B.COEURS_DE_DEPART + B.COEURS_DE_LA_PANACEE[1])
  for (let k = 0; k < 2; k++) s.epreuve([0, 0, 0])
  assert.equal(s.etat.fin?.issue, undefined, 'le Second souffle relève une fois')
  assert.equal(s.etat.souffle, true)
  assert.equal(s.etat.coeurs, B.COEURS_DU_SECOND_SOUFFLE[1]! - 0)
  s.epreuve([0, 0, 0])
  assert.equal(s.etat.fin?.issue, 'perdue', 'pas deux fois')
})

test('le coffre, le marchand : améliorer, acheter un cœur, le Pourboire', () => {
  const t = new Traversee(['pourboire', 'panacee', 'coup-d-oeil'], 11)
  // Jusqu'au coffre de la deuxième rangée, s'il est atteignable ; sinon une épreuve, puis le coffre de l'acte suivant n'importe pas.
  t.epreuve([3, 3, 3])
  const coffre = atteignables(t.depart, t.etat).find(x => etapeDe(t.depart, x)?.sorte === 'coffre')
  if (coffre) {
    t.joue({ quoi: 'aller', etape: coffre })
    assert.equal(t.etat.ameliorations, 1)
    assert.equal(t.refuse({ quoi: 'aller', etape: atteignables(t.depart, { ...t.etat, ameliorations: 0 })[0] }), AMELIORE_D_ABORD)
    t.joue({ quoi: 'ameliorer', carte: 'panacee' })
    assert.equal(t.etat.cartes.find(c => c.cle === 'panacee')?.niveau, 2)
    assert.equal(t.etat.coeurs, B.COEURS_DE_DEPART + B.COEURS_DE_LA_PANACEE[2], 'la Panacée donne aussitôt son cœur')
  }
  jusquAuMarchand(t)
  assert.equal(t.etat.ou.sorte, 'marchand')
  assert.equal(prixAuMarchand('coeur', t.etat.cartes), B.PRIX_DU_MARCHAND.coeur - B.REMISE_DU_POURBOIRE[1])
  assert.equal(t.refuse({ quoi: 'acheter', article: 'coeur' }), COEURS_AU_COMPLET)
  // Un cœur perdu se rachète ; une amélioration aussi, jusqu'au plus haut.
  t.etat = { ...t.etat, coeurs: t.etat.coeurs - 1, or: 200 }
  t.joue({ quoi: 'acheter', article: 'coeur' })
  assert.equal(t.etat.coeurs, coeursMax(t.etat.cartes))
  t.joue({ quoi: 'acheter', article: 'amelioration', carte: 'coup-d-oeil' })
  t.joue({ quoi: 'acheter', article: 'amelioration', carte: 'coup-d-oeil' })
  assert.equal(t.refuse({ quoi: 'acheter', article: 'amelioration', carte: 'coup-d-oeil' }), CARTE_AU_PLUS_HAUT)
  t.etat = { ...t.etat, or: 0 }
  assert.equal(t.refuse({ quoi: 'acheter', article: 'amelioration', carte: 'pourboire' }), PAS_ASSEZ_D_OR)
})

test('le gardien : des assauts jusqu’à sa chute, ses jeux à tour de rôle, puis l’acte suivant et une amélioration', () => {
  const t = new Traversee(['coup-de-grace', 'quitte-ou-double', 'concentration'], 5)
  jusquAuMarchand(t)
  const gardien = t.vers('gardien')
  const pv = pvDuGardien(0, t.etat.cartes)
  assert.equal(pv, B.PV_DES_GARDIENS[0] - B.PV_DU_COUP_DE_GRACE[1])
  assert.deepEqual(viseeDeLEtape(t.depart, etapeDe(t.depart, gardien)!, 1), { jeu: jeuDeLAssaut(GARDIENS[0], 1), marches: B.MARCHES_DES_GARDIENS[0], categorie: null, theme: null })
  const coeurs = t.etat.coeurs
  // Premier assaut : une étoile, une ratée, une étoile — le gardien tient.
  t.joue({ quoi: 'epreuve', etape: gardien, partie: 'g1' })
  t.joue({ quoi: 'conclure', partie: 'g1', manches: manches([1, 0, 1]) })
  assert.deepEqual(t.etat.pv, { restent: pv - 2, max: pv })
  assert.equal(t.etat.ou.sorte, 'gardien')
  assert.equal(t.etat.coeurs, coeurs - 1)
  assert.deepEqual(atteignables(t.depart, t.etat), [gardien], 'entre deux assauts, le gardien seul')
  assert.equal(t.refuse({ quoi: 'aller', etape: t.etat.visitees[1] }), LE_GARDIEN_T_ATTEND)
  // Deuxième assaut : une mise réussie le met à terre dès la première manche ; les deux autres ne comptent pas.
  t.joue({ quoi: 'epreuve', etape: gardien, partie: 'g2' })
  assert.equal(t.etat.assauts, 2)
  t.joue({ quoi: 'conclure', partie: 'g2', manches: manches([2, null, null], [true]) })
  const b = t.etat.derniere!
  assert.equal(b.vaincu, true)
  assert.deepEqual(
    b.manches.map(m => m.comptee),
    [true, false, false],
    'la chute arrête l’assaut : rien ne coûte après',
  )
  assert.equal(b.recompense, 'amelioration')
  assert.equal(t.etat.acte, 1, 'l’acte suivant s’ouvre')
  assert.equal(t.etat.position, departDeLActe(1))
  assert.equal(t.etat.coeurs, coeursMax(t.etat.cartes), 'les cœurs au complet')
  assert.deepEqual(t.etat.vaincus, [GARDIENS[0]])
  assert.equal(t.etat.ameliorations, 1)
  assert.deepEqual(atteignables(t.depart, t.etat), [], 'l’amélioration d’abord')
  t.joue({ quoi: 'ameliorer', carte: 'coup-de-grace' })
  assert.equal(atteignables(t.depart, t.etat).length, 3)
})

test('au bout des trois actes, le légendaire se choisit parmi les vaincus ; tout au plus haut, un coffre paie de l’or', () => {
  const t = new Traversee(['cagnotte', 'parade', 'panacee'], 3)
  for (let a = 0; a < 3; a++) {
    jusquAuMarchand(t)
    const gardien = t.vers('gardien')
    while (t.etat.acte === a && t.etat.ou.sorte !== 'legendaire') {
      const partie = `g${++t.n}`
      t.joue({ quoi: 'epreuve', etape: gardien, partie })
      t.joue({ quoi: 'conclure', partie, manches: manches([3, 3, 3]) })
    }
    if (t.etat.ameliorations > 0) t.joue({ quoi: 'ameliorer', carte: t.etat.cartes.find(c => c.niveau < 3)!.cle })
  }
  assert.equal(t.etat.ou.sorte, 'legendaire')
  assert.deepEqual(t.etat.vaincus, GARDIENS)
  assert.equal(t.refuse({ quoi: 'legendaire', gardien: 'lg:kraken' }), 'Tu n’as pas vaincu ce gardien')
  t.joue({ quoi: 'legendaire', gardien: 'lg:sphinx' })
  assert.deepEqual(t.etat.fin && [t.etat.fin.issue, t.etat.fin.legendaire], ['gagnee', 'lg:sphinx'])
  // Toutes les cartes au plus haut : un coffre ne peut plus rien améliorer, il paie.
  const u = new Traversee(['cagnotte', 'parade', 'panacee'], 3)
  u.etat = { ...u.etat, cartes: u.etat.cartes.map(c => ({ ...c, niveau: 3 })) }
  const r = consequencesDe(u.depart, { ...u.etat, ou: { sorte: 'gardien', etape: idDEtape(0, 5, 1), partie: 'x' } }, { etape: idDEtape(0, 5, 1), partie: 'x', manches: manches([3, 3, 3]), enCours: false })
  assert.equal(r.bilan.recompense, 'or')
  assert.equal(r.etat.ameliorations, 0)
})

test('une épreuve en cours ne compte que ses manches jugées : la vue d’une manche dit ce que valent les précédentes', () => {
  const t = new Traversee(['parade', 'cagnotte', 'panacee'])
  const etape = t.vers('epreuve')
  t.joue({ quoi: 'epreuve', etape, partie: 'p1' })
  const enCours = consequencesDe(t.depart, t.etat, { etape, partie: 'p1', manches: manches([2, null, null]), enCours: true })
  assert.equal(enCours.etat.coeurs, t.etat.coeurs, 'une manche à venir ne coûte rien')
  assert.equal(enCours.bilan.or, 2 * B.OR_PAR_ETOILE + B.OR_DE_LA_CAGNOTTE[1])
})

test('le départ et les gestes se relisent à leur forme ; la page n’écrit ni `epreuve` ni `conclure`', () => {
  const d = departDeLaTraversee()
  assert.deepEqual(lireLeDepartDeLaTraversee(JSON.stringify(d)), d)
  assert.equal(lireLeDepartDeLaTraversee({ ...d, v: 2 }), null, 'une version inconnue')
  assert.equal(lireLeDepartDeLaTraversee({ ...d, actes: d.actes.slice(0, 2) }), null)
  assert.equal(lireLeDepartDeLaTraversee({ ...d, actes: [{ ...d.actes[0], gardien: 'lg:divin-x' }, d.actes[1], d.actes[2]] }), null)
  assert.equal(lireLeDepartDeLaTraversee('{pas du json'), null)
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'cartes', cartes: ['echange', 'parade', 'panacee'] }), { quoi: 'cartes', cartes: ['echange', 'parade', 'panacee'] })
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'cartes', cartes: ['echange', 'parade'] }), { quoi: 'cartes', cartes: ['echange', 'parade'] }, 'le pli le refusera en mots')
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'cartes', cartes: 'parade' }), null)
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'cartes', cartes: ['x'.repeat(5000)] }), null)
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'aller', etape: 'a0r1c2', en: 'trop' }), { quoi: 'aller', etape: 'a0r1c2' })
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'aller', etape: '../a0' }), null)
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'ameliorer', carte: 'constructor' }), null)
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'acheter', article: 'coeur', carte: 'x' }), { quoi: 'acheter', article: 'coeur' })
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'acheter', article: 'amelioration' }), null)
  const epreuve = { quoi: 'epreuve', etape: 'a0r1c0', partie: 'p' }
  const conclure = { quoi: 'conclure', partie: 'p', manches: manches([3, 0, null]) }
  assert.equal(lireUnGesteDeLaTraversee(epreuve), null, 'la page n’entre pas d’elle-même dans une épreuve')
  assert.equal(lireUnGesteDeLaTraversee(conclure), null, 'ni ne dit ses étoiles')
  assert.deepEqual(lireUnGesteDeLaTraversee(JSON.stringify(epreuve), true), epreuve)
  assert.deepEqual(lireUnGesteDeLaTraversee(JSON.stringify(conclure), true), conclure)
  assert.equal(lireUnGesteDeLaTraversee({ ...conclure, manches: manches([4, 0, 0]) }, true), null)
})

test('l’épreuve d’une traversée, partie du Cabinet : ses cartes à la fois, deux mises au plus haut, ses étoiles nues', () => {
  const traversee = { id: 't-1', etape: 'a0r1c0', assaut: 0 }
  const cartes = cartesDeLEpreuve([
    { cle: 'quitte-ou-double', niveau: 3 },
    { cle: 'coup-d-oeil', niveau: 2 },
    { cle: 'concentration', niveau: 2 },
  ])
  const d: DepartDUnePartie = { ...departDe('pari'), v: 3, origine: 'traversee', traversee, carte: null, cartes, chrono: chronoDuDepart('pari', cartes) }
  assert.equal(d.chrono.enPlusMs, 2 * B.SECONDES_PAR_FORCE * 1000, 'Concentration +')
  assert.deepEqual(lireLeDepart(JSON.stringify(d)), d)
  assert.equal(lireLeDepart(JSON.stringify({ ...d, v: 2 })), null, 'une épreuve n’existe qu’à partir de la version 3')
  assert.equal(lireLeDepart(JSON.stringify({ ...d, carte: cartes[0] })), null, 'une épreuve n’a pas de carte-bonus')
  assert.equal(lireLeDepart(JSON.stringify({ ...d, cartes: [cartes[0], cartes[0]] })), null, 'une carte par pouvoir')
  const ouverte = pliDeLaPartie(d, [{ geste: ouvrir(0, true), faitLe: MIDI }])
  assert.equal(refusDuGeste(d, ouverte, ouvrir(0, true), MIDI + S), 'La mise se décide avant de voir la manche')
  const etoiles = etoilesDesManches(d, pliDeLaPartie(d, [{ geste: ouvrir(0, true), faitLe: MIDI }, { geste: { quoi: 'quitter' }, faitLe: MIDI + S }]))
  assert.deepEqual(
    etoiles.map(m => [m.naturel, m.etoiles, m.misee]),
    [
      [0, 0, true],
      [null, null, false],
      [null, null, false],
    ],
    'les étoiles nues, la mise dite',
  )
  // Quitte ou double ++ : deux mises par épreuve — la troisième se refuse en mots.
  const d1 = { ...d, jeu: 'mot' as const, tirages: departDe('mot').tirages, chrono: chronoDuDepart('mot', cartes) }
  const deuxMises = pliDeLaPartie(d1, [
    { geste: ouvrir(0, true), faitLe: MIDI },
    { geste: { quoi: 'repondre', manche: 0, auto: true }, faitLe: MIDI + 200 * S },
    { geste: ouvrir(1, true), faitLe: MIDI + 201 * S },
    { geste: { quoi: 'repondre', manche: 1, auto: true }, faitLe: MIDI + 400 * S },
  ])
  assert.equal(deuxMises.manches.filter(m => m.misee).length, 2)
  assert.equal(refusDuGeste(d1, deuxMises, ouvrir(2, true), MIDI + 401 * S), 'Tes 2 mises ont déjà servi')
})

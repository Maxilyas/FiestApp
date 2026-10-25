// Le catalogue du Cabinet de curiosités (la proposition validée le
// 24 octobre 2026, `retours/2026-10-24/le-cabinet.md`) : tout ce qui se décrit
// sans jouer — les œuvres, les salles, les pouvoirs des cartes-bonus, les
// gardiens, les identifiants, la carte de France, les chiffres.
//
// Le Cabinet recopie ce qu'il lit des rencontres de l'Expédition plutôt que de
// les importer : la page du musée ne doit pas tirer les 4 782 lignes de
// `shared/rencontres.ts`. Une copie dérive sans bruit — une carte peinte de
// plus, un nom retouché, une rareté changée —, d'où ce test, qui relit chaque
// table contre sa source. Et ce qui se gèle (le jeu de chaque œuvre, les
// œuvres de départ) s'écrit ici en entier : le changer est un choix de produit,
// qui se dit en changeant aussi ce test (invariant 22, `baremes.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { CARTES_DES_RENCONTRES, FAMILLES_DE_CARTES, type FamilleDeCartes } from '../../shared/rencontres'
import { LEGENDAIRES_A_JOKER } from '../../shared/jokers'
import { legendaire } from '../../shared/legendaires'
import { SAISONS, cleDeSaison } from '../../shared/saisons'
import { DIVINS } from '../../shared/divins'
import { OEUVRES, OEUVRES_DE_DEPART, JEU_DE_L_OEUVRE, RARETES, oeuvre, estUneOeuvre, oeuvresDeLaSalle } from '../../shared/cabinet/oeuvres'
import {
  SALLES,
  GARDIENS,
  GARDIENS_DES_SALLES,
  AUTRES_GARDIENS,
  GARDIENS_DU_CABINET,
  GARDIENS_DE_SAISON,
  POUVOIR_DES_GARDIENS,
  pouvoirDuGardien,
  salle,
  salleDuGardien,
  voieDuGardien,
  conditionDuGardien,
  type CleDeSalle,
} from '../../shared/cabinet/salles'
import {
  POUVOIRS,
  POUVOIR_DE_LA_FAMILLE,
  POUVOIR_DU_NEUTRE,
  pouvoirDe,
  forceDe,
  forceDite,
  refusDuPouvoir,
  effacablesAuPlus,
  etoilesApresLesPouvoirs,
  mancheProtegee,
  type CleDePouvoir,
  type Force,
} from '../../shared/cabinet/pouvoirs'
import * as B from '../../shared/cabinet/bareme'
import { CABINET_EN_PRODUCTION, JEUX_PRETS, cabinetOuvert } from '../../shared/cabinet/ouverture'
import {
  PREFIXE_DU_CABINET,
  JOKER_D_ECLAIRER,
  JOKER_DU_TEMPS,
  idDuLieu,
  idDeLaFiche,
  idDeLaReplique,
  idDuTableau,
  idDeLEclair,
  idDeLaFriseATheme,
  idDeLaFriseDeSujet,
  estDuCabinet,
  deplier,
} from '../../shared/cabinet/pieces'
import { DANS_LA_FRANCE, dansLaFrance, distanceKm, projeter, deprojeter, LARGEUR_DE_LA_CARTE, HAUTEUR_DE_LA_CARTE } from '../../shared/cabinet/france'
import { FORME_D_UN_IDENTIFIANT, FORME_D_UNE_CLE } from '../../shared/cabinet/contenu'
import { CLES_DES_JEUX, JEUX, baremeDesErreurs, justeDeLaPiece, type CleDeJeu } from '../../shared/cabinet/jeux/regle'

/** La table des cartes peintes, telle que la chaîne `peindre` l'écrit — un fichier du client, lu par son adresse. */
const peintes = async (): Promise<Record<string, unknown>> =>
  (await import(new URL('../../client/src/components/cartes-peintes.ts', import.meta.url).href)).CARTES_PEINTES

const SANS_LEGENDAIRE = CARTES_DES_RENCONTRES.filter(c => !c.legendaire)
const FAMILLES: readonly Exclude<CleDeSalle, 'vestibule'>[] = ['erudit', 'devin', 'rempart', 'elan', 'metamorphe', 'flambeur', 'sophiste', 'temeraire']
/** La famille des rencontres que chaque salle expose : le Vestibule, ce sont les neutres. */
const familleDe = (s: CleDeSalle): FamilleDeCartes => (s === 'vestibule' ? 'neutre' : s)
const compter = <T extends string>(liste: readonly T[]) => liste.reduce<Record<string, number>>((n, x) => ({ ...n, [x]: (n[x] ?? 0) + 1 }), {})

test('les 84 œuvres sont les cartes peintes des rencontres, sans légendaire ni fiole', async () => {
  const table = await peintes()
  assert.equal(OEUVRES.length, 84)
  assert.deepEqual(OEUVRES.map(o => o.cle).sort(), SANS_LEGENDAIRE.map(c => c.cle).sort())
  // Chacune a sa peinture : une œuvre sans image ne se montrerait pas au musée.
  assert.deepEqual(OEUVRES.map(o => o.cle).sort(), Object.keys(table).sort())
  for (const o of OEUVRES) {
    const carte = SANS_LEGENDAIRE.find(c => c.cle === o.cle)!
    assert.equal(o.nom, carte.nom, `${o.cle} : le nom de la carte`)
    assert.equal(familleDe(o.salle), carte.famille, `${o.cle} : sa salle est sa famille`)
    assert.equal(o.rarete, carte.rarete, `${o.cle} : sa rareté`)
    assert.equal(oeuvre(o.cle), o)
    assert.ok(estUneOeuvre(o.cle))
  }
  assert.equal(oeuvre('renaissance'), undefined, 'la carte d’un légendaire n’est pas une œuvre : c’est un gardien')
  assert.equal(oeuvre('dv:helios'), undefined)
  assert.equal(estUneOeuvre(42), false)
})

test('neuf salles : huit familles de huit œuvres, et le Vestibule de vingt', () => {
  assert.deepEqual(SALLES.map(s => s.cle), [...FAMILLES, 'vestibule'])
  for (const f of FAMILLES) {
    const s = salle(f)!
    assert.equal(s.nom, FAMILLES_DE_CARTES[f].nom, `${f} : le nom de sa famille`)
    assert.equal(s.devise, FAMILLES_DE_CARTES[f].devise, `${f} : la devise de sa famille`)
    assert.deepEqual(compter(oeuvresDeLaSalle(f).map(o => o.rarete)), { commun: 3, rare: 3, epique: 2 }, `${f} : trois communes, trois rares, deux épiques`)
  }
  assert.equal(salle('vestibule')!.devise, FAMILLES_DE_CARTES.neutre.devise)
  assert.deepEqual(compter(oeuvresDeLaSalle('vestibule').map(o => o.rarete)), { commun: 10, rare: 5, epique: 2, maudit: 3 })
  assert.equal(8 * 8 + 20, OEUVRES.length)
  assert.deepEqual([...RARETES].sort(), [...new Set(OEUVRES.map(o => o.rarete))].sort())
  // Les mots qui disent une salle dans une phrase : « une œuvre rare de la salle du Devin », « encore 2 œuvres dans le Vestibule ».
  assert.equal(salle('devin')!.deLaSalle, 'de la salle du Devin')
  assert.equal(salle('erudit')!.dansLaSalle, 'dans la salle de l’Érudit')
  assert.equal(salle('vestibule')!.deLaSalle, 'du Vestibule')
  assert.equal(salle('nulle-part'), undefined)
})

test('le pouvoir d’une œuvre vient de sa famille ; au Vestibule, de la carte elle-même', () => {
  assert.deepEqual(Object.keys(POUVOIR_DE_LA_FAMILLE).sort(), [...FAMILLES].sort())
  assert.deepEqual(POUVOIR_DE_LA_FAMILLE, {
    erudit: 'eclairer',
    devin: 'eclairer',
    rempart: 'proteger',
    elan: 'temps',
    metamorphe: 'changer',
    flambeur: 'miser',
    sophiste: 'changer',
    temeraire: 'miser',
  })
  // Une table écrite, relue contre les vingt neutres des rencontres : une neutre de plus sans pouvoir rougirait ici.
  const neutres = SANS_LEGENDAIRE.filter(c => c.famille === 'neutre').map(c => c.cle)
  assert.deepEqual(Object.keys(POUVOIR_DU_NEUTRE).sort(), [...neutres].sort())
  assert.deepEqual(compter(Object.values(POUVOIR_DU_NEUTRE)), { eclairer: 5, proteger: 5, temps: 5, changer: 2, miser: 3 })
  // Écrite en entier, comme la conception la donne : échanger le pouvoir de deux neutres ne changerait aucun compte.
  assert.deepEqual(POUVOIR_DU_NEUTRE, {
    'coup-d-oeil': 'eclairer',
    evidence: 'eclairer',
    repere: 'eclairer',
    lettre: 'eclairer',
    initiale: 'eclairer',
    prudence: 'proteger',
    'double-chance': 'proteger',
    sursis: 'proteger',
    'sang-froid': 'proteger',
    panacee: 'proteger',
    concentration: 'temps',
    pioche: 'temps',
    'arret-sur-image': 'temps',
    meditation: 'temps',
    maitrise: 'temps',
    echange: 'changer',
    detour: 'changer',
    'tout-ou-rien': 'miser',
    'quitte-ou-double': 'miser',
    surmenage: 'miser',
  })
  for (const o of oeuvresDeLaSalle('vestibule').filter(o => o.rarete === 'maudit')) {
    assert.equal(POUVOIR_DU_NEUTRE[o.cle as keyof typeof POUVOIR_DU_NEUTRE], 'miser', `${o.cle} : les trois maudites misent`)
  }
  for (const o of OEUVRES) {
    const attendu = o.salle === 'vestibule' ? POUVOIR_DU_NEUTRE[o.cle as keyof typeof POUVOIR_DU_NEUTRE] : POUVOIR_DE_LA_FAMILLE[o.salle]
    assert.equal(pouvoirDe(o.cle), attendu, o.cle)
  }
  assert.deepEqual(Object.keys(POUVOIRS).sort(), ['changer', 'eclairer', 'miser', 'proteger', 'temps'])
})

test('la rareté fait la force : une commune 1, une rare ou une maudite 2, une épique 3, un gardien 3', () => {
  assert.deepEqual(B.FORCES_DES_RARETES, { commun: 1, rare: 2, maudit: 2, epique: 3, legendaire: 3 })
  for (const o of OEUVRES) assert.equal(forceDe(o.cle), B.FORCES_DES_RARETES[o.rarete], o.cle)
  for (const g of GARDIENS) assert.equal(forceDe(g), 3, g)
  assert.equal(forceDe('inconnue'), null)
  assert.equal(forceDe('dv:helios'), null, 'un Divin n’a pas de force : il n’est pas une carte-bonus')
  // Ce que chaque force fait, en mots : l'annonce le dit sous la carte-bonus emportée.
  assert.equal(forceDite('eclairer', 1), '1 indice par partie')
  assert.equal(forceDite('eclairer', 3), '3 indices par partie')
  assert.equal(forceDite('proteger', 1), '+1 étoile, une fois par partie')
  assert.equal(forceDite('proteger', 2), '+1 étoile, une fois par partie')
  assert.equal(forceDite('proteger', 3), '+2 étoiles, une fois par partie')
  assert.equal(forceDite('temps', 2), '+20 s à chaque manche')
  assert.equal(forceDite('miser', 1), '+2 étoiles si la manche misée est parfaite')
  assert.equal(forceDite('miser', 3), '+4 étoiles si la manche misée est parfaite')
  assert.equal(forceDite('changer', 2), '2 fois par partie')
})

test('une clé venue du téléphone ne passe jamais pour une carte-bonus : ni `constructor`, ni `__proto__`', () => {
  // La carte-bonus d'un départ arrive du téléphone (`carte`, une chaîne). La table des gardiens est un objet :
  // lue par `[cle]`, `constructor` y trouvait la fonction `Object`, et une force 3 — un pouvoir qui n'en est
  // pas, que le départ aurait figé et que sa relecture aurait refusé, la partie bloquée en cours.
  for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '', 'lg:', 'LG:PHENIX']) {
    assert.equal(pouvoirDe(k), null, k)
    assert.equal(forceDe(k), null, k)
    assert.equal(pouvoirDuGardien(k), undefined, k)
  }
  for (const k of [null, undefined, 42, {}, ['lg:phenix']]) {
    assert.equal(pouvoirDe(k), null, String(k))
    assert.equal(forceDe(k), null, String(k))
    assert.equal(pouvoirDuGardien(k), undefined, String(k))
  }
  for (const g of GARDIENS) assert.equal(pouvoirDuGardien(g), POUVOIR_DES_GARDIENS[g], g)
  // Et un pouvoir que la règle ne connaît pas se refuse en mots — jamais `undefined`, qu'un `if (refus)` laisserait servir.
  for (const pouvoir of ['constructor', 'joker'] as unknown as CleDePouvoir[]) {
    const refus = refusDuPouvoir({ pouvoir, force: 3, jeu: 'pari', servi: 0 })
    assert.equal(typeof refus, 'string', `${pouvoir} : ${refus}`)
  }
})

test('les œuvres de départ, gelées : un pouvoir chacune, sauf Miser', () => {
  // Possédées par règle, sans ligne : la raccourcir reprendrait des œuvres à tout le monde (invariant 22).
  assert.deepEqual(OEUVRES_DE_DEPART, ['coup-d-oeil', 'prudence', 'concentration', 'echange'])
  assert.deepEqual(OEUVRES_DE_DEPART.map(c => pouvoirDe(c)), ['eclairer', 'proteger', 'temps', 'changer'])
  for (const c of OEUVRES_DE_DEPART) assert.equal(oeuvre(c)?.salle, 'vestibule', `${c} : elles comptent pour le Vestibule`)
})

test('chaque œuvre se trouve à un jeu fixe, et la table est gelée', () => {
  // Écrite une fois : un jeu de plus ne déplace aucune œuvre, et changer le jeu
  // d'une œuvre déplace la chasse de qui la cherche — un choix de produit.
  const GELEE: Record<CleDeJeu, string[]> = {
    epingle: ['revelation', 'bastion', 'sprint', 'miroir', 'banco', 'objection', 'coup-de-sang', 'coup-d-oeil', 'repere'],
    frise: ['plume', 'represailles', 'vent-arriere', 'cameleon', 'assurance', 'zizanie', 'cicatrices', 'pioche', 'detour'],
    mot: ['savoir-faire', 'lucidite', 'inarretable', 'metamorphose', 'fortune', 'engrenage', 'adrenaline', 'echange', 'lettre'],
    detail: ['memoire', 'augure', 'parade', 'polymorphe', 'pactole', 'coup-de-grace', 'dernier-carre', 'arret-sur-image', 'meditation'],
    filet: ['bibliotheque', 'presage', 'muraille', 'echauffement', 'rafle', 'paranoia', 'temerite', 'concentration', 'double-chance', 'surmenage'],
    pari: ['lecon', 'troisieme-oeil', 'pansement', 'lancee', 'corser', 'hantise', 'berserk', 'prudence', 'sang-froid', 'quitte-ou-double'],
    eclair: ['expose', 'voyance', 'contre-attaque', 'foulee', 'simplifier', 'doubler-la-mise', 'baroud', 'evidence', 'panacee', 'tout-ou-rien'],
    indices: ['encyclopedie', 'astrolabe', 'cuirasse', 'acceleration', 'volte-face', 'pourboire', 'insinuation', 'maitrise', 'initiale'],
    replique: ['genie', 'vision', 'second-souffle', 'rythme', 'prisme', 'cagnotte', 'rumeur', 'fougue', 'sursis'],
  }
  const lue: Record<string, string[]> = {}
  for (const o of OEUVRES) (lue[JEU_DE_L_OEUVRE[o.cle]] ??= []).push(o.cle)
  for (const j of CLES_DES_JEUX) assert.deepEqual([...(lue[j] ?? [])].sort(), [...GELEE[j]].sort(), `les œuvres ${JEUX[j].a}`)
  assert.deepEqual(Object.keys(JEU_DE_L_OEUVRE).sort(), OEUVRES.map(o => o.cle).sort())
  // Équilibrée : dans chaque famille, huit jeux différents ; chaque jeu, neuf ou dix œuvres, des communes aux épiques.
  for (const f of FAMILLES) assert.equal(new Set(oeuvresDeLaSalle(f).map(o => JEU_DE_L_OEUVRE[o.cle])).size, 8, f)
  assert.deepEqual(compter(CLES_DES_JEUX.map(j => String(GELEE[j].length))), { 9: 6, 10: 3 })
  for (const j of CLES_DES_JEUX) {
    const raretes = new Set(GELEE[j].map(c => oeuvre(c)!.rarete))
    for (const r of ['commun', 'rare', 'epique'] as const) assert.ok(raretes.has(r), `${JEUX[j].nom} : au moins une ${r}`)
  }
})

test('les vingt-trois gardiens sont les légendaires à joker : dix-huit des salles, cinq autres, aucun Divin', () => {
  const desSalles = Object.values(GARDIENS_DES_SALLES).flat()
  assert.equal(Object.keys(GARDIENS_DES_SALLES).length, 9)
  assert.equal(new Set(desSalles).size, 18)
  assert.equal(AUTRES_GARDIENS.length, 5)
  assert.deepEqual(GARDIENS, [...desSalles, ...AUTRES_GARDIENS.map(a => a.legendaire)])
  assert.equal(new Set(GARDIENS).size, 23, 'chacun une fois')
  assert.deepEqual([...GARDIENS].sort(), [...LEGENDAIRES_A_JOKER].sort())
  for (const g of GARDIENS) assert.ok(legendaire(g), `${g} : un légendaire qui existe`)
  // Ni la Licorne, ni l'Éléphant, ni l'Aigle (sans joker) ; et jamais un Divin (invariant 21).
  for (const sans of ['lg:licorne', 'lg:elephant', 'lg:aigle']) assert.ok(!GARDIENS.includes(sans), sans)
  for (const d of DIVINS) {
    assert.ok(!GARDIENS.includes(d.key), d.key)
    assert.equal(pouvoirDe(d.key), null, `${d.key} : jamais une carte-bonus`)
    assert.equal(voieDuGardien(d.key), null)
  }
  assert.equal(pouvoirDe('lg:licorne'), null, 'un légendaire sans joker n’est pas une carte-bonus')
  // Exemples de la proposition : l'Érudit, la Chouette d'Argent puis le Lion ; le Rempart, le Phénix puis l'Ouroboros.
  assert.deepEqual(GARDIENS_DES_SALLES.erudit, ['lg:chouette', 'lg:lion'])
  assert.deepEqual(GARDIENS_DES_SALLES.rempart, ['lg:phenix', 'lg:ouroboros'])
  // La table entière, comme la conception la donne : intervertir le premier et le second d'une salle — l'un se
  // réveille à la salle complète, l'autre à la salle dorée — ne changerait aucun ensemble ni aucun pouvoir.
  assert.deepEqual(GARDIENS_DES_SALLES, {
    erudit: ['lg:chouette', 'lg:lion'],
    devin: ['lg:sphinx', 'lg:oracle'],
    rempart: ['lg:phenix', 'lg:ouroboros'],
    elan: ['lg:tigre', 'lg:comete'],
    metamorphe: ['lg:janus', 'lg:serpent'],
    flambeur: ['lg:dragon', 'lg:renard'],
    sophiste: ['lg:fantome', 'lg:chauve-souris'],
    temeraire: ['lg:salamandre', 'lg:kraken'],
    vestibule: ['lg:coq', 'lg:chimere'],
  })
  assert.equal(salleDuGardien('lg:phenix'), 'rempart')
  assert.equal(salleDuGardien('lg:scarabee'), undefined)
})

test('les trois gardiens de saison sont ceux des fêtes, et ne s’éveillent qu’à elles', () => {
  assert.deepEqual([...GARDIENS_DE_SAISON].sort(), SAISONS.map(s => s.legendaire).sort())
  for (const a of AUTRES_GARDIENS) {
    if (!('saison' in a.reveil)) continue
    const s = SAISONS.find(x => x.key === (a.reveil as { saison: string }).saison)
    assert.ok(s, `${a.legendaire} : une saison qui existe`)
    assert.equal(s!.legendaire, a.legendaire)
    // Le Cabinet range leur condition principale, `saison:halloween` : pas de voie à eux.
    assert.equal(voieDuGardien(a.legendaire), cleDeSaison(s!))
  }
  assert.equal(GARDIENS_DU_CABINET.length, 20)
  for (const g of GARDIENS_DU_CABINET) {
    assert.ok(!GARDIENS_DE_SAISON.includes(g), g)
    assert.equal(voieDuGardien(g), `cabinet:${g.replace(/^lg:/, '')}`)
  }
  assert.equal(voieDuGardien('lg:phenix'), 'cabinet:phenix')
  assert.equal(voieDuGardien('lg:citrouille'), 'saison:halloween')
})

test('un gardien porte le pouvoir de la salle qu’il garde, pas celui de sa carte des rencontres', () => {
  assert.deepEqual(Object.keys(POUVOIR_DES_GARDIENS).sort(), [...GARDIENS].sort())
  for (const f of FAMILLES) for (const g of GARDIENS_DES_SALLES[f]) assert.equal(POUVOIR_DES_GARDIENS[g], POUVOIR_DE_LA_FAMILLE[f], g)
  assert.equal(POUVOIR_DES_GARDIENS['lg:coq'], 'temps')
  assert.equal(POUVOIR_DES_GARDIENS['lg:chimere'], 'changer')
  for (const a of AUTRES_GARDIENS) assert.equal(POUVOIR_DES_GARDIENS[a.legendaire], a.pouvoir, a.legendaire)
  assert.deepEqual(Object.fromEntries(AUTRES_GARDIENS.map(a => [a.legendaire, a.pouvoir])), {
    'lg:scarabee': 'proteger',
    'lg:trou-noir': 'miser',
    'lg:citrouille': 'eclairer',
    'lg:sapin': 'proteger',
    'lg:bouquet': 'temps',
  })
  // Le piège : la carte du Sapin est du Flambeur dans les rencontres, celles du Fantôme et de la Chauve-souris du Devin.
  const familleDeSaCarte = (g: string) => CARTES_DES_RENCONTRES.find(c => c.legendaire === g)?.famille
  assert.equal(familleDeSaCarte('lg:sapin'), 'flambeur')
  assert.equal(pouvoirDe('lg:sapin'), 'proteger')
  assert.equal(familleDeSaCarte('lg:fantome'), 'devin')
  assert.equal(pouvoirDe('lg:fantome'), 'changer')
  for (const g of GARDIENS) assert.equal(pouvoirDe(g), POUVOIR_DES_GARDIENS[g], g)
  // Chacun dit ce qui le réveille.
  assert.equal(conditionDuGardien('lg:phenix'), 'La salle du Rempart complète')
  assert.equal(conditionDuGardien('lg:ouroboros'), 'Tous les cadres de la salle du Rempart dorés')
  assert.equal(conditionDuGardien('lg:coq'), 'Le Vestibule complet')
  assert.equal(conditionDuGardien('lg:chimere'), 'Tous les cadres du Vestibule dorés')
  assert.equal(conditionDuGardien('lg:scarabee'), `${B.JOURS_DU_SCARABEE} jours de visite ou de chasse d’affilée`)
  assert.equal(conditionDuGardien('lg:trou-noir'), `Le Cabinet entier : les ${OEUVRES.length} œuvres`)
  assert.equal(conditionDuGardien('lg:citrouille'), 'Une œuvre gagnée en jouant pendant Halloween')
  assert.equal(conditionDuGardien('lg:bouquet'), 'Une œuvre gagnée en jouant pendant le Nouvel An')
  assert.equal(conditionDuGardien('lg:licorne'), null)
})

test('Protéger porte la première manche imparfaite, Miser la manche misée parfaite, et rien d’autre', () => {
  const carte = (pouvoir: CleDePouvoir, force: Force) => ({ pouvoir, force })
  assert.deepEqual(B.BONUS_DE_PROTECTION, { 1: 1, 2: 1, 3: 2 })
  assert.deepEqual(B.BONUS_DE_MISE, { 1: 2, 2: 3, 3: 4 })
  // Protéger : une fois, la première manche à moins de trois étoiles naturelles, zéro compris ; jamais au-delà de trois.
  assert.deepEqual(etoilesApresLesPouvoirs([3, 1, 0], carte('proteger', 1)), [3, 2, 0])
  assert.deepEqual(etoilesApresLesPouvoirs([3, 1, 0], carte('proteger', 3)), [3, 3, 0])
  assert.deepEqual(etoilesApresLesPouvoirs([0, 1, 2], carte('proteger', 2)), [1, 1, 2])
  assert.deepEqual(etoilesApresLesPouvoirs([2, 3, 3], carte('proteger', 3)), [3, 3, 3])
  assert.deepEqual(etoilesApresLesPouvoirs([3, 3, 3], carte('proteger', 3)), [3, 3, 3], 'trois manches parfaites : rien à protéger')
  assert.equal(mancheProtegee([3, 3, 1], carte('proteger', 1)), 2)
  assert.equal(mancheProtegee([3, null, null], carte('proteger', 1)), null, 'une manche pas encore jugée ne se protège pas')
  assert.equal(mancheProtegee([1, 2, 3], carte('eclairer', 3)), null)
  // Miser : la manche misée, parfaite, vaut 3 + le bonus ; sinon zéro. Les autres ne bougent pas.
  assert.deepEqual(etoilesApresLesPouvoirs([2, 3, 1], carte('miser', 2), 1), [2, 6, 1])
  assert.deepEqual(etoilesApresLesPouvoirs([2, 3, 1], carte('miser', 3), 2), [2, 3, 0])
  assert.deepEqual(etoilesApresLesPouvoirs([3, null, null], carte('miser', 1), 1), [3, null, null], 'misée mais pas encore jouée')
  assert.deepEqual(etoilesApresLesPouvoirs([3, 2, 1], carte('miser', 1), null), [3, 2, 1], 'la mise n’a pas servi')
  // Les trois autres pouvoirs ne touchent pas aux étoiles.
  for (const p of ['eclairer', 'temps', 'changer'] as const) assert.deepEqual(etoilesApresLesPouvoirs([1, 2, 0], carte(p, 3), 0), [1, 2, 0], p)
  assert.deepEqual(etoilesApresLesPouvoirs([1, 2, 0], null), [1, 2, 0])
})

test('pourquoi un pouvoir ne sert pas : une seule règle, en mots', () => {
  const base = { jeu: 'pari' as CleDeJeu, servi: 0 }
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'eclairer', force: 2, aEclairer: true }), null)
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'eclairer', force: 2, servi: 2, aEclairer: true }), 'Éclairer a déjà servi deux fois')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'eclairer', force: 1, servi: 1, aEclairer: true }), 'Éclairer a déjà servi une fois')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'eclairer', force: 3, aEclairer: false }), 'Ce jeu n’a plus rien à éclairer')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'changer', force: 1, rechanges: 1 }), null)
  assert.equal(refusDuPouvoir({ ...base, jeu: 'frise', pouvoir: 'changer', force: 3, rechanges: 3 }), 'Changer ne sert pas à la Frise')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'changer', force: 2, rechanges: 2, aJoue: true }), 'Change avant de répondre')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'changer', force: 1, servi: 1, rechanges: 0 }), 'Plus de rechange pour cette partie')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'miser', force: 1 }), null)
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'miser', force: 3, servi: 1 }), 'La mise a déjà servi')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'proteger', force: 1 }), 'Protéger agit tout seul')
  assert.equal(refusDuPouvoir({ ...base, pouvoir: 'temps', force: 1 }), 'Prendre son temps agit tout seul')
  assert.deepEqual(B.ECLAIRAGES_PAR_PARTIE, { 1: 1, 2: 2, 3: 3 })
  assert.deepEqual(B.CHANGEMENTS_PAR_PARTIE, { 1: 1, 2: 2, 3: 3 })
})

test('Éclairer efface deux propositions au plus, et en laisse toujours deux', () => {
  // La seconde étape de la Réplique n'a que trois noms : deux effacés, une carte-bonus de force 2 donnait la
  // réponse — ce que « deux au plus » voulait justement empêcher sur quatre.
  assert.equal(B.EFFACES_AU_PLUS, 2)
  assert.equal(B.PROPOSITIONS_LAISSEES, 2)
  assert.equal(effacablesAuPlus(B.TITRES_DU_DETAIL), 2, 'le Détail : quatre titres')
  assert.equal(effacablesAuPlus(4), 2, 'le Pari : quatre réponses, à chaque question')
  assert.equal(effacablesAuPlus(B.LEURRES_D_UNE_REPLIQUE + 1), 2, 'la Réplique : quatre mots')
  assert.equal(effacablesAuPlus(B.AUTRES_D_UNE_REPLIQUE + 1), 1, 'la Réplique : trois personnes, un seul nom s’efface')
  for (const n of [0, 1, 2]) assert.equal(effacablesAuPlus(n), 0, `${n} propositions`)
  assert.equal(effacablesAuPlus(9), B.EFFACES_AU_PLUS, 'jamais plus de deux, même sur neuf')
})

test('le Cabinet s’ouvre hors de la production, et en production sous son drapeau', () => {
  assert.equal(cabinetOuvert({ online: true, env: 'production' }), CABINET_EN_PRODUCTION)
  assert.equal(cabinetOuvert({ online: true, env: 'preprod' }), true, 'la préproduction le joue d’abord')
  assert.equal(cabinetOuvert({ online: false, env: 'production' }), true, '`npm run dev` et les tests aussi')
  assert.equal(new Set(JEUX_PRETS).size, JEUX_PRETS.length)
  for (const j of JEUX_PRETS) assert.ok(CLES_DES_JEUX.includes(j), j)
})

test('neuf jeux, chacun ses mots, son chrono et son barème dit', () => {
  assert.deepEqual([...CLES_DES_JEUX].sort(), ['detail', 'eclair', 'epingle', 'filet', 'frise', 'indices', 'mot', 'pari', 'replique'])
  assert.deepEqual(Object.keys(JEUX).sort(), [...CLES_DES_JEUX].sort())
  assert.deepEqual(Object.keys(B.DUREES_DES_JEUX).sort(), [...CLES_DES_JEUX].sort())
  for (const j of CLES_DES_JEUX) {
    assert.equal(JEUX[j].cle, j)
    assert.ok(B.DUREES_DES_JEUX[j] >= 20 && B.DUREES_DES_JEUX[j] <= 120, `${j} : ${B.DUREES_DES_JEUX[j]} s`)
    assert.ok(JEUX[j].a.startsWith('à ') || JEUX[j].a.startsWith('au') || JEUX[j].a.startsWith('aux'), JEUX[j].a)
  }
  // Seule la Frise ne se change pas : elle se construit d'un bout à l'autre.
  assert.deepEqual(CLES_DES_JEUX.filter(j => !JEUX[j].changeable), ['frise'])
  // Le barème dit à l'annonce est celui du code, pour les neuf : chacun se compose des chiffres de `bareme.ts`.
  const etoiles = (n: number) => '★'.repeat(n)
  assert.equal(JEUX.epingle.bareme, `à moins de ${B.KM_DE_L_EPINGLE[0]} km ★★★ · ${B.KM_DE_L_EPINGLE[1]} km ★★ · ${B.KM_DE_L_EPINGLE[2]} km ★`)
  // La Frise, depuis le calibrage du 25 octobre 2026 : deux erreurs ne valent plus une étoile, et l'annonce ne dit
  // pas le palier qui n'existe plus (« deux à une ★ », lu tel quel des bornes [0, 1, 1]).
  assert.equal(JEUX.frise.bareme, 'sans faute ★★★ · une erreur ★★')
  assert.equal(JEUX.mot.bareme, 'en 1 ou 2 essais ★★★ · 3 ou 4 ★★ · 5 ★')
  assert.equal(JEUX.detail.bareme, 'au premier coup d’œil ★★★ · un pas ★★ · deux ★')
  assert.equal(JEUX.filet.bareme, `petit filet ${etoiles(B.ETOILES_DU_FILET.petit)} · moyen ${etoiles(B.ETOILES_DU_FILET.moyen)} · grand ${etoiles(B.ETOILES_DU_FILET.grand)}`)
  assert.equal(JEUX.pari.bareme, `garder ${etoiles(B.ETOILES_DU_PARI.garder)} · parier et réussir ${etoiles(B.ETOILES_DU_PARI.parier)}`)
  assert.equal(JEUX.pari.bareme, 'garder ★★ · parier et réussir ★★★')
  // Le geste du Pari dit les étoiles gardées au nombre du barème : « garde une étoile » en promettait une de moins.
  assert.equal(JEUX.pari.geste, 'Juste : garde deux étoiles, ou parie-les sur une question plus difficile.')
  assert.equal(JEUX.eclair.bareme, '5 justes ★★★ · 4 ★★ · 3 ★')
  // L'Éclair à 55 s : à 45, l'échéance prenait l'occasionnel de court à une manche sur neuf (le calibrage du 25 octobre 2026).
  assert.equal(B.DUREES_DES_JEUX.eclair, 55)
  assert.equal(JEUX.eclair.geste, '5 affirmations en 55 secondes : vraies ou fausses ?')
  // Les Indices comptent les indices vus et les erreurs, et chaque erreur en montre un de plus : le compte monte
  // au-delà des cinq indices d'une fiche, jusqu'à neuf. La dernière étoile n'a pas de plafond.
  assert.equal(JEUX.indices.bareme, 'en 1 à 3 indices ★★★ · 4 ★★ · 5 et plus ★')
  assert.match(JEUX.indices.geste, /erreur/, 'l’annonce dit qu’une erreur compte')
  assert.equal(JEUX.replique.bareme, `le bon mot ${etoiles(B.ETOILES_DE_LA_REPLIQUE.mot)} · la bonne personne ${etoiles(B.ETOILES_DE_LA_REPLIQUE.qui)}`)
  assert.deepEqual(B.ESSAIS_DES_ETOILES, [2, 4, 5])
  assert.equal(B.ESSAIS_DU_MOT, B.ESSAIS_DES_ETOILES[2])
  assert.deepEqual(B.JUSTES_DE_L_ECLAIR, [5, 4, 3])
  assert.equal(B.AFFIRMATIONS_DE_L_ECLAIR, B.JUSTES_DE_L_ECLAIR[0])
  assert.deepEqual(B.INDICES_DES_ETOILES, [3, 4])
  assert.equal(B.INDICES_D_UNE_FICHE, 5)
  assert.deepEqual(B.ERREURS_DE_LA_FRISE, [0, 1, 1])
  assert.deepEqual(B.ETOILES_AU_CADRAGE, [3, 2, 1, 0])
  assert.deepEqual(B.ETOILES_DU_FILET, { petit: 3, moyen: 2, grand: 1 })
  assert.deepEqual(B.ETOILES_DU_PARI, { garder: 2, parier: 3 })
  assert.deepEqual(B.ETOILES_DE_LA_REPLIQUE, { mot: 2, qui: 1 })
})

test('le barème des erreurs dit à l’annonce ne dit jamais un palier vide', () => {
  // Des bornes qui ne montent pas laissent une étoile que rien n'atteint : [0, 1, 1] n'a pas de ★ — deux erreurs
  // valent zéro (`etoilesDeLaFrise`) —, et la lire telle quelle faisait écrire « deux à une ★ ».
  assert.equal(baremeDesErreurs([0, 1, 2]), 'sans faute ★★★ · une erreur ★★ · deux ★')
  assert.equal(baremeDesErreurs([0, 1, 1]), 'sans faute ★★★ · une erreur ★★')
  assert.equal(baremeDesErreurs([0, 2, 4]), 'sans faute ★★★ · une ou deux erreurs ★★ · trois ou quatre ★')
  assert.equal(baremeDesErreurs([0, 0, 1]), 'sans faute ★★★ · une erreur ★')
  assert.equal(baremeDesErreurs([1, 1, 3]), 'au plus une erreur ★★★ · deux ou trois ★')
  for (const bornes of [[0, 1, 1], [0, 0, 1], [1, 1, 3], [0, 0, 0]]) assert.doesNotMatch(baremeDesErreurs(bornes), /\b(\S+) à (\S+)\b/, `${bornes}`)
})

test('une pièce est juste dès deux étoiles naturelles ; au Pari, à sa bonne réponse', () => {
  assert.equal(B.ETOILES_D_UNE_JUSTE, 2)
  assert.equal(justeDeLaPiece(3, 'epingle'), true)
  assert.equal(justeDeLaPiece(2, 'frise'), true)
  assert.equal(justeDeLaPiece(1, 'mot'), false)
  assert.equal(justeDeLaPiece(0, 'detail'), false)
  assert.equal(justeDeLaPiece(3, 'pari'), null, 'le Pari juge sa réponse, pas ses étoiles')
})

test('les chiffres se tiennent entre eux', () => {
  assert.equal(B.ETOILES_D_UNE_PARTIE, B.ETOILES_PAR_MANCHE * B.MANCHES_PAR_PARTIE)
  assert.equal(B.ETOILES_D_UNE_PARTIE, 9)
  assert.deepEqual(B.SEUILS_DES_RARETES, { commun: 5, rare: 6, maudit: 6, epique: 7 })
  for (const r of RARETES) {
    assert.ok(B.SEUILS_DES_RARETES[r] > 0 && B.SEUILS_DES_RARETES[r] <= B.ETOILES_D_UNE_PARTIE, r)
    assert.ok(B.PRIX_D_UNE_DORURE[r] < B.PRIX_D_UNE_OEUVRE[r], `${r} : dorer coûte moins qu’acheter`)
    assert.ok(B.POUSSIERE_DU_DOUBLE[r] < B.PRIX_D_UNE_OEUVRE[r], r)
  }
  assert.deepEqual(B.PRIX_D_UNE_OEUVRE, { commun: 200, rare: 400, maudit: 400, epique: 700 })
  // Doublées, et le double divisé par deux, au calibrage du 25 octobre 2026 : le complétionniste dorait tout en
  // trente jours, quand la maquette le voulait en mois — trente-neuf désormais, deux cent vingt-quatre à l'occasionnel.
  assert.deepEqual(B.PRIX_D_UNE_DORURE, { commun: 100, rare: 200, maudit: 200, epique: 320 })
  assert.deepEqual(B.POUSSIERE_DU_DOUBLE, { commun: 15, rare: 30, maudit: 30, epique: 60 })
  assert.ok(B.POUSSIERE_MIN <= B.POUSSIERE_PAR_ETOILE * B.ETOILES_D_UNE_PARTIE)
  // La Frise : trois vagues, une par manche, qui font une frise de sept.
  assert.equal(B.VAGUES_DE_LA_FRISE.length, B.MANCHES_PAR_PARTIE)
  assert.equal(B.VAGUES_DE_LA_FRISE.reduce((a, b) => a + b, 0), B.EVENEMENTS_D_UNE_FRISE_A_THEME)
  assert.equal(B.EVENEMENTS_D_UNE_FRISE_A_THEME, 7)
  // Les bornes du contenu neuf vivent avec les autres chiffres : la Réplique, quatre mots puis trois personnes.
  assert.equal(B.LEURRES_D_UNE_REPLIQUE, 3)
  assert.equal(B.AUTRES_D_UNE_REPLIQUE, 2)
  // L'Épingle et le Filet : des barèmes qui s'élargissent, une zone d'Éclairer qui contient toujours la réponse.
  assert.ok(B.KM_DE_L_EPINGLE[0] < B.KM_DE_L_EPINGLE[1] && B.KM_DE_L_EPINGLE[1] < B.KM_DE_L_EPINGLE[2])
  assert.ok(B.DECALAGE_DE_LA_ZONE_KM[1] < B.RAYON_D_ECLAIRER_KM, 'le lieu reste dans la zone')
  assert.ok(B.LARGEURS_DU_FILET.petit < B.LARGEURS_DU_FILET.moyen && B.LARGEURS_DU_FILET.moyen < B.LARGEURS_DU_FILET.grand)
  assert.ok(B.POSITION_DE_LA_REPONSE[0] > 0 && B.POSITION_DE_LA_REPONSE[1] < 1 && B.POSITION_DE_LA_REPONSE[0] < B.POSITION_DE_LA_REPONSE[1])
  assert.ok(B.PISTE_DES_ANNEES[0] < B.PISTE_DES_ANNEES[1])
  assert.ok(B.GRACE_D_UNE_MANCHE_MS < 5_000 && B.PAUSE_MAX_MS === 30_000)
  assert.equal(B.CASES_DE_LA_VISITE, B.MANCHES_PAR_PARTIE, 'trois parties de visite, trois jeux')
  assert.deepEqual(Object.keys(B.POIDS_DES_CIBLES).sort(), [...RARETES].sort())
  for (const m of [B.MARCHES_DU_PARI.question, B.MARCHES_DU_PARI.pari, B.MARCHES_DE_L_ECLAIR, B.MARCHES_DU_MOT, B.MARCHES_DU_FILET]) assert.ok(m.length > 0)
  assert.ok(!B.MARCHES_DU_PARI.question.some(m => B.MARCHES_DU_PARI.pari.includes(m)), 'la question du pari est plus difficile que la première')
  assert.equal(Number.isInteger(B.VERSION_DU_CABINET) && B.VERSION_DU_CABINET >= 1, true)
})

test('un seul préfixe pour ce qui n’est pas une question de la base : cab:', () => {
  assert.equal(PREFIXE_DU_CABINET, 'cab:')
  const ids = [
    idDuLieu('arts-hospices-de-beaune'),
    idDeLaFiche('histoire-jules-cesar'),
    idDeLaReplique('cinema-francais-fends-le-coeur'),
    idDuTableau('Q1025704'),
    idDeLEclair(['a1', 'b2', 'c3', 'd4', 'e5']),
    idDeLaFriseATheme('frise-aviation', 2),
    idDeLaFriseDeSujet(['x1', 'y2']),
  ]
  assert.deepEqual(ids, [
    'cab:lieu:arts-hospices-de-beaune',
    'cab:qui:histoire-jules-cesar',
    'cab:replique:cinema-francais-fends-le-coeur',
    'cab:tableau:Q1025704',
    'cab:eclair:a1+b2+c3+d4+e5',
    'cab:frise:t:frise-aviation:2',
    'cab:frise:s:x1+y2',
  ])
  for (const id of ids) assert.ok(estDuCabinet(id), id)
  assert.equal(estDuCabinet('bedpmjvu'), false)
  assert.equal(estDuCabinet('frise:a+b+c+d'), false, 'la frise de l’Expédition a son préfixe à elle')
  // Les composés se déplient en les questions de la base qu'ils ont posées : « rien ne revient avant sept jours », d'un jeu à l'autre.
  assert.deepEqual(deplier('cab:eclair:a1+b2+c3+d4+e5'), ['a1', 'b2', 'c3', 'd4', 'e5'])
  assert.deepEqual(deplier('cab:frise:s:x1+y2'), ['x1', 'y2'])
  assert.deepEqual(deplier('cab:frise:t:frise-aviation:2'), ['cab:frise:t:frise-aviation:2'])
  assert.deepEqual(deplier('cab:lieu:arts-hospices-de-beaune'), ['cab:lieu:arts-hospices-de-beaune'])
  assert.deepEqual(deplier('bedpmjvu'), ['bedpmjvu'])
  // La colonne `joker` : un pouvoir, jamais la clé d'une carte — Bastion et Cuirasse sont aussi des cartes du second essai.
  assert.equal(JOKER_D_ECLAIRER, 'pouvoir:eclairer')
  assert.equal(JOKER_DU_TEMPS, 'pouvoir:temps')
  for (const j of [JOKER_D_ECLAIRER, JOKER_DU_TEMPS]) assert.equal(oeuvre(j), undefined)
  // Le contenu neuf porte des identifiants sans deux-points : le code pose le préfixe, jamais le fichier.
  for (const id of ['arts-hospices-de-beaune', 'frise-aviation', 'q42']) assert.ok(FORME_D_UN_IDENTIFIANT.test(id), id)
  for (const id of ['cab:lieu:x', 'Alesia', 'a--b', '-a', 'a b']) assert.ok(!FORME_D_UN_IDENTIFIANT.test(id), id)
  // Une clé des Indices : trois lettres suffisent (`arc`), sans accents ni majuscules.
  for (const cle of ['arc', 'cesar', 'napoleon']) assert.ok(FORME_D_UNE_CLE.test(cle), cle)
  for (const cle of ['ab', 'césar', 'Hugo', 'jean-paul']) assert.ok(!FORME_D_UNE_CLE.test(cle), cle)
})

test('l’Épingle joue la France métropolitaine et la Corse, à vol d’oiseau', () => {
  assert.deepEqual(DANS_LA_FRANCE, { latMin: 41.3, latMax: 51.1, lonMin: -5.2, lonMax: 9.6 })
  const dedans: [string, number, number][] = [
    ['Brest', 48.39, -4.49],
    ['Strasbourg', 48.58, 7.75],
    ['Dunkerque', 51.03, 2.38],
    ['Menton', 43.77, 7.5],
    ['Ajaccio', 41.92, 8.74],
    ['Bonifacio', 41.39, 9.16],
  ]
  for (const [nom, lat, lon] of dedans) assert.ok(dansLaFrance({ lat, lon }), nom)
  for (const [nom, lat, lon] of [['Londres', 51.51, -0.13], ['Madrid', 40.42, -3.7], ['Rome', 41.9, 12.5]] as const) assert.ok(!dansLaFrance({ lat, lon }), nom)
  assert.ok(!dansLaFrance({ lat: Number.NaN, lon: 2 }))
  assert.ok(!dansLaFrance({ lat: 46, lon: Number.POSITIVE_INFINITY }))
  const paris = { lat: 48.8566, lon: 2.3522 }
  const lyon = { lat: 45.764, lon: 4.8357 }
  const marseille = { lat: 43.2965, lon: 5.3698 }
  const pl = distanceKm(paris, lyon)
  assert.ok(pl > 385 && pl < 400, `Paris–Lyon : ${pl} km`)
  const pm = distanceKm(paris, marseille)
  assert.ok(pm > 650 && pm < 670, `Paris–Marseille : ${pm} km`)
  assert.equal(distanceKm(paris, paris), 0)
  assert.ok(Math.abs(distanceKm(lyon, paris) - pl) < 1e-9)
  // La carte de la page : le nord en haut, l'est à droite, tout le cadre dans le dessin, et l'aller-retour exact.
  for (const lat of [DANS_LA_FRANCE.latMin, DANS_LA_FRANCE.latMax]) {
    for (const lon of [DANS_LA_FRANCE.lonMin, DANS_LA_FRANCE.lonMax]) {
      const { x, y } = projeter({ lat, lon })
      assert.ok(x >= 0 && x <= LARGEUR_DE_LA_CARTE && y >= 0 && y <= HAUTEUR_DE_LA_CARTE, `${lat}, ${lon} → ${x}, ${y}`)
      const retour = deprojeter({ x, y })
      assert.ok(Math.abs(retour.lat - lat) < 1e-9 && Math.abs(retour.lon - lon) < 1e-9)
    }
  }
  assert.ok(projeter(paris).y < projeter(marseille).y, 'le nord en haut')
  assert.ok(projeter({ lat: 48.39, lon: -4.49 }).x < projeter({ lat: 48.58, lon: 7.75 }).x, 'l’est à droite')
})

test('les mots du Cabinet : une œuvre, une carte-bonus, la carte de France — jamais « carte » seule', () => {
  // « Carte » a déjà forcé l'Expédition à rebaptiser « le plan » : ici, trois mots pour trois choses.
  const textes: string[] = [
    ...CLES_DES_JEUX.flatMap(j => [JEUX[j].nom, JEUX[j].a, JEUX[j].geste, JEUX[j].bareme, JEUX[j].eclairer]),
    ...Object.values(POUVOIRS).flatMap(p => [p.nom, p.dit]),
    ...(['eclairer', 'proteger', 'temps', 'miser', 'changer'] as const).flatMap(p => ([1, 2, 3] as const).map(f => forceDite(p, f))),
    ...SALLES.flatMap(s => [s.nom, s.laSalle, s.deLaSalle, s.dansLaSalle, s.devise]),
    ...GARDIENS.map(g => conditionDuGardien(g)!),
  ]
  for (const t of textes) {
    assert.ok(!/\bcartes?\b(?!-bonus| de France)/i.test(t), `« ${t} » : dis « œuvre », « carte-bonus » ou « carte de France »`)
    assert.ok(!/\bbadges?\b|médailles?/i.test(t), t)
  }
})

test('chaque chiffre de `bareme.ts` a sa ligne dans les barèmes', () => {
  // `documentation.test.ts` va de la page au code : une ligne qui ment rougit, une constante sans ligne passe.
  // Ici, du code à la page — un chiffre du Cabinet est un choix de produit, qui se dit (`baremes.md`).
  const page = readFileSync(new URL('../../docs/reference/baremes.md', import.meta.url), 'utf8')
  const dites = new Set([...page.matchAll(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|[^|\n]*\|\s*`shared\/cabinet\/bareme\.ts`/gm)].map(m => m[1]))
  assert.ok(Object.keys(B).length > 60, `${Object.keys(B).length} constantes lues`)
  assert.deepEqual(Object.keys(B).filter(nom => !dites.has(nom)), [], 'sans ligne dans docs/reference/baremes.md')
})

/** Les modules qu'un fichier importe pour leurs valeurs : `import type` s'efface à la compilation, rien ne se tire. */
function importsDeValeurs(fichier: URL): URL[] {
  const texte = readFileSync(fichier, 'utf8')
  // Un import (pas `import type`), une réexportation, un import pour son effet : jamais d'autre chaîne entre les deux.
  const relatifs = [...texte.matchAll(/^(?:import\s+(?!type\b)|export\s+(?:\*|\{))(?:[^;'"]*?\bfrom\s+)?'(\.[^']+)'/gm)].map(m => m[1])
  return relatifs.map(r => {
    const trouve = [`${r}.ts`, `${r}.tsx`, `${r}/index.ts`, r].map(c => new URL(c, fichier)).find(u => existsSync(u))
    assert.ok(trouve, `${fichier.pathname} : ${r} introuvable`)
    return trouve!
  })
}

test('le journal, l’accueil et la page lisent le Cabinet sans tirer les rencontres', () => {
  const dossier = new URL('../../shared/cabinet/', import.meta.url)
  // Leurs en-têtes le promettent : le journal des réponses lit `pieces.ts`, l'accueil et le serveur `ouverture.ts`,
  // tout le Cabinet `bareme.ts` — sans rien tirer. Un import de valeur de plus ferait tirer le Cabinet en silence.
  for (const f of ['bareme.ts', 'pieces.ts', 'ouverture.ts']) assert.deepEqual(importsDeValeurs(new URL(f, dossier)).map(u => u.pathname), [], `${f} : n’importe que des types`)
  // Et rien du Cabinet, de proche en proche, ne tire `shared/rencontres.ts` : 4 782 lignes, qui partiront avec l'Expédition.
  const rencontres = new URL('../rencontres.ts', dossier).href
  const vus = new Set<string>()
  const aVoir = readdirSync(dossier, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts')).map(f => new URL(f, dossier))
  for (let u = aVoir.pop(); u; u = aVoir.pop()) {
    if (vus.has(u.href)) continue
    vus.add(u.href)
    assert.notEqual(u.href, rencontres, 'un module du Cabinet tire shared/rencontres.ts')
    aVoir.push(...importsDeValeurs(u))
  }
  assert.ok(vus.size >= 9, `${vus.size} modules relus`)
})

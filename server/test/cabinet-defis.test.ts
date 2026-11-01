// Les défis de tes cartes et les épreuves de maître (le 1er novembre 2026,
// `retours/2026-11-01/defis-des-cartes.md`) : leur catalogue, ce qu'une
// traversée relevée tient — une épreuve conclue d'avant, qui ne disait pas ce
// qui y avait servi, ne prouve rien —, ce qui se range et ce qu'on en lit ;
// puis au serveur : la page qui range ce qui manque, et la relecture des
// traversées passées au démarrage, ce qui a servi repris de leurs parties.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { ecrire, inscrireProfil } from './banc'
import { aLaMain, bancDuCabinet, commencer, enBase, fermerLesMagasins, jouer, lire, ok, poster, type BancDuCabinet } from './cabinet-banc'
import { cleDeSerie } from '../src/auth/profiles'
import { RELECTURE_DES_DEFIS } from '../src/core/cabinet/magasin'
import { clesARanger } from '../src/core/cabinet/gardiens'
import * as B from '../../shared/cabinet/bareme'
import { CONDITIONS_DE_MAITRISE, DEFIS, VERSION_DES_DEFIS, defiDeLaCarte, defisDeLaTraversee, maitriseCourte, maitriseDite, releverLaTraversee } from '../../shared/cabinet/defis'
import { MAITRISES, NOMS_DES_CARTES, NOMS_DES_DEFIS, cleDeLaMaitrise, cleDuRang, confettisDesDefis, defisAuMoins, defisTenus, gerbeDesDefis, legendaireDesDefis, nomDuTitreDuDefi, titresDesDefis } from '../../shared/cabinet/sceaux'
import {
  CARTES,
  CLES_DES_CARTES,
  GARDIENS_DES_ACTES,
  GARDIENS_DE_LA_TRAVERSEE,
  GARDIEN_D_HALLOWEEN,
  VERSION_DE_LA_TRAVERSEE,
  etatDeLaTraversee,
  lireUnGesteDeLaTraversee,
  tracerLaCarte,
  type AidesDUneEpreuve,
  type CleDeCarte,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraversee,
  type GesteDeLaTraverseeEcrit,
} from '../../shared/cabinet/traversee'
import { LEGENDAIRE_DES_DEFIS, cleDuCabinet } from '../../shared/legendaires'
import { voieDuGardien } from '../../shared/cabinet/salles'
import type { PageDeLaTraversee } from '../../shared/cabinet/vues'

// ── Une traversée écrite à la main ────────────────────────────────────────

interface Ecriture {
  cartes: CleDeCarte[]
  gardiens: [string, string, string]
  /** Les étoiles de chaque manche d'une épreuve, selon son rang dans la traversée et si c'est un gardien. */
  etoiles?: (n: number, gardien: boolean) => readonly (number | null)[]
  /** Ce qui a servi dans chaque épreuve ; null : une épreuve conclue avant que le serveur l'écrive. */
  aides?: AidesDUneEpreuve | null
  /** La partie de chaque épreuve : une partie réelle, rejouée par la relecture ; d'office une fausse. */
  partie?: (n: number) => string
  arret?: (e: EtatDeLaTraversee) => boolean
}

/**
 * Une traversée jouée au pli, geste par geste, comme le serveur les aurait écrits : le premier chemin vers une épreuve,
 * chaque amélioration à la première carte qui monte, les épreuves conclues aux étoiles demandées — sans faute d'office.
 */
function traversee({ cartes, gardiens, etoiles = () => [3, 3, 3], aides = { eclairer: 0, changer: 0, temps: 0 }, partie = n => `p${n}`, arret = e => e.fin !== null }: Ecriture) {
  let x = 7
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const depart: DepartDeLaTraversee = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-11-01', actes: tracerLaCarte(hasard, gardiens, { epingle: ['Rome'], frise: ['Rome'] }) }
  const gestes: GesteDeLaTraverseeEcrit[] = []
  const etat = () => etatDeLaTraversee(depart, gestes)
  const pousser = (g: GesteDeLaTraversee) => gestes.push({ geste: g, faitLe: gestes.length + 1 })
  pousser({ quoi: 'cartes', cartes })
  let e = etat()
  let n = 0
  for (let garde = 0; garde < 300 && !arret(e) && !e.fin; garde++) {
    if (e.ameliorations > 0) pousser({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 2)?.cle ?? e.cartes[0].cle })
    else if (e.ou.sorte === 'legendaire') pousser({ quoi: 'legendaire', gardien: e.vaincus[0] })
    else {
      const ici = depart.actes[e.acte].etapes
      const suivantes = e.ou.sorte === 'gardien' ? [e.ou.etape] : ici.find(s => s.id === e.position)!.suivantes
      const etape = ici.find(s => s.id === (suivantes.find(id => ici.find(s => s.id === id)?.sorte === 'epreuve') ?? suivantes[0]))!
      if (etape.sorte === 'coffre' || etape.sorte === 'marchand') pousser({ quoi: 'aller', etape: etape.id })
      else {
        const p = partie(++n)
        pousser({ quoi: 'epreuve', etape: etape.id, partie: p })
        const manches = etoiles(n, etape.sorte === 'gardien').map(etoiles => ({ etoiles, misee: false }))
        pousser({ quoi: 'conclure', partie: p, manches, ...(aides && { aides }) })
      }
    }
    e = etat()
  }
  assert.equal(e.ignores, 0, 'le pli accepte chaque geste écrit')
  return { depart, gestes, etat: e }
}

const GARDIENS: [string, string, string] = ['lg:renard', 'lg:sphinx', 'lg:dragon']

// ── Les règles, pures ─────────────────────────────────────────────────────

test('le catalogue : un défi par carte, dans l’ordre des cartes, trois rangs dits ; une épreuve de maître par gardien', () => {
  assert.deepEqual(
    DEFIS.map(x => x.carte),
    [...CLES_DES_CARTES],
  )
  assert.deepEqual(Object.keys(NOMS_DES_DEFIS), [...CLES_DES_CARTES], 'les noms, écrits une fois, dans l’ordre des cartes')
  for (const x of DEFIS) {
    assert.equal(x.nom, NOMS_DES_DEFIS[x.carte])
    assert.equal(new Set(x.rangs).size, 3, `${x.nom} : trois rangs différents`)
    for (const r of x.rangs) assert.match(r, /^[A-ZÉ0-9]/, `${x.nom} : « ${r} »`)
    for (const r of x.rangs) assert.doesNotMatch(r, /undefined|NaN/)
    assert.equal(defiDeLaCarte(x.carte), x)
  }
  assert.equal(defiDeLaCarte('constructor'), null, 'une clé se lit par une Map, jamais par une table')
  // Les chiffres de l'écran se composent du barème.
  assert.match(defiDeLaCarte('cagnotte')!.rangs[0], new RegExp(`^${B.OR_DU_TRESORIER[0]} pièces`))
  assert.match(defiDeLaCarte('quitte-ou-double')!.rangs[2], /^Huit mises/)
  for (const g of GARDIENS_DE_LA_TRAVERSEE) assert.match(maitriseDite(g.cle) ?? '', /^Le vaincre /, g.cle)
  assert.equal(maitriseDite('lg:inconnu'), null)
  assert.equal(maitriseDite('lg:scarabee'), `Le vaincre avec ${B.OR_D_UNE_MAITRISE[0]} pièces en poche`)
  assert.equal(maitriseDite('lg:dragon'), `Le vaincre avec ${B.OR_D_UNE_MAITRISE[2]} pièces en poche`)
  // Et en quelques mots, sous le médaillon de chaque gardien (« trop de texte », le propriétaire, le 1er novembre 2026) :
  // tenus sur trois lignes dans le tiers d'un écran de 360, au barème pour l'or.
  for (const g of GARDIENS_DE_LA_TRAVERSEE) {
    const court = maitriseCourte(g.cle) ?? ''
    assert.ok(court.length > 0 && court.length <= 24, `${g.cle} : « ${court} »`)
    assert.match(court, /^[A-ZÀ-Ý0-9★]/, `${g.cle} : une majuscule, sous le médaillon`)
  }
  assert.equal(maitriseCourte('lg:inconnu'), null)
  assert.equal(maitriseCourte('lg:dragon'), `${B.OR_D_UNE_MAITRISE[2]} pièces en poche`)
  // Le module léger que lit l'album des trophées recopie ce qu'il dit de la traversée sans la tirer : le nom de chaque
  // carte, et l'acte de chaque gardien — dont l'or d'une épreuve de maître dépend (`OR_D_UNE_MAITRISE[acte]`). L'album
  // les montre dans cet ordre : les cartes comme au choix, les gardiens acte par acte, la Citrouille avec l'acte I.
  assert.deepEqual(Object.entries(NOMS_DES_CARTES), CARTES.map(c => [c.cle, c.nom]), 'les noms des cartes, recopiés pour l’album')
  assert.deepEqual([...MAITRISES.keys()], [...GARDIENS_DES_ACTES[0], GARDIEN_D_HALLOWEEN, ...GARDIENS_DES_ACTES[1], ...GARDIENS_DES_ACTES[2]], 'une épreuve par gardien, acte par acte')
  assert.deepEqual([...MAITRISES.keys()].sort(), GARDIENS_DE_LA_TRAVERSEE.map(g => g.cle).sort(), 'aucun gardien de la traversée sans la sienne')
  for (const [g, m] of MAITRISES) {
    assert.equal(m.acte, g === GARDIEN_D_HALLOWEEN ? 0 : GARDIENS_DES_ACTES.findIndex(gs => gs.includes(g)), `${g} : l’acte de son cercle`)
    assert.equal(typeof CONDITIONS_DE_MAITRISE[m.sorte], 'function', `${g} : sa condition`)
  }
})

test('une traversée gagnée sans faute : les défis de ses cartes, les gardiens vaincus en maître, épreuve par épreuve', () => {
  const t = traversee({ cartes: ['coup-d-oeil', 'cagnotte', 'panacee'], gardiens: GARDIENS })
  assert.equal(t.etat.fin?.issue, 'gagnee')
  const r = releverLaTraversee(t.depart, t.gestes)
  assert.ok(r.gagnee)
  assert.deepEqual(r.cartes, ['coup-d-oeil', 'cagnotte', 'panacee'])
  assert.ok(r.actes.every(a => a.fini && a.coeursPerdus === 0 && a.parees === 0 && a.aides?.eclairer === 0))
  const { cles, parPartie } = defisDeLaTraversee(t.depart, t.gestes)
  // L'Œil nu et l'Increvable : les trois actes sans un Coup d'œil, sans un cœur perdu — les trois rangs.
  for (const carte of ['coup-d-oeil', 'panacee'] as const) for (const k of [1, 2, 3] as const) assert.ok(cles.includes(cleDuRang(carte, k)), cleDuRang(carte, k))
  // Le Trésorier, à l'or qu'il avait à chaque chute, relevé.
  const orMax = Math.max(...r.actes.map(a => a.orALaChute ?? 0))
  assert.equal(cles.includes(cleDuRang('cagnotte', 1)), orMax >= B.OR_DU_TRESORIER[0])
  assert.equal(cles.includes(cleDuRang('cagnotte', 3)), (r.actes[2].orALaChute ?? 0) >= B.OR_DU_TRESORIER[2])
  // Seules ses cartes comptent : rien de la Parade, qu'il n'a pas.
  assert.ok(!cles.some(c => c.startsWith('cabinet:defi:parade')))
  // Le Renard sans perdre une étoile, le Sphinx sans rater une manche : vaincus en maître. Le Dragon, selon son or.
  assert.ok(cles.includes(cleDeLaMaitrise('lg:renard')))
  assert.ok(cles.includes(cleDeLaMaitrise('lg:sphinx')))
  assert.equal(cles.includes(cleDeLaMaitrise('lg:dragon')), (r.actes[2].orALaChute ?? 0) >= B.OR_D_UNE_MAITRISE[2])
  // Chaque clé tombe à l'épreuve qui l'a faite : le Bronze de l'Œil nu à la chute du premier gardien, l'Or au dernier.
  const ou = (cle: string) => [...parPartie].find(([, cs]) => cs.includes(cle))?.[0]
  const chutes = t.gestes.filter(g => g.geste.quoi === 'conclure').map(g => (g.geste as { partie: string }).partie)
  assert.ok(ou(cleDuRang('coup-d-oeil', 1)))
  assert.ok(chutes.indexOf(ou(cleDuRang('coup-d-oeil', 1))!) < chutes.indexOf(ou(cleDuRang('coup-d-oeil', 3))!))
  assert.equal([...parPartie.values()].flat().length, cles.length, 'chaque clé tombe une fois')
})

test('une épreuve conclue d’avant ne prouve rien de ce qui y a servi ; une traversée perdue garde ce qu’elle avait tenu', () => {
  // Sans les aides écrites, un acte ne se compte pas « sans un Coup d'œil » : rien ne le prouve.
  const ancienne = traversee({ cartes: ['coup-d-oeil', 'echange', 'concentration'], gardiens: GARDIENS, aides: null })
  const vieilles = defisDeLaTraversee(ancienne.depart, ancienne.gestes).cles
  assert.ok(!vieilles.some(c => c.startsWith('cabinet:defi:')), vieilles.join(', '))
  assert.ok(vieilles.includes(cleDeLaMaitrise('lg:renard')), 'une épreuve de maître ne lit que les étoiles')
  // Écrites, et toutes à zéro : les trois défis « sans » tombent, les trois rangs.
  const neuve = traversee({ cartes: ['coup-d-oeil', 'echange', 'concentration'], gardiens: GARDIENS })
  const tenues = defisDeLaTraversee(neuve.depart, neuve.gestes).cles
  for (const carte of ['coup-d-oeil', 'echange', 'concentration'] as const) assert.ok(tenues.includes(cleDuRang(carte, 3)), carte)
  // Un Coup d'œil à chaque épreuve : plus rien de l'Œil nu.
  const eclaire = traversee({ cartes: ['coup-d-oeil', 'echange', 'concentration'], gardiens: GARDIENS, aides: { eclairer: 1, changer: 0, temps: 0 } })
  assert.ok(!defisDeLaTraversee(eclaire.depart, eclaire.gestes).cles.includes(cleDuRang('coup-d-oeil', 1)))
  // Perdue à l'acte II, toutes ses manches ratées dès sa sixième épreuve : l'acte I fini sans un cœur perdu le reste.
  const perdue = traversee({ cartes: ['panacee', 'cagnotte', 'pourboire'], gardiens: GARDIENS, etoiles: n => (n > 5 ? [0, 0, 0] : [3, 3, 3]) })
  assert.equal(perdue.etat.fin?.issue, 'perdue')
  const gardees = defisDeLaTraversee(perdue.depart, perdue.gestes).cles
  assert.ok(gardees.includes(cleDuRang('panacee', 1)), gardees.join(', '))
  assert.ok(!gardees.includes(cleDuRang('panacee', 3)))
})

test('ce qui se range : les clés qui manquent, le légendaire du gardien vaincu en maître, celui des dix Or', () => {
  const renard = cleDeLaMaitrise('lg:renard')
  assert.deepEqual(clesARanger([cleDuRang('cagnotte', 1), renard], new Map()), [cleDuRang('cagnotte', 1), renard, voieDuGardien('lg:renard')])
  // Déjà rangé, d'où qu'il vienne : rien ne se range deux fois.
  assert.deepEqual(clesARanger([cleDuRang('cagnotte', 1), renard], new Map([[cleDuRang('cagnotte', 1), 1], [voieDuGardien('lg:renard')!, 1]])), [renard])
  // La Citrouille, gardien de saison : sa voie est sa saison.
  assert.deepEqual(clesARanger([cleDeLaMaitrise('lg:citrouille')], new Map()), [cleDeLaMaitrise('lg:citrouille'), 'saison:halloween'])
  // Le dixième Or — neuf rangés, le dernier atteint à l'instant : le légendaire des défis.
  const neufOr = new Map(CLES_DES_CARTES.slice(0, 9).map(c => [cleDuRang(c, 3), 1] as const))
  const dernier = cleDuRang(CLES_DES_CARTES[9], 3)
  assert.deepEqual(clesARanger([dernier], neufOr), [dernier, cleDuCabinet(LEGENDAIRE_DES_DEFIS)])
  assert.deepEqual(clesARanger([], neufOr), [], 'neuf Or ne suffisent pas')
})

test('ce qu’on lit des clés rangées : les rangs, les maîtres, les confettis, les titres, la gerbe et le légendaire', () => {
  const cles = [cleDuRang('cagnotte', 1), cleDuRang('cagnotte', 2), cleDuRang('parade', 1), cleDeLaMaitrise('lg:dragon'), 'cabinet:defi:bastion:1', 'cabinet:defi:parade:4', 'cabinet:phenix', 'hf:habitue:1']
  const t = defisTenus(cles)
  assert.equal(t.rangs.cagnotte, 2)
  assert.equal(t.rangs.parade, 1)
  assert.equal(t.rangs['coup-d-oeil'], 0)
  assert.deepEqual(t.maitrises, ['lg:dragon'])
  // Les confettis : chaque rang tenu une fois, quelle que soit le nombre de ses lignes.
  const recompenses = new Map(cles.map(c => [c, c === cleDuRang('cagnotte', 1) ? 2 : 1] as const))
  assert.equal(confettisDesDefis(recompenses), 2 * B.CONFETTIS_D_UN_RANG[0] + B.CONFETTIS_D_UN_RANG[1])
  assert.equal(confettisDesDefis(new Map([[cleDuRang('cagnotte', 1), 0]])), 0)
  // L'Or fait porter son nom.
  assert.equal(nomDuTitreDuDefi(cleDuRang('cagnotte', 3)), 'Le Trésorier')
  assert.equal(nomDuTitreDuDefi(cleDuRang('cagnotte', 2)), null)
  const tous = defisTenus(CLES_DES_CARTES.map(c => cleDuRang(c, 3)))
  assert.deepEqual(titresDesDefis(tous), CLES_DES_CARTES.map(c => cleDuRang(c, 3)))
  assert.equal(defisAuMoins(tous, 2), CLES_DES_CARTES.length, 'un Or tient l’Argent')
  assert.ok(gerbeDesDefis(tous) && legendaireDesDefis(tous))
  assert.ok(!gerbeDesDefis(t))
})

test('le geste qui conclut une épreuve porte ce qui y a servi ; d’avant, il se lit sans', () => {
  const manches = [3, 2, 0].map(etoiles => ({ etoiles, misee: false }))
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'conclure', partie: 'p1', manches }, true), { quoi: 'conclure', partie: 'p1', manches })
  assert.deepEqual(lireUnGesteDeLaTraversee({ quoi: 'conclure', partie: 'p1', manches, aides: { eclairer: 2, changer: 0, temps: 1 } }, true), {
    quoi: 'conclure',
    partie: 'p1',
    manches,
    aides: { eclairer: 2, changer: 0, temps: 1 },
  })
  for (const aides of [{ eclairer: -1, changer: 0, temps: 0 }, { eclairer: 0, changer: 0, temps: 9 }, 'rien', null]) {
    assert.equal(lireUnGesteDeLaTraversee({ quoi: 'conclure', partie: 'p1', manches, aides }, true), null, JSON.stringify(aides))
  }
  assert.equal(lireUnGesteDeLaTraversee({ quoi: 'conclure', partie: 'p1', manches }), null, 'jamais de la page')
  // Les conditions des épreuves de maître se lisent une à une.
  assert.deepEqual(Object.keys(CONDITIONS_DE_MAITRISE).sort(), ['apresLeSouffle', 'apresUnCoeurPerdu', 'dEntree', 'orEnPoche', 'sansFaute', 'sansPerdreUnCoeur', 'surUneMise', 'toutesLesEtoiles', 'unSeulAssaut'])
})

// ── Au serveur ────────────────────────────────────────────────────────────

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

let n = 0
const unProfil = () => inscrireProfil(b.banc.url, `defieur${++n}`, `Défieur ${n}`)
const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
/** Une traversée écrite en base, comme le serveur l'aurait écrite. */
function enBaseALaMain(profil: string, id: string, t: { depart: DepartDeLaTraversee; gestes: readonly GesteDeLaTraverseeEcrit[] }, commenceeLe = 1) {
  aLaMain(
    b.fichier,
    [
      `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(t.depart))}, ${commenceeLe})`,
      ...t.gestes.map(({ geste }, k) => `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, ${k + 1}, ${q(JSON.stringify(geste))}, ${k + 2}, 'u${k}')`),
    ].join(';\n'),
  )
}
const sousLeCabinet = (profil: string): string[] =>
  enBase(b.fichier, db => (db.prepare("SELECT badge FROM profile_badges WHERE profile_id = ? AND soiree_id = '#cabinet' ORDER BY badge").all(profil) as { badge: string }[]).map(r => r.badge))

test('la page de la traversée range ce que ses épreuves ont tenu, et dit ce qu’il tient', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  // L'acte I fini sans faute, l'Œil nu en main : écrite derrière le dos du serveur, elle se relit au redémarrage.
  const t = traversee({ cartes: ['coup-d-oeil', 'cagnotte', 'panacee'], gardiens: GARDIENS, arret: e => e.acte === 1 })
  enBaseALaMain(profil, `defis-de-${profil}`, t)
  await b.banc.redemarrer()
  const page = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page')
  const attendues = defisDeLaTraversee(t.depart, t.gestes).cles
  assert.ok(attendues.includes(cleDuRang('coup-d-oeil', 1)))
  assert.deepEqual([...page.traversee!.sceaux.atteints].sort(), [...attendues].sort())
  assert.ok(page.defis.rangs['coup-d-oeil'] >= 1)
  assert.deepEqual(page.defis.maitrises, ['lg:renard'], 'le Renard vaincu sans perdre une étoile')
  // Rangés sous le Cabinet, le légendaire du Renard compris : il est à lui.
  const ranges = sousLeCabinet(profil)
  for (const c of attendues) assert.ok(ranges.includes(c), c)
  assert.ok(ranges.includes(voieDuGardien('lg:renard')!))
  assert.ok(page.possedes.includes('lg:renard'))
  // Une page de plus ne range rien de neuf.
  ok(await lire(b, cookie, '/api/cabinet/traversee'), 'la page encore')
  assert.deepEqual(sousLeCabinet(profil), ranges)
  // Les clés du Cabinet ne sont pas des trophées : le compte des badges de son profil ne les voit pas.
  const moi = ok(await lire(b, cookie, '/api/joueur/moi?leger'), 'le profil')
  assert.equal(moi.profile.badges ?? 0, 0)
})

test('une traversée gagnée fait tomber L’Explorateur au choix de son légendaire, rangé sous elle ; la page du profil la compte', async () => {
  // L'Explorateur compte les traversées gagnées depuis le 1er novembre 2026 — les salles complètes d'un musée que la
  // traversée a remplacé, jusque-là. La traversée se gagne au choix du légendaire, après sa dernière épreuve : son
  // palier tombe là, sans attendre la fin de la partie suivante.
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  type Vu = { key: string; fois: number; valeur: number; prochain: number | null }
  const explorateur = async () => (ok(await lire(b, cookie, '/api/joueur/moi'), 'le profil').profile.hautsFaits as Vu[]).find(h => h.key === 'hf:explorateur')!
  const avant = await explorateur()
  assert.deepEqual([avant.fois, avant.valeur, avant.prochain], [0, 0, 1])
  // Les trois gardiens vaincus, le légendaire à choisir : écrite derrière son dos, elle se relit au redémarrage.
  const t = traversee({ cartes: ['cagnotte', 'panacee', 'pourboire'], gardiens: GARDIENS, arret: e => e.ou.sorte === 'legendaire' })
  const id = `explorateur-de-${profil}`
  enBaseALaMain(profil, id, t)
  await b.banc.redemarrer()
  const page = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page')
  assert.equal(page.traversee!.ou.sorte, 'legendaire')
  assert.equal((await explorateur()).valeur, 0, 'pas encore gagnée')
  ok(await poster(b, cookie, `/api/cabinet/traversee/${id}/geste`, { rang: page.traversee!.rang, geste: { quoi: 'legendaire', gardien: 'lg:renard' } }), 'le légendaire choisi')
  // Rangé sous la traversée, comme un palier sous la partie qui le fait tomber — jamais sous `#cabinet`.
  const sous = enBase(b.fichier, db => (db.prepare("SELECT soiree_id FROM profile_badges WHERE profile_id = ? AND badge = 'hf:explorateur:1'").all(profil) as { soiree_id: string }[]).map(r => r.soiree_id))
  assert.deepEqual(sous, [cleDeSerie(id)])
  const apres = await explorateur()
  assert.deepEqual([apres.fois, apres.valeur, apres.prochain], [1, 1, 5])
})

test('au démarrage, les traversées d’avant se relisent une fois : ce qui a servi se reprend de leurs parties', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  // Une vraie partie du Cabinet, quittée d'emblée : rien n'y a servi.
  const libre = ok(await commencer(b, cookie, { origine: 'libre', jeu: 'eclair', carte: null }), 'la partie')
  ok(await jouer(b, cookie, libre, { quoi: 'quitter' }), 'quitter')
  // Une traversée d'avant les aides — ses épreuves conclues sans les dire —, chacune sur cette partie-là.
  const t = traversee({ cartes: ['coup-d-oeil', 'echange', 'concentration'], gardiens: GARDIENS, aides: null, partie: () => libre.id })
  enBaseALaMain(profil, `ancienne-de-${profil}`, t)
  aLaMain(b.fichier, `DELETE FROM campagne_meta WHERE cle = ${q(RELECTURE_DES_DEFIS)}`)
  await b.banc.redemarrer()
  // Rangés sans qu'une page les lise : la relecture du démarrage.
  const ranges = sousLeCabinet(profil)
  for (const carte of ['coup-d-oeil', 'echange', 'concentration'] as const) for (const k of [1, 2, 3] as const) assert.ok(ranges.includes(cleDuRang(carte, k)), `${carte} ${k}`)
  assert.ok(ranges.includes(cleDeLaMaitrise('lg:renard')))
  const version = enBase(b.fichier, db => (db.prepare('SELECT valeur FROM campagne_meta WHERE cle = ?').get(RELECTURE_DES_DEFIS) as { valeur: string } | undefined)?.valeur)
  assert.equal(Number(version), VERSION_DES_DEFIS)
  // Une fois : effacée derrière son dos, la ligne ne revient pas au démarrage suivant.
  aLaMain(b.fichier, `DELETE FROM profile_badges WHERE profile_id = ${q(profil)} AND badge = ${q(cleDuRang('echange', 3))}`)
  await b.banc.redemarrer()
  assert.ok(!sousLeCabinet(profil).includes(cleDuRang('echange', 3)))
})

test('ce que les défis rapportent : les confettis au solde, le titre de l’Or porté, la gerbe des cartes, le Djinn', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  const confettis = async () => ok(await lire(b, cookie, '/api/joueur/moi'), 'le profil').profile.boutique.confettis.gagnes as number
  const avant = await confettis()
  // Le titre d'un Or qu'il n'a pas se refuse.
  const titre = cleDuRang('cagnotte', 3)
  assert.equal((await ecrire(b.banc.url, '/api/joueur/moi', { titre }, cookie, 'PUT')).status, 400)
  // Les dix défis tenus à l'Or, rangés sous le Cabinet derrière le dos du serveur, comme l'aurait fait une traversée.
  const ranges = CLES_DES_CARTES.flatMap(c => [1, 2, 3].map(k => cleDuRang(c, k as 1 | 2 | 3)))
  aLaMain(
    b.fichier,
    ranges.map(c => `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (${q(profil)}, ${q(c)}, '#cabinet', '', '🃏', 'défi', 1)`).join(';\n'),
  )
  await b.banc.redemarrer()
  // Le solde : chaque Bronze et chaque Argent, une fois.
  assert.equal((await confettis()) - avant, CLES_DES_CARTES.length * (B.CONFETTIS_D_UN_RANG[0] + B.CONFETTIS_D_UN_RANG[1] + B.CONFETTIS_D_UN_RANG[2]))
  // Le titre de l'Or, porté et relu.
  const porte = await ecrire(b.banc.url, '/api/joueur/moi', { titre }, cookie, 'PUT')
  assert.equal(porte.status, 200, await porte.clone().text())
  const moi = ok(await lire(b, cookie, '/api/joueur/moi'), 'le profil relu')
  assert.equal(moi.profile.titre, titre)
  assert.ok((moi.profile.titresDuCabinet as string[]).includes(titre))
  // La gerbe des cartes, ouverte à cinq Argent ; le Djinn, rangé au dixième Or par la page de la traversée.
  assert.ok((moi.profile.gerbes as string[]).includes('cartes'))
  ok(await lire(b, cookie, '/api/cabinet/traversee'), 'la page')
  assert.ok(sousLeCabinet(profil).includes(cleDuCabinet(LEGENDAIRE_DES_DEFIS)), 'le Djinn')
  const page = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page relue')
  assert.ok(page.possedes.includes(LEGENDAIRE_DES_DEFIS))
})

test('la page du profil dit à l’album ce qu’il tient : là où le Cabinet s’ouvre, et partout à qui en tient un', async () => {
  // La page « Cabinet » de l'album des trophées lit ses défis et ses épreuves de maître dans la page du profil
  // (`PublicProfileDetail.defisDuCabinet`). Là où le Cabinet s'ouvre, chacun la reçoit — tout à gagner d'abord.
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  const sesDefis = async (bc: BancDuCabinet, c: string) => ok(await lire(bc, c, '/api/joueur/moi'), 'le profil').profile.defisDuCabinet as { rangs: Record<string, number>; maitrises: string[] } | undefined
  const neuf = await sesDefis(b, cookie)
  assert.ok(neuf && Object.values(neuf.rangs).every(r => r === 0) && neuf.maitrises.length === 0, 'tout à gagner')
  // Un rang tenu donne ceux d'en dessous : seul le plus haut se lit ; et le gardien vaincu en maître.
  const tenir = (bc: BancDuCabinet, qui: string) =>
    aLaMain(
      bc.fichier,
      [cleDuRang('cagnotte', 2), cleDeLaMaitrise('lg:dragon')]
        .map(c => `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (${q(qui)}, ${q(c)}, '#cabinet', '', '🃏', 'défi', 1)`)
        .join(';\n'),
    )
  tenir(b, profil)
  await b.banc.redemarrer()
  const tenus = await sesDefis(b, cookie)
  assert.equal(tenus?.rangs.cagnotte, 2)
  assert.equal(tenus?.rangs.parade, 0)
  assert.deepEqual(tenus?.maitrises, ['lg:dragon'])

  // Là où il est fermé, rien à qui n'y a rien gagné — sa collection ne compterait pas « 0 sur 51 » ce qui ne s'y gagne
  // pas —, mais un rang tenu ne se perd jamais, ni de vue : à son détenteur, comme L'Explorateur.
  const ferme = await bancDuCabinet({ cabinet: false })
  try {
    const sans = await inscrireProfil(ferme.banc.url, 'sans-defi', 'Sans')
    const detenteur = await inscrireProfil(ferme.banc.url, 'detenteur-defi', 'Détenteur')
    tenir(ferme, (await lire(ferme, detenteur, '/api/joueur/moi?leger')).corps.profile.id as string)
    await ferme.banc.redemarrer()
    assert.equal(await sesDefis(ferme, sans), undefined, 'tu à qui n’a rien')
    assert.deepEqual((await sesDefis(ferme, detenteur))?.maitrises, ['lg:dragon'], 'dit à qui en tient un')
  } finally {
    await ferme.banc.close()
  }
})

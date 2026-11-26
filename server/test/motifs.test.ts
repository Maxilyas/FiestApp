// Les motifs des bordures de ligue (le 26 novembre 2026, `shared/motifs.ts`) :
// la ligue se gagne, le motif se choisit. D'office accordé à l'avatar porté ;
// à la main, un motif qu'il tient — offert, prêté par une bordure sertie,
// gagné en duel, acheté en boutique ou à sa fête, tiré du coffre. Acheter un
// motif n'achète ni la ligue ni un cran : le dessin garde le métal, l'insigne
// et les douze crans de la ligue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CRANS_D_UNE_BORDURE, bordurePortee, releverLesDuels, type DuelJoue } from '../../shared/duels'
import { MOTIFS, MOTIFS_DU_TRESOR, MOTIFS_EN_BOUTIQUE, PRIX_D_UN_MOTIF, PRIX_D_UN_MOTIF_DE_SAISON, VICTOIRES_POUR_LES_ROUAGES, motifsTenus, prixDuMotif } from '../../shared/motifs'
import { ACCORDS_ECRITS, MOTIF_D_OFFICE, motifAccorde } from '../../shared/motifAccorde'
import { lireEnvie, prixDeLEnvie, refusDeLEnvie } from '../../shared/envie'
import { cleDeLObjet, lireLObjet } from '../../shared/coffre'
import { tirerLeCoffre } from '../../shared/tresor'
import { motifsEnRayon } from '../../shared/rayons'

const duClient = (f: string) => import(new URL(`../../client/src/${f}`, import.meta.url).href)

test('chaque motif du catalogue se dessine, chacun à sa façon, au métal et à l’insigne de sa ligue', async () => {
  const d = await duClient('components/dessinDesBordures.ts')
  for (const m of MOTIFS) assert.ok(d.MOTIFS_DESSINES.includes(m.key), `${m.key} : son dessin`)
  for (const k of ACCORDS_ECRITS) assert.ok(MOTIFS.some(m => m.key === k), `l’accord « ${k} » nomme un motif du catalogue`)
  // Les Feuilles restent la parure d'avant, au caractère près : un nom inconnu les garde aussi.
  assert.equal(d.svgDuCadre('or', 7, 'feuilles'), d.svgDuCadre('or', 7))
  assert.equal(d.svgDuCadre('or', 7, 'feuilles-or'), d.svgDuCadre('or', 7))
  assert.equal(d.svgDuCadre('or', 7, 'inconnu'), d.svgDuCadre('or', 7))
  assert.equal(d.dessinDeBordure('or', 7, 'inconnu'), d.dessinDeBordure('or', 7))
  const dessins = MOTIFS.map(m => d.svgDuCadre('or', CRANS_D_UNE_BORDURE, m.key))
  assert.equal(new Set(dessins.filter((_, i) => MOTIFS[i].key !== 'feuilles-or')).size, MOTIFS.length - 1, 'un dessin par motif')
  for (const m of MOTIFS) {
    for (const ligue of ['bronze', 'maitre'] as const) {
      const svg = d.svgDuCadre(ligue, 5, m.key)
      // Le fil de la ligue, toujours : un motif ne change ni le métal ni le cadre entier.
      assert.match(svg, /fill-rule="evenodd" fill="url\(#m\)"/, `${m.key} en ${ligue} : son fil`)
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${m.key} en ${ligue} : un tracé lisible`)
    }
    // Sertie, elle s'illumine, quel que soit le motif.
    assert.match(d.svgDuCadre('argent', 12, m.key), /stroke-width="7" opacity="\.5" filter="url\(#b\)"/, m.key)
    assert.doesNotMatch(d.svgDuCadre('argent', 11, m.key), /stroke-width="7" opacity="\.5" filter="url\(#b\)"/, m.key)
  }
  // Chaque cran se voit : douze victoires ne dessinent pas ce qu'en dessinent onze.
  for (const m of MOTIFS.filter(x => x.key !== 'nu')) assert.notEqual(d.svgDuCadre('or', 11, m.key), d.svgDuCadre('or', 12, m.key), m.key)
  // L'éclat qui fait le tour suit la forme du motif, pas celle des feuilles.
  assert.notEqual(d.svgDeLaSilhouette('argent', 12, 'perles'), d.svgDeLaSilhouette('argent', 12))
  assert.equal(d.svgDeLaSilhouette('or', 12, 'perles'), null)
})

test('accordée : le motif suit l’avatar porté ; un emoji, un Divin gardent les feuilles', () => {
  assert.equal(motifAccorde('lg:phenix'), 'flammes')
  assert.equal(motifAccorde('lg:dragon'), 'ecailles')
  assert.equal(motifAccorde('lg:kraken'), 'vagues')
  assert.equal(motifAccorde('br:poseidon'), 'vagues', 'un portrait qui n’a pas l’allure de sa branche')
  assert.equal(motifAccorde('br:minotaure'), 'grecque', 'un portrait prend celle de sa branche')
  assert.equal(motifAccorde('cp:panda-sakura'), 'fleurs', 'un compagnon, toutes ses formes')
  assert.equal(motifAccorde('🦊'), MOTIF_D_OFFICE)
  assert.equal(motifAccorde('dv:seraphin'), MOTIF_D_OFFICE)
  assert.equal(motifAccorde(null), MOTIF_D_OFFICE)
  // Le motif choisi voyage avec la bordure portée ; sans choix, rien : le dessin l'accorde.
  const bordures = [{ ligue: 'bronze' as const, crans: 12 }, { ligue: 'argent' as const, crans: 3 }]
  assert.deepEqual(bordurePortee('auto', bordures), { ligue: 'argent', crans: 3 })
  assert.deepEqual(bordurePortee('auto', bordures, 'vagues'), { ligue: 'argent', crans: 3, motif: 'vagues' })
  assert.equal(bordurePortee('aucune', bordures, 'vagues'), null)
})

test('ce qui ouvre les motifs se relit : bordures serties, ligue des maîtres, victoires au dé, achats, coffres, légendaires', () => {
  const offerts = ['feuilles', 'jonc', 'nu']
  assert.deepEqual(motifsTenus({}), offerts)
  const serties = [
    { ligue: 'bronze' as const, crans: 12 },
    { ligue: 'argent' as const, crans: 12 },
    { ligue: 'or' as const, crans: 11 },
  ]
  assert.deepEqual(motifsTenus({ bordures: serties }), [...offerts, 'feuilles-bronze', 'feuilles-argent', 'perles'])
  assert.ok(motifsTenus({ bordures: [{ ligue: 'maitre', crans: 0 }] }).includes('flammes'), 'la ligue des maîtres atteinte')
  assert.ok(!motifsTenus({ victoiresAuDe: VICTOIRES_POUR_LES_ROUAGES - 1 }).includes('rouages'))
  assert.ok(motifsTenus({ victoiresAuDe: VICTOIRES_POUR_LES_ROUAGES }).includes('rouages'))
  assert.ok(motifsTenus({ achetes: new Set(['vagues']) }).includes('vagues'))
  assert.ok(motifsTenus({ tresors: new Set(['motif:couronne']) }).includes('couronne'))
  assert.ok(motifsTenus({ legendaires: ['lg:sapin'] }).includes('houx'), 'le légendaire de Noël ouvre le Houx')
  // Les victoires au dé se comptent au relevé : contre Automate seulement, rien ne s'y reprend.
  const duel = (i: number, contreQuelquUn: boolean): DuelJoue => ({ serie: `s${i}`, justes: 9, sesJustes: 2, finiLe: i, ...(contreQuelquUn && { coteAdverse: 1000 }) })
  assert.equal(releverLesDuels([duel(1, false), duel(2, false), duel(3, true)], () => 'semaine').victoiresAuDe, 2)
})

test('la boutique vend les siens toute l’année, ceux de saison à leur fête, jamais ceux qui se gagnent', () => {
  assert.ok(MOTIFS_EN_BOUTIQUE.length >= 12, 'de quoi couvrir des styles différents')
  assert.ok(MOTIFS_DU_TRESOR.length >= 6, 'plusieurs motifs au coffre de la semaine')
  const novembre = '2026-11-26'
  const noel = '2026-12-22'
  assert.equal(prixDuMotif(MOTIFS.find(m => m.key === 'vagues')!, novembre), PRIX_D_UN_MOTIF)
  assert.equal(prixDuMotif(MOTIFS.find(m => m.key === 'houx')!, novembre), null)
  assert.equal(prixDuMotif(MOTIFS.find(m => m.key === 'houx')!, noel), PRIX_D_UN_MOTIF_DE_SAISON)
  for (const k of ['perles', 'couronne', 'feuilles-or', 'jonc']) assert.equal(prixDuMotif(MOTIFS.find(m => m.key === k)!, noel), null, k)
  assert.ok(!motifsEnRayon([], novembre).some(m => m.key === 'houx'))
  assert.ok(motifsEnRayon([], noel).some(m => m.key === 'houx'))
  assert.ok(!motifsEnRayon(['vagues'], novembre).some(m => m.key === 'vagues'), 'le sien n’est plus en rayon')
  // Son envie : un motif qui se vend, hors de sa fête refusé en le disant.
  const houx = lireEnvie('motif:houx')!
  assert.equal(prixDeLEnvie(houx), PRIX_D_UN_MOTIF_DE_SAISON)
  assert.equal(refusDeLEnvie(houx, { themes: [], compagnons: [], fonds: [] }, novembre), 'Le Houx n’est en boutique que du 20 au 26 décembre : choisis-en un autre.')
  assert.equal(refusDeLEnvie(lireEnvie('motif:vagues')!, { themes: [], compagnons: [], fonds: [], motifs: ['vagues'] }, novembre), 'Les Vagues sont déjà à toi.')
  assert.equal(prixDeLEnvie(lireEnvie('motif:couronne')!), null, 'le coffre ne se vend pas')
})

test('le coffre de la semaine donne ses motifs du trésor, et la clé gardée se relit', () => {
  assert.deepEqual(lireLObjet(cleDeLObjet({ sorte: 'motif', cle: 'papillons' }), 0), { sorte: 'motif', cle: 'papillons' })
  // Tout possédé sauf les motifs : un coffre royal, au plus haut, tombe sur la couronne.
  const tire = tirerLeCoffre('royal', { possede: o => o.sorte !== 'motif', hasard: () => 0.999, jour: '2026-11-26' })
  assert.deepEqual(tire.objet, { sorte: 'motif', cle: 'couronne' })
  assert.equal(tire.rarete, 'legendaire')
})

// ── Au serveur ─────────────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)
const confettis = (banc: Banc, profileId: string, justes: number) =>
  enBase(banc, db =>
    db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, ?, 1, 0)`).run(profileId, justes),
  )
const acheter = (banc: Banc, cookie: string, motif: string, porter?: boolean) =>
  ecrire(banc.url, '/api/joueur/motifs', { motif, ...(porter === false && { porter }) }, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const porter = (banc: Banc, cookie: string, patch: object) => ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const moi = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

test('un motif s’achète à son prix, se porte ou se garde, compte au solde ; ce qui se gagne se refuse en clair', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT })
  try {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    const avant = await moi(banc, cookie)
    assert.deepEqual(avant.motifs, ['feuilles', 'jonc', 'nu'], 'les offerts, d’office')
    assert.equal(avant.motifChoisi ?? null, null, 'accordé à son avatar')

    assert.equal((await acheter(banc, cookie, 'vagues')).corps.error, `Il te manque ${PRIX_D_UN_MOTIF} confettis pour les Vagues`)
    assert.equal((await acheter(banc, cookie, 'licorne')).corps.error, 'Ce motif n’existe pas')
    assert.equal((await acheter(banc, cookie, 'couronne')).corps.error, 'Ce motif ne se vend pas : il ne sort que du coffre de la semaine')
    assert.match((await acheter(banc, cookie, 'rouages')).corps.error, /^Ce motif ne se vend pas : il se gagne en duel/)
    assert.equal((await acheter(banc, cookie, 'jonc')).corps.error, 'Le Jonc serti est déjà à toi')
    assert.equal((await acheter(banc, cookie, 'houx')).corps.error, 'Le Houx n’est en boutique que du 20 au 26 décembre')

    // Un motif qu'il ne tient pas ne se porte pas ; un offert, si ; « accorde » revient à l'avatar.
    assert.match((await porter(banc, cookie, { motif: 'vagues' })).corps.error, /^Ce motif se gagne d’abord : 400 confettis en boutique/)
    assert.equal((await porter(banc, cookie, { motif: 'jonc' })).corps.profile.motifChoisi, 'jonc')
    assert.equal((await porter(banc, cookie, { motif: 'accorde' })).corps.profile.motifChoisi, null)

    confettis(banc, alice, 600)
    const achat = await acheter(banc, cookie, 'vagues')
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(achat.corps.motifChoisi, 'vagues', 'porté aussitôt')
    assert.ok(achat.corps.motifs.includes('vagues'))
    assert.deepEqual(achat.corps.boutique.confettis, { gagnes: 600, depenses: PRIX_D_UN_MOTIF, solde: 600 - PRIX_D_UN_MOTIF })
    assert.equal((await acheter(banc, cookie, 'vagues')).corps.error, 'Les Vagues sont déjà à toi')
    const garde = await acheter(banc, cookie, 'etoiles', false)
    assert.equal(garde.corps.error, `Il te manque ${2 * PRIX_D_UN_MOTIF - 600} confettis pour les Étoiles`)

    // Relu après un redémarrage : à lui pour de bon, porté, et payé une fois.
    await banc.redemarrer()
    const relu = await moi(banc, cookie)
    assert.equal(relu.motifChoisi, 'vagues')
    assert.ok(relu.motifs.includes('vagues'))
    assert.equal(relu.boutique.confettis.solde, 600 - PRIX_D_UN_MOTIF)
    assert.equal(enBase(banc, db => (db.prepare('SELECT prix FROM profile_motifs WHERE profile_id = ?').get(alice) as { prix: number }).prix), PRIX_D_UN_MOTIF)
  } finally {
    await banc.close()
  }
})

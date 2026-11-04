// Les alertes et les incidents du QG (le QG 2, lot 8 ; la proposition du 3
// novembre 2026) : quatorze règles — les six qui sonnaient déjà, huit de
// plus —, leurs seuils réglables, un réglage d'exploitation et jamais un
// barème ; un incident ouvert à la première minute où une règle se dit,
// refermé après cinq minutes de calme ; le téléphone pour celles qu'on choisit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire } from './banc'
import { DirectDuServeur } from '../src/core/pouls'
import { ReglesDuQg, lecteurDesAlertes } from '../src/core/regles'
import {
  CALME_POUR_CLORE_MS,
  CLES_DES_REGLES,
  REGLE,
  REGLES_DU_QG,
  chiffresDesIncidents,
  depasse,
  graviteDe,
  lesSeuils,
  lireLeReglage,
  rappelEnEchec,
  reglesOuvertes,
  type IncidentDuQg,
  type PageDesAlertes,
  type ReleveDesAlertes,
} from '../../shared/qgAlertes'
import { ALERTE_JOURS_D_AVANCE, type DirectDuQg, type VueDEnsemble } from '../../shared/qg'
import { MEMOIRE_PLAFOND_MO, PART_DU_QUOTA_EN_ALERTE, TURSO_LENT_MS } from '../../shared/santeDuServeur'
import type { MessageDuQg } from '../../shared/pannes'

const MINUTE = 60_000
/** Les espaces insécables de la typographie (`espacesFines`) ramenées à des espaces : on compare des mots. */
const sansInsecables = (t: string) => t.replace(/[\u00a0\u202f]/g, ' ')

/** Un relevé au calme : rien ne s'y dit. */
const calme = (maintenant = 1_700_000_000_000): ReleveDesAlertes => ({
  maintenant,
  pannes: [],
  arretNet: null,
  erreurs: null,
  turso: null,
  memoireMo: 200,
  quotaPart: null,
  ressenti: { p95: 120, appels: 400 },
  requetes: { n: 900, enErreur: 0 },
  gelMs: 300,
  miroir: { enEchecDepuis: null, espacesEnRetard: 0 },
  reserveJours: 30,
  rappel: { envoyes: 40, echecs: 0 },
  soir: null,
  ralenties: [],
})

test('le catalogue : quatorze règles, chacune ses bornes, et les seuils d’office sont ceux du code', () => {
  assert.equal(REGLES_DU_QG.length, 14)
  assert.deepEqual(new Set(REGLES_DU_QG.map(r => r.cle)).size, 14)
  assert.deepEqual([...CLES_DES_REGLES].sort(), REGLES_DU_QG.map(r => r.cle).sort())
  for (const r of REGLES_DU_QG) {
    if (!r.seuil) continue
    const { defaut, min, max, pas } = r.seuil
    assert.ok(min <= defaut && defaut <= max, `${r.cle} : son défaut dans ses bornes`)
    assert.ok(Math.abs(Math.round(defaut / pas) * pas - defaut) < 1e-9, `${r.cle} : son défaut sur son pas`)
  }
  // Les seuils qui existaient gardent leur valeur : la page ne change rien tant qu'on n'y touche pas.
  assert.equal(REGLE['turso-lent'].seuil?.defaut, TURSO_LENT_MS)
  assert.equal(REGLE.memoire.seuil?.defaut, MEMOIRE_PLAFOND_MO)
  assert.equal(REGLE.quota.seuil?.defaut, PART_DU_QUOTA_EN_ALERTE)
  assert.equal(REGLE.reserve.seuil?.defaut, ALERTE_JOURS_D_AVANCE)
  // Le téléphone sonne d'office pour la panne d'un mode, et les deux que la maquette y ajoutait.
  assert.deepEqual(REGLES_DU_QG.filter(r => r.telephone).map(r => r.cle).sort(), ['miroir', 'panne', 'taux-d-erreur'])
  assert.equal(REGLES_DU_QG.filter(r => r.neuve).length, 8, 'huit règles proposées le 3 novembre 2026')
})

test('un réglage se relit par sa règle : dans ses bornes, sur son pas, refusé en clair sinon — jamais ramené en silence', () => {
  assert.deepEqual(lireLeReglage('ressenti', { seuil: 900 }), { seuil: 900 })
  // Le défaut ne s'écrit pas : la règle le reprend d'elle-même.
  assert.deepEqual(lireLeReglage('ressenti', { seuil: 800 }, { seuil: 900 }), {})
  assert.deepEqual(lireLeReglage('taux-d-erreur', { seuil: 1.5 }), { seuil: 1.5 })
  assert.deepEqual(lireLeReglage('taux-d-erreur', { seuil: 1.7 }), { seuil: 1.5 }, 'sur son pas d’un demi')
  assert.throws(() => lireLeReglage('ressenti', { seuil: 10 }), /Le seuil va de 200 ms à 5 s/)
  assert.throws(() => lireLeReglage('ressenti', { seuil: '900' }), /nombre/)
  assert.throws(() => lireLeReglage('panne', { seuil: 3 }), /pas de seuil/)
  assert.deepEqual(lireLeReglage('gel-long', { telephone: true }), { telephone: true })
  assert.deepEqual(lireLeReglage('panne', { telephone: true }), {}, 'la panne sonne déjà d’office')
  assert.throws(() => lireLeReglage('panne', { telephone: 'oui' }), /sonne, ou non/)
})

test('chaque règle s’ouvre sur ce qu’elle guette, à son seuil, et pas sous le nombre qui la fait juger', () => {
  assert.deepEqual([...reglesOuvertes(calme(), {}).keys()], [], 'au calme')
  const tout: ReleveDesAlertes = {
    ...calme(),
    pannes: [{ mode: 'jour', depuis: 0, echecs: 4, dernierEchec: 0, source: 'POST /api/jour/repondre', dernier: 'SQLITE_BUSY' } as any],
    arretNet: { vers: 0 },
    erreurs: { n: 3, source: 'GET /api/cabinet' },
    turso: { p95: 1400 },
    memoireMo: 470,
    quotaPart: 62,
    ressenti: { p95: 950, appels: 300 },
    requetes: { n: 400, enErreur: 12 },
    gelMs: 3500,
    miroir: { enEchecDepuis: null, espacesEnRetard: 2 },
    reserveJours: 4,
    rappel: { envoyes: 9, echecs: 3 },
    soir: { joue: 0 },
    ralenties: [{ route: 'POST /api/cabinet/traversee/:id/geste', avant: 300, apres: 520 }],
  }
  const ouvertes = reglesOuvertes(tout, {})
  assert.deepEqual([...ouvertes.keys()].sort(), [...CLES_DES_REGLES].sort(), 'les quatorze')
  assert.equal(ouvertes.get('taux-d-erreur'), '3 % des requêtes en erreur (12 sur 400)')
  assert.equal(ouvertes.get('version'), 'POST /api/cabinet/traversee/:id/geste : 300 ms → 520 ms')
  // Réglées plus haut, elles se taisent.
  const reglees = reglesOuvertes(tout, { ressenti: { seuil: 1000 }, 'gel-long': { seuil: 4000 }, reserve: { seuil: 3 }, 'taux-d-erreur': { seuil: 5 } })
  for (const cle of ['ressenti', 'gel-long', 'reserve', 'taux-d-erreur'] as const) assert.ok(!reglees.has(cle), cle)
  // Trop peu pour juger : dix-neuf appels, quarante-neuf requêtes, quatre envois.
  const peu = reglesOuvertes({ ...calme(), ressenti: { p95: 4000, appels: 19 }, requetes: { n: 49, enErreur: 49 }, rappel: { envoyes: 0, echecs: 4 } }, {})
  assert.deepEqual([...peu.keys()], [])
  // Un soir où l'on a joué, rien ; un soir que le serveur n'a pas écouté en entier (null), rien non plus.
  assert.ok(!reglesOuvertes({ ...calme(), soir: { joue: 3 } }, {}).has('silence'))
})

test('les chiffres des trente jours : la médiane du retour au calme, et la part du temps où aucun mode n’était en panne', () => {
  const maintenant = 1_700_000_000_000
  const H = 3_600_000
  const incidents: IncidentDuQg[] = [
    { id: 1, regle: 'panne', gravite: 'critique', debut: maintenant - 10 * H, fin: maintenant - 8 * H, cause: '', mot: null },
    // Deux pannes qui se chevauchent ne comptent qu'une fois leur temps commun.
    { id: 2, regle: 'panne', gravite: 'critique', debut: maintenant - 9 * H, fin: maintenant - 7 * H, cause: '', mot: null },
    { id: 3, regle: 'turso-lent', gravite: 'veille', debut: maintenant - 5 * H, fin: maintenant - 4 * H, cause: '', mot: null },
    { id: 4, regle: 'erreurs', gravite: 'serieux', debut: maintenant - H, fin: null, cause: '', mot: null },
  ]
  const c = chiffresDesIncidents(incidents, maintenant)
  assert.equal(c.n, 4)
  assert.equal(c.critiques, 2)
  assert.equal(c.retourMedianMs, 2 * H, 'la médiane de 2 h, 2 h, 1 h')
  assert.equal(c.pannesMs, 3 * H)
  assert.equal(c.disponibilite, Math.round((1 - (3 * H) / (30 * 24 * H)) * 10_000) / 100)
})

/** Un magasin des règles sur une base jetable, l'horloge et le relevé à la main. */
async function desRegles(dir: string, etat: { maintenant: number; releve: ReleveDesAlertes }, prevenus: MessageDuQg[]) {
  const regles = new ReglesDuQg(`file:${path.join(dir, 'permanente.db')}`, undefined, {
    lire: async () => ({ ...etat.releve, maintenant: etat.maintenant }),
    prevenir: m => prevenus.push(m),
    maintenant: () => etat.maintenant,
  })
  await regles.init()
  return regles
}

test('un incident naît à la première minute, survit à un redémarrage, et se referme après cinq minutes de calme', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-regles-'))
  const etat = { maintenant: 1_700_000_000_000, releve: calme() }
  const prevenus: MessageDuQg[] = []
  let regles = await desRegles(dir, etat, prevenus)
  // Le taux d'erreur s'ouvre — il sonne au téléphone d'office ; le ressenti aussi — lui non.
  etat.releve = { ...calme(), requetes: { n: 200, enErreur: 10 }, ressenti: { p95: 1200, appels: 80 } }
  await regles.tour()
  assert.deepEqual(prevenus.map(m => sansInsecables(m.titre)), ['Alerte : Taux d’erreur'])
  assert.deepEqual(regles.aTraiter().map(a => a.cle).sort(), ['ressenti', 'taux-d-erreur'])
  let page: PageDesAlertes = await regles.page(1)
  assert.equal(page.incidents.length, 2)
  assert.ok(page.incidents.every(i => i.fin === null))

  // Le serveur redémarre : les incidents ouverts continuent, sans doublon.
  regles.close()
  regles = await desRegles(dir, etat, prevenus)
  etat.maintenant += MINUTE
  await regles.tour()
  assert.equal((await regles.page(1)).incidents.length, 2, 'pas un incident de plus')
  assert.equal(prevenus.length, 1, 'ni une sonnerie de plus')

  // Le calme revient : quatre minutes ne suffisent pas, cinq si.
  etat.releve = calme()
  etat.maintenant += MINUTE
  const auCalme = etat.maintenant
  await regles.tour()
  etat.maintenant += CALME_POUR_CLORE_MS - MINUTE
  await regles.tour()
  assert.ok((await regles.page(1)).incidents.every(i => i.fin === null), 'encore ouverts')
  etat.maintenant += MINUTE
  await regles.tour()
  page = await regles.page(1)
  assert.ok(page.incidents.every(i => i.fin === auCalme), 'refermés à l’instant où le calme est revenu')
  assert.deepEqual(prevenus.map(m => sansInsecables(m.titre)).slice(1), ['Au calme : Taux d’erreur'])
  assert.deepEqual(regles.aTraiter(), [])
  regles.close()
})

test('un réglage s’écrit, se relit au démarrage, et un réglage qui ne change rien se refuse', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-regles-'))
  const etat = { maintenant: 1_700_000_000_000, releve: calme() }
  let regles = await desRegles(dir, etat, [])
  await regles.regler('ressenti', { seuil: 1500 })
  await regles.regler('memoire', { seuil: 480 })
  await assert.rejects(regles.regler('ressenti', { seuil: 1500 }), /déjà celui-là/)
  assert.deepEqual(regles.seuilsDuServeur(), { tursoLentMs: TURSO_LENT_MS, memoireMo: 480, partDuQuota: PART_DU_QUOTA_EN_ALERTE })
  regles.close()
  regles = await desRegles(dir, etat, [])
  const page = await regles.page(0)
  assert.equal(page.regles.find(r => r.cle === 'ressenti')?.seuil, 1500)
  // Revenu au défaut, la ligne s'efface.
  await regles.regler('ressenti', { seuil: 800 })
  const base = new Database(path.join(dir, 'permanente.db'), { readonly: true })
  assert.deepEqual(base.prepare('SELECT cle FROM qg_reglages ORDER BY cle').all(), [{ cle: 'memoire' }])
  base.close()
  assert.equal(ReglesDuQg.phraseDuReglage('ressenti', { seuil: 900 }, {}), 'Alerte réglée : Ressenti dégradé — seuil 800 ms (avant 900 ms)')
  regles.close()
})

test('ce que les règles lisent : le ressenti et le taux sur le direct, le soir de 19 h à 22 h, la version qui tourne', async () => {
  // Le 4 novembre 2026 à 22 h 30, heure de Paris (21 h 30 UTC).
  const soir = Date.UTC(2026, 10, 4, 21, 30)
  let t = Date.UTC(2026, 10, 4, 17, 0)
  const direct = new DirectDuServeur(() => t)
  t = soir - 5 * MINUTE
  for (let i = 0; i < 40; i++) direct.route('GET /api/jour', i < 38 ? 100 : 2000, 200)
  for (let i = 0; i < 60; i++) direct.requete(i < 3 ? 500 : 200)
  t = soir
  const lire = lecteurDesAlertes({
    alertes: async memoireMo => ({ pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo, quota: null }),
    versions: async () => [{ version: 'abc', ralenties: [{ route: 'GET /api/jour', avant: 100, apres: 200 }] } as any],
    direct,
    miroir: () => ({ enEchecDepuis: null, espacesEnRetard: 0 }),
    reserve: async () => ({ joursDAvance: 12 }),
    rappel: () => null,
    memoireMo: () => 300,
    version: 'abc',
    maintenant: () => soir,
  })
  const r = await lire()
  assert.equal(r.ressenti?.appels, 40)
  assert.deepEqual(r.requetes, { n: 60, enErreur: 3 })
  assert.deepEqual(r.soir, { joue: 0 }, 'écouté depuis 18 h, personne n’a joué : le silence se juge')
  assert.deepEqual(r.ralenties.map(x => x.route), ['GET /api/jour'])
  // Un profil passé au quiz du jour à 20 h : le soir n'est plus silencieux.
  t = Date.UTC(2026, 10, 4, 19, 10)
  direct.joueur('jour', 'p1')
  t = soir
  assert.deepEqual((await lire()).soir, { joue: 1 })
  // Un serveur démarré à 20 h ne juge pas le soir : il n'a pas tout entendu.
  const tard = new DirectDuServeur(() => Date.UTC(2026, 10, 4, 19, 0))
  const lireTard = lecteurDesAlertes({
    alertes: async () => ({ pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo: null, quota: null }),
    versions: async () => [],
    direct: tard,
    miroir: () => null,
    reserve: async () => null,
    rappel: () => null,
    memoireMo: () => null,
    version: null,
    maintenant: () => soir,
  })
  assert.equal((await lireTard()).soir, null)
})

test('au banc : la page des alertes, un seuil réglé au journal, refusé en clair hors de ses bornes, et « À traiter » qui le sait', async () => {
  const banc = await demarrer({ reglesDuQgMs: 60_000 })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lire = (chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: admin } })
    const page = (await (await lire('/api/admin/regles')).json()) as PageDesAlertes
    assert.equal(page.regles.length, 14)
    assert.ok(page.regles.every(r => r.ouverte === null), 'un serveur neuf est au calme')
    const regle = await ecrire(banc.url, '/api/admin/regles/reserve', { seuil: 3 }, admin, 'PUT')
    assert.equal(regle.status, 200)
    assert.equal(((await regle.json()) as PageDesAlertes).regles.find(r => r.cle === 'reserve')?.seuil, 3)
    const refus = await ecrire(banc.url, '/api/admin/regles/ressenti', { seuil: 99_999 }, admin, 'PUT')
    assert.equal(refus.status, 400)
    assert.match(((await refus.json()) as { error: string }).error, /Le seuil va de/)
    assert.equal((await ecrire(banc.url, '/api/admin/regles/inconnue', { seuil: 3 }, admin, 'PUT')).status, 404)
    assert.equal((await ecrire(banc.url, '/api/admin/incidents/424242/mot', { mot: 'rien' }, admin)).status, 404)
    // La vue d'ensemble dit le seuil réglé de la réserve, et les règles neuves ouvertes.
    const vue = (await (await lire('/api/admin/qg')).json()) as VueDEnsemble
    assert.equal(vue.aTraiter.seuilDeLaReserve, 3)
    assert.deepEqual(vue.aTraiter.alertes, [])
    // Le direct prête au client les seuils de toutes les règles, réglés ou d'office : ses voyants et ses compteurs s'y
    // jugent comme les règles s'ouvrent — un seuil écrit dans le client rougissait à 800 ms une règle réglée à 900.
    assert.equal((await ecrire(banc.url, '/api/admin/regles/ressenti', { seuil: 900 }, admin, 'PUT')).status, 200)
    const direct = (await (await lire('/api/admin/qg/direct')).json()) as DirectDuQg
    assert.deepEqual([direct.seuils?.ressenti, direct.seuils?.reserve, direct.seuils?.memoire], [900, 3, MEMOIRE_PLAFOND_MO])
    assert.equal(direct.seuils?.panne, undefined, 'une règle sans seuil n’en prête pas')
  } finally {
    await banc.close()
  }
})

test('une seule comparaison et une seule gravité : la règle, à son seuil réglé, juge la ligne, le voyant et le compteur', () => {
  // La réserve passe son seuil par en dessous, le quota dès qu'il l'atteint, les autres au-delà.
  assert.deepEqual([depasse('reserve', 6, {}), depasse('reserve', 7, {})], [true, false])
  assert.deepEqual([depasse('quota', PART_DU_QUOTA_EN_ALERTE, {}), depasse('quota', PART_DU_QUOTA_EN_ALERTE - 1, {})], [true, false])
  assert.deepEqual([depasse('ressenti', 800, {}), depasse('ressenti', 801, {})], [false, true])
  // Un seuil réglé vaut partout ; une règle sans seuil ne se juge pas à une mesure.
  assert.equal(depasse('ressenti', 850, { ressenti: 900 }), false)
  assert.equal(depasse('panne', 99, {}), false)
  // La gravité, celle de la règle ; le quota seul monte d'un cran, critique aux quatre cinquièmes du mois.
  assert.equal(graviteDe('gel-long', 25_800, {}), 'veille', 'un gel de 25,8 s n’est plus neutre au direct')
  assert.equal(graviteDe('gel-long', 2_000, {}), null)
  assert.equal(graviteDe('memoire', 470, {}), 'serieux')
  assert.deepEqual([graviteDe('quota', 60, {}), graviteDe('quota', 85, {})], ['veille', 'critique'])
  assert.equal(graviteDe('ressenti', null, {}), null)
  // Les seuils de toutes les règles qui en ont un, réglés ou d'office : ce que le direct prête au client.
  const seuils = lesSeuils({ ressenti: { seuil: 900 } })
  assert.deepEqual([seuils.ressenti, seuils.memoire, seuils.panne], [900, MEMOIRE_PLAFOND_MO, undefined])
  // Le rappel : sur cinq envois au moins, une part d'échecs passé son seuil — trois sur quatre-vingt-dix ne sont pas une panne.
  assert.equal(rappelEnEchec({ envoyes: 87, echecs: 3 }, {}), false)
  assert.equal(rappelEnEchec({ envoyes: 3, echecs: 1 }, {}), false, 'quatre envois ne se jugent pas')
  assert.equal(rappelEnEchec({ envoyes: 78, echecs: 12 }, {}), true)
  // Et les règles s'ouvrent à la même comparaison : 850 ms sous un seuil réglé à 900 se taisent, 950 se disent.
  assert.equal(reglesOuvertes({ ...calme(), ressenti: { p95: 850, appels: 400 } }, { ressenti: { seuil: 900 } }).has('ressenti'), false)
  assert.equal(reglesOuvertes({ ...calme(), ressenti: { p95: 950, appels: 400 } }, { ressenti: { seuil: 900 } }).has('ressenti'), true)
  // Une règle mène où l'on agit : un gel long à « Ce qui gèle », la réserve à « Réserves et base ».
  assert.deepEqual([REGLE['gel-long'].page, REGLE['gel-long'].onglet], ['serveur', 'gels'])
  assert.equal(REGLE.reserve.page, 'reserves')
})

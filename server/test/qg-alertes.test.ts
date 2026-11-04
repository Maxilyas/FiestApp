// Les alertes et les incidents du QG (le QG 2, lot 8 ; la proposition du 3
// novembre 2026) : seize règles — les six qui sonnaient déjà, huit de la
// proposition, et deux de la revue d'expert du 4 novembre 2026 : la sauvegarde
// ancienne et les heures de l'hébergeur —, leurs seuils réglables, un réglage
// d'exploitation et jamais un barème ; un incident ouvert à la première minute
// où une règle se dit, refermé après cinq minutes de calme ; le téléphone pour
// celles qu'on choisit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, patienter } from './banc'
import { ceQuiTournait } from '../src/core/gels'
import { DirectDuServeur } from '../src/core/pouls'
import { ReglesDuQg, heuresDeLHebergeur, lecteurDesAlertes } from '../src/core/regles'
import {
  CALME_POUR_CLORE_MS,
  CLES_DES_REGLES,
  HEURES_DE_L_OFFRE,
  REGLE,
  REGLES_DU_QG,
  chiffresDesIncidents,
  defautsDesSeuils,
  depasse,
  graviteDe,
  lesSeuils,
  lireLeReglage,
  rappelEnEchec,
  reglesOuvertes,
  seuilDe,
  type IncidentDuQg,
  type PageDesAlertes,
  type ReleveDesAlertes,
} from '../../shared/qgAlertes'
import { ALERTE_JOURS_D_AVANCE, lesChosesATraiter, type DirectDuQg, type VueDEnsemble } from '../../shared/qg'
import {
  MEMOIRE_PLAFOND_MO,
  PART_DU_QUOTA_EN_ALERTE,
  SANTE_GARDEE_MS,
  SAUVEGARDE_ANCIENNE_MS,
  TURSO_LENT_MS,
  eveilleEntre,
  heuresDuMois,
  type BaseDuQg,
  type DemarrageDuServeur,
} from '../../shared/santeDuServeur'
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

test('le catalogue : seize règles, chacune ses bornes, et les seuils d’office sont ceux du code', () => {
  assert.equal(REGLES_DU_QG.length, 16)
  assert.deepEqual(new Set(REGLES_DU_QG.map(r => r.cle)).size, 16)
  assert.deepEqual([...CLES_DES_REGLES].sort(), REGLES_DU_QG.map(r => r.cle).sort())
  for (const r of REGLES_DU_QG) {
    if (!r.seuil) continue
    const { defaut, horsProduction, min, max, pas } = r.seuil
    for (const [nom, valeur] of [['son défaut', defaut], ['sa part hors de la production', horsProduction]] as const) {
      if (valeur === undefined) continue
      assert.ok(min <= valeur && valeur <= max, `${r.cle} : ${nom} dans ses bornes`)
      assert.ok(Math.abs(Math.round(valeur / pas) * pas - valeur) < 1e-9, `${r.cle} : ${nom} sur son pas`)
    }
  }
  // Les seuils qui existaient gardent leur valeur : la page ne change rien tant qu'on n'y touche pas.
  assert.equal(REGLE['turso-lent'].seuil?.defaut, TURSO_LENT_MS)
  assert.equal(REGLE.memoire.seuil?.defaut, MEMOIRE_PLAFOND_MO)
  assert.equal(REGLE.quota.seuil?.defaut, PART_DU_QUOTA_EN_ALERTE)
  assert.equal(REGLE.reserve.seuil?.defaut, ALERTE_JOURS_D_AVANCE)
  // La sauvegarde ancienne : le rouge de la page « Base et miroir », une semaine.
  assert.equal(REGLE.sauvegarde.seuil?.defaut, SAUVEGARDE_ANCIENNE_MS / 86_400_000)
  // Les heures de l'hébergeur : la part de la production et celle de la préproduction font les 750 de l'offre.
  assert.equal((REGLE.hebergeur.seuil?.defaut ?? 0) + (defautsDesSeuils(false).hebergeur ?? 0), HEURES_DE_L_OFFRE)
  assert.deepEqual(defautsDesSeuils(true), {}, 'en production, les défauts du catalogue')
  // Le téléphone sonne d'office pour la panne d'un mode, les deux que la maquette y ajoutait, et les heures de l'hébergeur.
  assert.deepEqual(REGLES_DU_QG.filter(r => r.telephone).map(r => r.cle).sort(), ['hebergeur', 'miroir', 'panne', 'taux-d-erreur'])
  assert.equal(REGLES_DU_QG.filter(r => r.neuve).length, 10, 'huit règles proposées le 3 novembre 2026, deux par la revue du 4')
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
    sauvegarde: { derniere: null },
    hebergeur: { faites: 120, projetees: 640 },
  }
  const ouvertes = reglesOuvertes(tout, {})
  assert.deepEqual([...ouvertes.keys()].sort(), [...CLES_DES_REGLES].sort(), 'les seize')
  assert.equal(ouvertes.get('taux-d-erreur'), '3 % des requêtes en erreur (12 sur 400)')
  assert.equal(ouvertes.get('version'), 'POST /api/cabinet/traversee/:id/geste : 300 ms → 520 ms')
  assert.match(ouvertes.get('sauvegarde') ?? '', /^aucune sauvegarde notée/, 'jamais sauvegardée : ouverte, et la cause le dit')
  assert.equal(ouvertes.get('hebergeur'), '640 h ce mois-ci à ce rythme, déjà 120 — sur 750 pour les deux services')
  // Réglées plus haut, elles se taisent.
  const reglees = reglesOuvertes(tout, { ressenti: { seuil: 1000 }, 'gel-long': { seuil: 4000 }, reserve: { seuil: 3 }, 'taux-d-erreur': { seuil: 5 } })
  for (const cle of ['ressenti', 'gel-long', 'reserve', 'taux-d-erreur'] as const) assert.ok(!reglees.has(cle), cle)
  // Trop peu pour juger : dix-neuf appels, quarante-neuf requêtes, quatre envois.
  const peu = reglesOuvertes({ ...calme(), ressenti: { p95: 4000, appels: 19 }, requetes: { n: 49, enErreur: 49 }, rappel: { envoyes: 0, echecs: 4 } }, {})
  assert.deepEqual([...peu.keys()], [])
  // Un soir où l'on a joué, rien ; un soir que le serveur n'a pas écouté en entier (null), rien non plus.
  assert.ok(!reglesOuvertes({ ...calme(), soir: { joue: 3 } }, {}).has('silence'))
})

test('la sauvegarde ancienne et les heures de l’hébergeur s’ouvrent à leur seuil — celui d’office dépend du serveur', () => {
  const J = 86_400_000
  const t = 1_700_000_000_000
  // Six jours : au calme ; huit : ouverte, à sept d'office ; réglée à dix jours, au calme.
  assert.ok(!reglesOuvertes({ ...calme(t), sauvegarde: { derniere: t - 6 * J } }, {}).has('sauvegarde'))
  assert.equal(reglesOuvertes({ ...calme(t), sauvegarde: { derniere: t - 8 * J - 3_600_000 } }, {}).get('sauvegarde'), 'la dernière date de 8 jours')
  assert.ok(!reglesOuvertes({ ...calme(t), sauvegarde: { derniere: t - 8 * J } }, { sauvegarde: { seuil: 10 } }).has('sauvegarde'))
  // Pas encore lue : rien ne se juge, pas même « jamais ».
  assert.ok(!reglesOuvertes(calme(t), {}).has('sauvegarde'))
  // Les heures : 520 au rythme de la semaine. La production, tenue éveillée de 7 h à minuit, ne sonne pas sous sa part ;
  // la préproduction, au-delà de la sienne, si.
  const releve = { ...calme(t), hebergeur: { faites: 90, projetees: 520 } }
  const preprod = defautsDesSeuils(false)
  assert.ok(!reglesOuvertes(releve, {}).has('hebergeur'))
  assert.ok(reglesOuvertes(releve, {}, preprod).has('hebergeur'))
  assert.ok(!reglesOuvertes({ ...releve, hebergeur: { faites: 30, projetees: 150 } }, {}, preprod).has('hebergeur'))
  assert.ok(!reglesOuvertes({ ...releve, hebergeur: null }, {}, preprod).has('hebergeur'), 'sans démarrages lisibles, rien ne se juge')
  // Hors de la production, sa part ne s'écrit pas : réglée à 190, la ligne s'efface comme un défaut.
  assert.equal(seuilDe('hebergeur', {}, preprod), 190)
  assert.deepEqual(lireLeReglage('hebergeur', { seuil: 190 }, { seuil: 300 }, preprod), {})
  assert.deepEqual(lireLeReglage('hebergeur', { seuil: 560 }, {}, preprod), { seuil: 560 })
  assert.deepEqual(lireLeReglage('hebergeur', { seuil: 560 }), {}, 'en production, 560 est le défaut')
  assert.throws(() => lireLeReglage('hebergeur', { seuil: 800 }), /Le seuil va de 50\sh à 750\sh/)
  assert.equal(sansInsecables(ReglesDuQg.phraseDuReglage('hebergeur', {}, { seuil: 250 }, preprod)), 'Alerte réglée : Heures de l’hébergeur — seuil 250 h (avant 190 h)')
})

test('les heures de l’hébergeur : chaque démarrage de son départ à sa fin, deux qui se chevauchent une fois, le reste du mois au rythme de la semaine', async () => {
  const H = 3_600_000
  const J = 24 * H
  const demarrage = (id: string, demarreLe: number, fin: number, propre = true): DemarrageDuServeur => ({
    id,
    demarreLe,
    pretEnMs: 900,
    version: 'abc1234',
    env: 'production',
    vuLe: fin,
    arreteLe: propre ? fin : null,
  })
  // Une mise en ligne : l'ancien vit encore dix minutes à côté du nouveau ; le nouveau s'arrête net (son dernier signe) ;
  // celui qui répond vit jusqu'à maintenant.
  const t0 = Date.UTC(2026, 10, 20, 12)
  const vies = [demarrage('a', t0 - 10 * H, t0 - 6 * H + 10 * 60_000), demarrage('b', t0 - 6 * H, t0 - 5 * H, false), demarrage('ici', t0 - 2 * H, t0 - 2 * H, false)]
  assert.equal(eveilleEntre(vies, t0 - 12 * H, t0, t0, 'ici'), 7 * H)
  assert.equal(eveilleEntre(vies, t0 - 3 * H, t0 - H, t0, 'ici'), H, 'bornées à la fenêtre')

  // Un mois : réveillé de 6 h à 23 h, dix-sept heures par jour, ces neuf derniers jours ; aujourd'hui depuis 6 h.
  const minuit = Date.UTC(2026, 10, 20)
  const gardes = Array.from({ length: 9 }, (_, k) => demarrage(`j${k}`, minuit - (k + 1) * J + 6 * H, minuit - (k + 1) * J + 23 * H))
  gardes.push(demarrage('ici', minuit + 6 * H, minuit + 6 * H, false))
  // La mémoire dit les jours plus anciens que les huit gardés, sauf deux.
  const memoire = new Map<number, number | null>()
  for (let k = 1; k <= 12; k++) memoire.set(k, k === 10 || k === 12 ? null : k === 11 ? 20 : 17)
  const jours = Array.from({ length: 20 }, (_, i) => ({
    debut: Date.UTC(2026, 10, i + 1),
    fin: i === 19 ? t0 : Date.UTC(2026, 10, i + 2),
    heures: memoire.get(i + 1) ?? null,
  }))
  const h = heuresDuMois({ demarrages: gardes, maintenant: t0, courant: 'ici', finDuMois: Date.UTC(2026, 11, 1), jours })
  // Couverts par les démarrages (le 13 au 19, et aujourd'hui) : 7 × 17 + 6 ; la mémoire : 9 × 17 + 20 ; deux jours inconnus.
  assert.equal(h.faites, 7 * 17 + 6 + 9 * 17 + 20)
  assert.ok(Math.abs(h.rythme - 17) < 1e-9, `les sept derniers jours, couverts tout entiers : ${h.rythme}`)
  // Les deux jours inconnus et les dix jours et demi qui restent, à dix-sept heures sur vingt-quatre.
  assert.ok(Math.abs(h.projetees - (h.faites + (2 * 24 + 10.5 * 24) * (17 / 24))) < 1e-9, String(h.projetees))
  assert.ok(SANTE_GARDEE_MS === 8 * J, 'les jours couverts sont ceux des huit gardés')

  // Le mois de Paris, monté par le serveur : ses jours depuis le 1er, la mémoire demandée depuis lui.
  let depuis = ''
  const parisH = await heuresDeLHebergeur({
    demarrages: async () => [],
    heuresDesJours: async de => {
      depuis = de
      return new Map([['2026-11-02', 15]])
    },
    courant: 'ici',
    maintenant: t0,
  })
  assert.equal(depuis, '2026-11-01')
  assert.deepEqual(parisH, { faites: 15, projetees: 15, rythme: 0 }, 'endormi toute la semaine : rien de plus au rythme')
})

test('ce que les règles lisent : la dernière sauvegarde et les heures de l’hébergeur, une fois l’heure — une lecture qui tombe garde la précédente', async () => {
  let t = Date.UTC(2026, 10, 4, 10)
  const lectures = { sauvegarde: 0, heures: 0 }
  let panne = false
  const deps = {
    alertes: async (memoireMo: number | null) => ({ pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo, quota: null }),
    versions: async () => [],
    direct: new DirectDuServeur(() => t),
    miroir: () => null,
    reserve: async () => null,
    rappel: () => null,
    memoireMo: () => null,
    version: null,
    maintenant: () => t,
  }
  const lire = lecteurDesAlertes({
    ...deps,
    sauvegarde: async () => {
      lectures.sauvegarde++
      if (panne) throw new Error('Turso se tait')
      return null
    },
    hebergeur: async () => {
      lectures.heures++
      return { faites: 10, projetees: 400, rythme: 12 }
    },
  })
  const premier = await lire()
  assert.deepEqual(premier.sauvegarde, { derniere: null })
  assert.deepEqual(premier.hebergeur, { faites: 10, projetees: 400 })
  t += 30 * 60_000
  await lire()
  assert.deepEqual(lectures, { sauvegarde: 1, heures: 1 }, 'une fois l’heure, pas une fois la minute')
  t += 31 * 60_000
  panne = true
  assert.deepEqual((await lire()).sauvegarde, { derniere: null }, 'la lecture tombée garde la précédente')
  await lire()
  assert.equal(lectures.sauvegarde, 3, 'et se refait au tour suivant')
  // Jamais lue — la base muette dès le premier tour — : rien ne se juge.
  const muet = lecteurDesAlertes({ ...deps, sauvegarde: async () => Promise.reject(new Error('Turso se tait')) })
  assert.equal((await muet()).sauvegarde, undefined)
})

test('ce que les règles lisent : la réserve du quiz du jour au plus toutes les dix minutes — une lecture qui tombe garde la précédente', async () => {
  // Relue chaque minute, elle comptait au quota de Turso toutes les questions prêtes, 1 440 fois par jour (le 4 novembre 2026).
  let t = Date.UTC(2026, 10, 4, 10)
  let lectures = 0
  let panne = false
  const lire = lecteurDesAlertes({
    alertes: async memoireMo => ({ pannes: [], arretNet: null, erreurs: null, tursoLent: null, memoireMo, quota: null }),
    versions: async () => [],
    direct: new DirectDuServeur(() => t),
    miroir: () => null,
    reserve: async () => {
      lectures++
      if (panne) throw new Error('Turso se tait')
      return { joursDAvance: 12 + lectures }
    },
    rappel: () => null,
    memoireMo: () => null,
    version: null,
    maintenant: () => t,
  })
  assert.equal((await lire()).reserveJours, 13)
  for (let i = 0; i < 10; i++) {
    t += MINUTE
    assert.equal((await lire()).reserveJours, 13)
  }
  assert.equal(lectures, 1, 'une lecture en dix minutes, pas dix')
  t += MINUTE
  assert.equal((await lire()).reserveJours, 14, 'relue passé dix minutes')
  t += 11 * MINUTE
  panne = true
  assert.equal((await lire()).reserveJours, 14, 'la lecture tombée garde la précédente')
  t += MINUTE
  await lire()
  assert.equal(lectures, 4, 'et se refait au tour suivant')
})

test('un tour des règles se nomme pour la sonde des gels, du début à la fin', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-regles-'))
  let lacher: (r: ReleveDesAlertes) => void = () => {}
  const regles = new ReglesDuQg(`file:${path.join(dir, 'permanente.db')}`, undefined, {
    lire: () => new Promise(r => (lacher = r)),
    prevenir: () => {},
  })
  await regles.init()
  try {
    const nomme = (debut: number, fin: number) => ceQuiTournait(debut, fin).some(c => c.quoi === 'fond · règles des alertes')
    const debut = performance.now()
    const tour = regles.tour()
    // Un gel pendant un tour se rangeait sous la requête qui passait par là, ou « sans rien de nommé ».
    assert.ok(nomme(debut, performance.now()), 'le tour se nomme dès son début')
    lacher(calme())
    await tour
    const apres = performance.now()
    assert.ok(!nomme(apres, apres + 1), 'et se tait avec sa fin')
  } finally {
    regles.close()
  }
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
    assert.equal(page.regles.length, 16)
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
  // Les heures de l'hébergeur s'ouvrent dès qu'elles atteignent leur seuil, comme le quota.
  assert.deepEqual([depasse('hebergeur', 560, { hebergeur: 560 }), depasse('hebergeur', 559, { hebergeur: 560 })], [true, false])
})

test('au banc : un serveur jamais sauvegardé le dit dès sa première minute, « À traiter » aussi, et « Base et miroir » peint au seuil réglé', async () => {
  const banc = await demarrer({ reglesDuQgMs: 40 })
  try {
    const admin = await connexionAnimateur(banc.url)
    const lire = async <T>(chemin: string) => (await (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: admin } })).json()) as T
    let page = await lire<PageDesAlertes>('/api/admin/regles')
    for (let i = 0; i < 250 && !page.regles.find(r => r.cle === 'sauvegarde')?.ouverte; i++) {
      await patienter(20)
      page = await lire<PageDesAlertes>('/api/admin/regles')
    }
    assert.match(page.regles.find(r => r.cle === 'sauvegarde')?.ouverte?.cause ?? '', /^aucune sauvegarde notée/)
    // Les heures de l'hébergeur : un serveur de quelques secondes ne projette rien ; la production, sa part d'office.
    const heures = page.regles.find(r => r.cle === 'hebergeur')
    assert.equal(heures?.ouverte, null)
    assert.deepEqual([heures?.seuil, heures?.defaut, heures?.telephone], [560, 560, true])
    const vue = await lire<VueDEnsemble>('/api/admin/qg')
    assert.deepEqual(
      vue.aTraiter.alertes?.map(a => a.cle),
      ['sauvegarde'],
    )
    // Sérieuse, comme sa règle — une bande rouge —, et elle mène où l'on agit : la page qui montre les sauvegardes.
    const chose = lesChosesATraiter(vue.aTraiter, null).find(c => c.cle === 'alerte:sauvegarde')
    assert.equal(chose?.gravite, 'serieux')
    assert.equal(chose?.ecran, REGLE.sauvegarde.page)
    // « Base et miroir » peint la dernière sauvegarde au seuil de la règle, réglé ou d'office.
    assert.equal((await lire<BaseDuQg>('/api/admin/base')).ancienneApresMs, 7 * 86_400_000)
    assert.equal((await ecrire(banc.url, '/api/admin/regles/sauvegarde', { seuil: 10 }, admin, 'PUT')).status, 200)
    assert.equal((await lire<BaseDuQg>('/api/admin/base')).ancienneApresMs, 10 * 86_400_000)
  } finally {
    await banc.close()
  }
})

test('au banc, hors de la production : la préproduction prend sa part des heures de l’hébergeur d’office', async () => {
  const banc = await demarrer({ appEnv: 'preprod', reglesDuQgMs: 60_000 })
  try {
    const admin = await connexionAnimateur(banc.url)
    const page = (await (await fetch(`${banc.url}/api/admin/regles`, { headers: { Cookie: admin } })).json()) as PageDesAlertes
    const heures = page.regles.find(r => r.cle === 'hebergeur')
    assert.deepEqual([heures?.seuil, heures?.defaut], [190, 190])
    // Réglée à 560 — la part d'une production —, elle s'écrit ; revenue à 190, la ligne s'efface.
    assert.equal((await ecrire(banc.url, '/api/admin/regles/hebergeur', { seuil: 560 }, admin, 'PUT')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/admin/regles/hebergeur', { seuil: 190 }, admin, 'PUT')).status, 200)
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    assert.deepEqual(base.prepare("SELECT cle FROM qg_reglages WHERE cle = 'hebergeur'").all(), [])
    base.close()
  } finally {
    await banc.close()
  }
})

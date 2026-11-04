// L'effet de ce que le QG envoie, et les repères de ses courbes (la revue du 4 novembre 2026, P2.1 et P2.2 ;
// `shared/qgEffets.ts`, `server/src/effetsDuQg.ts`) : sous chaque annonce, ses destinataires revenus jouer dans les
// sept jours face à l'habitude de la même audience ; sous chaque affiche, les joueurs de son mode quatorze jours avant
// et après, et ses visiteurs revenus ; au rappel du soir, « joué après », compté une fois le soir fini et jamais
// recompté ; les repères tirés du journal des gestes et des démarrages, sans un nom ; l'avant / après d'un repère sur
// les jours de la mémoire — une semaine creuse compte, un jour sans mémoire non, et le changement d'heure ne change pas
// les jours. Des comptes, jamais un nom ; ce qui est fini se lit une fois par jour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createECDH, randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { jourAvant, jourDe } from '../../shared/jour'
import type { ModeDuQg } from '../../shared/qg'
import { BIT_DU_MODE, minuitDuJour, type Presence, type ProfilDeLAudience } from '../../shared/qgJoueurs'
import { REGLE } from '../../shared/qgAlertes'
import type { DemarrageDuServeur } from '../../shared/santeDuServeur'
import type { SuiviDuJour } from '../../shared/qgDuJour'
import {
  avantApres,
  ecartDeLAvantApres,
  effetDUneAffiche,
  effetDUneAnnonce,
  filParJour,
  moyenneEcrite,
  partEcrite,
  repereDuGeste,
  reperesDesDemarrages,
  reperesDesSeaux,
  reperesEcrits,
  type ChiffresDuRepere,
  type EffetsDesAffiches,
  type EffetsDesAnnonces,
  type JoursDeLAvantApres,
  type MemoireDesEffets,
  type RepereDuQg,
  type ReperesDuQg,
} from '../../shared/qgEffets'

ProfileStore.tirageEclat = () => false

/** Mercredi 4 novembre 2026, 21 h à Paris — l'heure d'hiver : 20 h du temps universel. */
const MAINTENANT = Date.UTC(2026, 10, 4, 20, 0)
const AUJOURDHUI = '2026-11-04'
const J = 86_400_000
const H = 3_600_000
/** Un instant d'un jour de Paris, à telle heure. */
const a = (jour: string, heure: number) => minuitDuJour(jour) + heure * H

/** Un profil a joué tel jour, à un mode. */
const joue = (jour: string, qui: string, mode: ModeDuQg = 'jour'): Presence => ({ jour, qui, modes: BIT_DU_MODE[mode], premiere: 600 })
/** Les feuilles de présence, jour par jour. */
function feuilles(...presences: Presence[]): Map<string, Presence[]> {
  const parJour = new Map<string, Presence[]>()
  for (const p of presences) parJour.set(p.jour, [...(parJour.get(p.jour) ?? []), p])
  return parJour
}
const profil = (id: string, cree: string, suspendu = false): ProfilDeLAudience => ({ id, cree: a(cree, 10), suspendu, origine: null })

// ── Les dérivations ─────────────────────────────────────────────────────────

test('une annonce à tous : ses destinataires revenus jouer dans les sept jours qui suivent son jour, face à l’habitude de la semaine d’avant — sur autant de jours tant qu’elle est en cours', () => {
  // L'annonce du mardi 20 octobre, à midi : sa semaine va du 21 au 27 — le dimanche 25, jour de vingt-cinq heures, compris.
  const annonce = { le: a('2026-10-20', 12), segment: null, destinataires: null }
  const profils = [
    profil('ana', '2026-09-01'),
    profil('bob', '2026-09-01'),
    profil('cleo', '2026-09-01'),
    profil('dan', '2026-09-01'),
    // Née après elle : elle ne l'a pas reçue.
    profil('eve', '2026-10-25'),
    // Suspendu : elle ne le touchait pas.
    profil('fil', '2026-09-01', true),
  ]
  const presences = feuilles(
    // La semaine d'avant, l'habitude : Cléo seule.
    joue('2026-10-15', 'cleo'),
    // Son jour ne compte ni avant ni après : la feuille ne dit pas si c'était avant ou après son heure.
    joue('2026-10-20', 'dan'),
    // Sa semaine : Ana, et Bob le dimanche du changement d'heure ; ni Ève ni Fil ne comptent.
    joue('2026-10-22', 'ana'),
    joue('2026-10-25', 'bob', 'cabinet'),
    joue('2026-10-23', 'eve'),
    joue('2026-10-24', 'fil'),
    // Après sa semaine : rien de plus.
    joue('2026-10-28', 'dan'),
  )
  const memoire = (aujourdhui: string, depuis = '2026-09-01'): MemoireDesEffets => ({ presences, depuis, profils, aujourdhui })
  assert.deepEqual(effetDUneAnnonce(annonce, memoire(AUJOURDHUI)), { jours: 7, apres: { n: 2, sur: 4 }, habitude: { n: 1, sur: 4 }, joursDeLHabitude: 7 })
  // Toujours le compte, jamais un pourcentage.
  assert.equal(partEcrite({ n: 2, sur: 4 }), '2 sur 4')
  // Les milliers groupés par l'espace fine insécable, comme partout (`formatNumber`).
  assert.equal(partEcrite({ n: 9, sur: 12_000 }), '9 sur 12 000')
  // En cours, trois jours sur sept : l'habitude se compte sur trois jours aussi, du 13 au 15.
  assert.deepEqual(effetDUneAnnonce(annonce, memoire('2026-10-24')), { jours: 3, apres: { n: 1, sur: 4 }, habitude: { n: 1, sur: 4 }, joursDeLHabitude: 3 })
  // Son jour même : rien de fini — l'habitude d'une semaine dit à quoi s'attendre.
  assert.deepEqual(effetDUneAnnonce(annonce, memoire('2026-10-20')), { jours: 0, apres: null, habitude: { n: 1, sur: 4 }, joursDeLHabitude: 7 })
  // Une mémoire qui commence après elle : rien à lire, plutôt qu'un « 0 sur 4 » qui mentirait.
  assert.deepEqual(effetDUneAnnonce(annonce, memoire(AUJOURDHUI, '2026-10-26')), { jours: 7, apres: null, habitude: null, joursDeLHabitude: 7 })
})

test('une annonce à un segment : l’habitude est celle du même segment une semaine plus tôt, selon sa règle — pas ce que ses destinataires faisaient', () => {
  // Écrite aux endormis le 20 octobre : Gil et Hugo, partis depuis deux à quatre semaines. Ce qu'ils faisaient la semaine
  // d'avant — rien, par la règle même du segment — ferait passer n'importe quel retour pour un effet.
  const annonce = { le: a('2026-10-20', 12), segment: 'endormis' as const, destinataires: ['gil', 'hugo'] }
  const profils = ['gil', 'hugo', 'ines', 'jo', 'kim'].map(id => profil(id, '2026-08-01'))
  const presences = feuilles(
    // Au soir du 12 octobre, le huitième jour d'avant : Inès (22 jours sans jouer), Jo (17) et Gil (14) dormaient ;
    // Hugo (11 jours) était à risque, Kim jouait encore.
    joue('2026-09-20', 'ines'),
    joue('2026-09-25', 'jo'),
    joue('2026-09-28', 'gil'),
    joue('2026-10-01', 'hugo'),
    joue('2026-10-10', 'kim'),
    // La semaine d'après, Jo seul s'est réveillé : d'habitude, un endormi sur trois revient en une semaine.
    joue('2026-10-14', 'jo'),
    // Après l'annonce, Gil revient.
    joue('2026-10-24', 'gil'),
  )
  const m: MemoireDesEffets = { presences, depuis: '2026-08-01', profils, aujourdhui: AUJOURDHUI }
  assert.deepEqual(effetDUneAnnonce(annonce, m), { jours: 7, apres: { n: 1, sur: 2 }, habitude: { n: 1, sur: 3 }, joursDeLHabitude: 7 })
  // La règle d'un segment lit trente jours de présence : sans eux, un habitué passerait pour perdu de vue — pas d'habitude.
  assert.deepEqual(effetDUneAnnonce(annonce, { ...m, depuis: '2026-09-20' }), { jours: 7, apres: { n: 1, sur: 2 }, habitude: null, joursDeLHabitude: 7 })
})

test('une affiche : les joueurs de son mode les quatorze jours qui suivent son jour face aux quatorze d’avant, ses visiteurs revenus y jouer un autre jour ; la boutique, par ses achats', () => {
  const affiche = {
    le: a('2026-10-20', 10),
    page: 'cabinet' as const,
    visites: [
      // Ana y va le jour même, et revient y jouer le 22.
      { qui: 'ana', le: a('2026-10-20', 11) },
      // Bob n'y joue que le jour de sa visite : pas un retour.
      { qui: 'bob', le: a('2026-10-25', 9) },
      // Ève y passe, et n'y joue jamais.
      { qui: 'eve', le: a('2026-10-21', 18) },
    ],
  }
  const presences = feuilles(
    joue('2026-10-10', 'ana', 'cabinet'),
    joue('2026-10-22', 'ana', 'cabinet'),
    joue('2026-10-25', 'bob', 'cabinet'),
    joue('2026-11-02', 'cleo', 'cabinet'),
    // Un autre mode ne compte pas.
    joue('2026-10-23', 'dan', 'jour'),
  )
  const m = { presences, depuis: '2026-09-01', profils: [], aujourdhui: AUJOURDHUI, jours: new Map() }
  assert.deepEqual(effetDUneAffiche(affiche, m), { jours: 14, joursAvant: 14, joueurs: { apres: 3, avant: 1 }, achats: null, revenus: { visiteurs: 3, revenus: 1 } })
  // En cours, quatre jours sur quatorze : autant de jours juste avant elle, et les visiteurs de ces jours-là.
  assert.deepEqual(effetDUneAffiche(affiche, { ...m, aujourdhui: '2026-10-25' }), {
    jours: 4,
    joursAvant: 4,
    joueurs: { apres: 1, avant: 0 },
    achats: null,
    revenus: { visiteurs: 2, revenus: 1 },
  })
  // La boutique ne se joue pas : ses achats, deux par jour avant elle, trois après.
  const achats = new Map(
    Array.from({ length: 29 }, (_, k) => {
      const j = jourAvant('2026-11-03', k)
      return [j, { achats: j > '2026-10-20' ? 3 : 2 }] as const
    }),
  )
  assert.deepEqual(effetDUneAffiche({ le: a('2026-10-20', 10), page: 'boutique', visites: [] }, { ...m, jours: achats }), {
    jours: 14,
    joursAvant: 14,
    joueurs: null,
    achats: { apres: 42, avant: 28 },
    revenus: null,
  })
  // Une mémoire qui ne remonte pas avant elle : l'avant ne se lit pas, l'après si.
  assert.deepEqual(effetDUneAffiche(affiche, { ...m, depuis: '2026-10-15' }).joueurs, { apres: 3, avant: null })
})

test('un geste du journal pose un repère par sa route : sa sorte et ce qu’il touche, jamais le profil qu’il nomme', () => {
  const repere = (route: string, resume: string, cible: string | null, extra: { segment?: 'endormis' | null; page?: string | null } = {}) =>
    repereDuGeste({ id: 'g1', quand: MAINTENANT, route, resume, cible, ...extra })
  const base = { cle: 'g1', quand: MAINTENANT }
  assert.deepEqual(repere('POST /api/admin/annonces', 'Annonce à tous : « Bravo Léa (@lea) »', 'a1', { segment: null }), { ...base, sorte: 'annonce', nom: 'annonce à tous', mode: null })
  assert.deepEqual(repere('POST /api/admin/annonces', 'Annonce aux endormis : « Revenez »', 'a2', { segment: 'endormis' }), {
    ...base,
    sorte: 'annonce',
    nom: 'annonce aux endormis',
    mode: null,
  })
  assert.deepEqual(repere('POST /api/admin/affiches', 'Affiche posée : le Cabinet', 'f1', { page: 'cabinet' }), { ...base, sorte: 'affiche', nom: 'affiche : le Cabinet', mode: 'cabinet' })
  // Les quatre phrases de la maintenance, telles que `phraseDuChangement` les écrit (le banc les rejoue par la vraie route).
  assert.deepEqual(
    [
      'Page mise en maintenance : Le quiz du jour',
      'Page bientôt disponible, pour ses testeurs : Le quiz du jour',
      'Page rouverte aux joueurs : Le quiz du jour',
      'Page ouverte à tous : Le quiz du jour',
    ].map(resume => {
      const r = repere('PUT /api/admin/maintenance/pages/:page', resume, 'jour')
      return r && [r.sorte, r.nom, r.mode]
    }),
    [
      ['maintenance', 'maintenance : le quiz du jour', 'jour'],
      ['maintenance', 'bientôt disponible : le quiz du jour', 'jour'],
      ['ouverture', 'rouverte : le quiz du jour', 'jour'],
      ['ouverture', 'ouverte à tous : le quiz du jour', 'jour'],
    ],
  )
  assert.deepEqual(repere('POST /api/admin/campagne/paliers/:n/melange', 'Mélange du palier 5 des sentiers réglé : …', 'palier:5'), {
    ...base,
    sorte: 'reglage',
    nom: 'mélange : palier 5',
    mode: 'campagne',
  })
  assert.deepEqual(repere('PUT /api/admin/regles/:cle', `Alerte réglée : ${REGLE.memoire.nom} — seuil 420 Mo (avant 450 Mo)`, 'memoire'), {
    ...base,
    sorte: 'reglage',
    nom: `seuil : ${REGLE.memoire.nom}`,
    mode: null,
  })
  // Faire sonner un téléphone, poser un bandeau, ajouter un testeur, offrir des confettis : rien ne change pour les joueurs.
  assert.equal(repere('PUT /api/admin/regles/:cle', `Alerte réglée : ${REGLE.memoire.nom} — sonne au téléphone`, 'memoire'), null)
  assert.equal(repere('PUT /api/admin/maintenance/bandeau', 'Bandeau affiché : « Le quiz du jour revient »', null), null)
  assert.equal(repere('PUT /api/admin/maintenance/pages/:page/testeurs/:id', 'Testeur ajouté à « Le Cabinet » : Léa (@lea)', 'p1'), null)
  assert.equal(repere('POST /api/admin/profils/:id/confettis', '50 confettis offerts : Léa (@lea)', 'p1'), null)
})

test('les démarrages : une version neuve est une mise en ligne, un démarrage qui s’est tu sans s’éteindre un arrêt net — sa version suffit, la phrase de son commit n’existe pas au serveur', () => {
  const d = (id: string, demarreLe: number, version: string | null, vuLe: number, arreteLe: number | null): DemarrageDuServeur => ({
    id,
    demarreLe,
    pretEnMs: 900,
    version,
    env: 'production',
    vuLe,
    arreteLe,
  })
  const t0 = MAINTENANT - 3 * J
  const demarrages = [
    // La veille de l'hébergeur : il s'éteint proprement.
    d('a', t0, 'aaaaaaa1', t0 + H, t0 + H),
    // Un réveil, puis plus un signe : arrêté net.
    d('b', t0 + 2 * H, 'aaaaaaa1', t0 + 3 * H, null),
    // Une version neuve : une mise en ligne.
    d('c', t0 + 5 * H, 'bbbbbbb2', t0 + 6 * H, t0 + 6 * H),
    // Celui qui répond ne se juge jamais.
    d('d', MAINTENANT - H, 'bbbbbbb2', MAINTENANT, null),
  ]
  assert.deepEqual(
    reperesDesDemarrages(demarrages, MAINTENANT, 'd').map(r => [r.cle, r.sorte, r.nom, r.quand, r.mode]),
    [
      ['arret:b', 'arret-net', 'arrêt net du serveur', t0 + 3 * H, null],
      ['demarrage:c', 'mise-en-ligne', 'mise en ligne bbbbbbb', t0 + 5 * H, null],
    ],
  )
})

test('les repères d’une courbe, seau par seau : hors de ses seaux, nulle part ; plus de deux dans un seau se comptent', () => {
  const r = (cle: string, quand: number, nom = cle): RepereDuQg => ({ cle, quand, sorte: 'annonce', nom, mode: null })
  const parSeau = reperesDesSeaux(
    [r('d', 35), r('b', 16), r('a', 5), r('c', 15)],
    [
      [0, 10],
      [10, 20],
      [20, 30],
    ],
  )
  assert.deepEqual(
    parSeau.map(s => s.map(x => x.cle)),
    [['a'], ['c', 'b'], []],
  )
  assert.equal(reperesEcrits([]), '')
  assert.equal(reperesEcrits([r('a', 1, 'annonce à tous')]), 'annonce à tous')
  assert.equal(reperesEcrits([r('a', 1, 'annonce à tous'), r('b', 2, 'mise en ligne e4f5a6b')]), 'annonce à tous, mise en ligne e4f5a6b')
  assert.equal(reperesEcrits([r('a', 1), r('b', 2), r('c', 3)]), '3 événements')
})

test('avant / après : un jour moyen de chaque côté sur les jours que la mémoire sait — une semaine creuse compte, un jour qui manque non —, en jours de Paris, celui de vingt-cinq heures compris', () => {
  const c = (joueurs: number, cabinet = 0): ChiffresDuRepere => ({
    joueurs,
    profils: joueurs,
    nouveauxProfils: 1,
    modes: { soiree: 0, campagne: 0, cabinet, jour: joueurs, duel: 0 },
    parties: { soiree: 0, campagne: 0, cabinet, jour: joueurs, duel: 0 },
  })
  // Le repère : le dimanche 25 octobre 2026 à 2 h 30, l'heure qui se joue deux fois ; à 23 h 30, c'est encore le 25.
  const quand = Date.UTC(2026, 9, 25, 0, 30)
  assert.equal(jourDe(quand), '2026-10-25')
  assert.equal(jourDe(Date.UTC(2026, 9, 25, 22, 30)), '2026-10-25')
  const jours = new Map<string, ChiffresDuRepere>()
  for (let k = 1; k <= 14; k++) jours.set(jourAvant('2026-10-25', k), c(10))
  // Après lui : une semaine creuse, puis vingt joueurs par jour, dont quatre au Cabinet.
  for (let k = 1; k <= 14; k++) jours.set(jourAvant('2026-10-25', -k), c(k <= 7 ? 0 : 20, k <= 7 ? 0 : 4))
  // Son jour, à part : ni avant ni après.
  jours.set('2026-10-25', c(500))
  const aa = avantApres(jours, jourDe(quand), 'cabinet', '2026-11-20')
  assert.deepEqual([aa.jour, aa.avant, aa.apres], ['2026-10-25', { connus: 14, sur: 14 }, { finis: 14, connus: 14, sur: 14 }])
  assert.deepEqual(
    aa.lignes.map(l => l.cle),
    ['joueurs', 'profils', 'nouveaux', 'participations', 'joueurs-cabinet', 'parties-cabinet'],
  )
  const ligne = (cle: string) => aa.lignes.find(l => l.cle === cle)!
  // La semaine creuse est faite de jours connus à zéro : elle compte — sept fois zéro, sept fois vingt.
  assert.deepEqual([ligne('joueurs').avant, ligne('joueurs').apres], [10, 10])
  assert.deepEqual(ecartDeLAvantApres(ligne('joueurs').avant, ligne('joueurs').apres), { sens: null, texte: 'pareil', suite: '' })
  assert.deepEqual([ligne('joueurs-cabinet').avant, ligne('joueurs-cabinet').apres], [0, 2])
  // La même semaine sans mémoire ne compte pas — ni comme zéro, ni comme une baisse —, et un jour d'avant manque aussi.
  for (let k = 1; k <= 7; k++) jours.delete(jourAvant('2026-10-25', -k))
  jours.delete(jourAvant('2026-10-25', 3))
  const trou = avantApres(jours, '2026-10-25', null, '2026-11-20')
  assert.deepEqual([trou.avant, trou.apres], [
    { connus: 13, sur: 14 },
    { finis: 14, connus: 7, sur: 14 },
  ])
  assert.deepEqual([trou.lignes[0].avant, trou.lignes[0].apres], [10, 20])
  assert.equal(trou.lignes.length, 4, 'sans mode touché, les chiffres de tous')
  // Un repère d'il y a six jours : l'après se lit sur ses cinq jours finis.
  assert.deepEqual(avantApres(jours, '2026-10-25', null, '2026-10-31').apres, { finis: 5, connus: 0, sur: 14 })
  // Rien avant lui dans la mémoire : l'avant ne se lit pas, sans rien inventer.
  const rien = avantApres(new Map(), '2026-10-25', null, '2026-11-20')
  assert.deepEqual([rien.lignes[0].avant, rien.lignes[0].apres], [null, null])
})

test('l’écart d’un jour moyen à l’autre : en chiffre sous vingt, en pour cent au-delà ; écrit à une décimale sous dix, insécable où il ne doit pas se couper', () => {
  assert.deepEqual(ecartDeLAvantApres(1.5, 2.9), { sens: 'plus', texte: '+1,4 par jour', suite: '' })
  assert.deepEqual(ecartDeLAvantApres(3, 1.5), { sens: 'moins', texte: '−1,5 par jour', suite: '' })
  assert.deepEqual(ecartDeLAvantApres(40, 30), { sens: 'moins', texte: '25 %', suite: ' de moins' })
  assert.deepEqual(ecartDeLAvantApres(20, 26), { sens: 'plus', texte: '30 %', suite: ' de plus' })
  assert.deepEqual(ecartDeLAvantApres(12, 12.04), { sens: null, texte: 'pareil', suite: '' })
  assert.equal(ecartDeLAvantApres(null, 3), null)
  assert.equal(ecartDeLAvantApres(3, null), null)
  assert.deepEqual([moyenneEcrite(0.94), moyenneEcrite(2.25), moyenneEcrite(12.6), moyenneEcrite(0)], ['0,9', '2,3', '13', '0'])
})

test('le fil du journal : rangé par jour de Paris, le plus récent d’abord — l’année dite quand ce n’est pas celle d’aujourd’hui', () => {
  const fil = filParJour(
    [{ quand: MAINTENANT - H }, { quand: a('2026-11-03', 10) }, { quand: a('2026-10-20', 9) }, { quand: a('2026-10-20', 8) }, { quand: Date.UTC(2025, 11, 31, 12) }],
    MAINTENANT,
  )
  assert.deepEqual(
    fil.map(g => [g.jour, g.titre, g.items.length]),
    [
      [AUJOURDHUI, 'Aujourd’hui', 1],
      ['2026-11-03', 'Hier', 1],
      ['2026-10-20', 'mardi 20 octobre', 2],
      ['2025-12-31', 'mercredi 31 décembre 2025', 1],
    ],
  )
})

// ── Au banc ─────────────────────────────────────────────────────────────────

/** Ce que la base permanente a servi pendant une mesure, chaque instruction (comme `qg-joueurs.test.ts`). */
const compte = { actif: false, instructions: [] as string[] }
const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim()
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.instructions.push(...(methode === 'batch' ? (args[0] as unknown[]) : [args[0]]).map(sqlDe))
    return origine.apply(this, args)
  }
}
async function mesurer<T>(travail: () => Promise<T>): Promise<{ instructions: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, instructions: [] })
  try {
    const resultat = await travail()
    return { instructions: [...compte.instructions], resultat }
  } finally {
    compte.actif = false
  }
}

const lire = async <T>(banc: Banc, cookie: string, chemin: string): Promise<T> => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
  const corps = (await r.json()) as T & { error?: string }
  assert.equal(r.status, 200, `${chemin} : ${r.status} ${corps.error ?? ''}`)
  return corps
}

/** Ce qui ne se relit pas dans la journée : la mémoire, les profils, les destinataires, les visites. */
const LU_UNE_FOIS = /\b(qg_presences|qg_jours|profiles|qg_annonce_destinataires|profile_affiches)\b/

test('au banc : une annonce et le retour de ses destinataires, une affiche et ses visiteurs, les repères du journal — sans un nom, et ce qui est fini lu une fois par jour', async () => {
  const horloge = { t: MAINTENANT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    for (const [login, nom] of [
      ['lea', 'Léa'],
      ['bob', 'Bob'],
      ['zoe', 'Zoé'],
      ['max', 'Max'],
    ]) {
      await inscrireProfil(banc.url, login, nom)
    }
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const ids = Object.fromEntries((db.prepare('SELECT login, id FROM profiles').all() as { login: string; id: string }[]).map(p => [p.login, p.id]))
      // Tous nés il y a deux mois ; Léa joue la semaine d'avant, puis Léa, Zoé et Bob la semaine d'après.
      db.prepare('UPDATE profiles SET created_at = ?').run(MAINTENANT - 60 * J)
      const tous = (db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n
      const partie = db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes) VALUES (?, ?, ?, 10, 6)')
      for (const [qui, jour] of [
        ['lea', '2026-10-15'],
        ['lea', '2026-10-22'],
        ['zoe', '2026-10-23'],
        ['bob', '2026-10-24'],
      ] as const) {
        partie.run(ids[qui], jour, a(jour, 18))
      }

      // Une annonce à tous et une affiche du quiz du jour, par les vraies routes, puis datées du 20 octobre ; les gestes
      // d'aujourd'hui, une seconde l'un après l'autre : la page fermée puis rouverte, un seuil réglé, un téléphone allumé,
      // des confettis offerts à Léa.
      assert.equal((await ecrire(banc.url, '/api/admin/annonces', { id: 'envoi-du-banc', message: 'Le quiz du jour vous attend', confettis: 0 }, admin)).status, 200)
      const posee = await ecrire(banc.url, '/api/admin/affiches', { id: 'affiche-du-banc', page: 'jour', titre: 'Le quiz du jour', phrase: 'Dix questions par jour', jours: 14, confettis: 0 }, admin)
      assert.equal(posee.status, 200)
      for (const [chemin, corps, methode] of [
        ['/api/admin/maintenance/pages/jour', { etat: 'maintenance' }, 'PUT'],
        ['/api/admin/maintenance/pages/jour', { etat: 'ouverte' }, 'PUT'],
        ['/api/admin/regles/memoire', { seuil: 420 }, 'PUT'],
        ['/api/admin/regles/memoire', { telephone: true }, 'PUT'],
        [`/api/admin/profils/${ids.lea}/confettis`, { confettis: 5, mot: 'Merci Léa' }, 'POST'],
      ] as const) {
        horloge.t += 1000
        const r = await ecrire(banc.url, chemin, corps, admin, methode)
        assert.equal(r.status, 200, `${chemin} : ${r.status}`)
      }
      // Le journal s'écrit après la réponse : sa lecture attend ses écritures.
      await lire(banc, admin, '/api/admin/gestes')
      db.prepare('UPDATE qg_annonces SET created_at = ? WHERE id = ?').run(a('2026-10-20', 12), 'envoi-du-banc')
      db.prepare('UPDATE qg_affiches SET created_at = ?, fin = ? WHERE id = ?').run(a('2026-10-20', 10), a('2026-10-20', 10) + 14 * J, 'affiche-du-banc')
      db.prepare('UPDATE qg_gestes SET quand = ? WHERE cible = ?').run(a('2026-10-20', 12), 'envoi-du-banc')
      db.prepare('UPDATE qg_gestes SET quand = ? WHERE cible = ?').run(a('2026-10-20', 10), 'affiche-du-banc')
      // Ses visiteurs : Bob le jour même, Zoé le surlendemain — tous deux revenus y jouer un autre jour.
      const visite = db.prepare('INSERT INTO profile_affiches (affiche_id, profile_id, ouverte_le) VALUES (?, ?, ?)')
      visite.run('affiche-du-banc', ids.bob, a('2026-10-20', 11))
      visite.run('affiche-du-banc', ids.zoe, a('2026-10-22', 9))

      // L'annonce : ont rejoué dans les sept jours Léa, Zoé et Bob ; d'habitude, Léa seule.
      const annonces = await lire<EffetsDesAnnonces>(banc, admin, '/api/admin/annonces/effets')
      assert.equal(annonces.aujourdhui, AUJOURDHUI)
      assert.deepEqual(annonces.effets['envoi-du-banc'], { jours: 7, apres: { n: 3, sur: tous }, habitude: { n: 1, sur: tous }, joursDeLHabitude: 7 })
      // L'affiche : les joueurs du quiz du jour quatorze jours après elle, et avant ; ses deux visiteurs revenus.
      const affiches = await lire<EffetsDesAffiches>(banc, admin, '/api/admin/affiches/effets')
      assert.deepEqual(affiches.effets['affiche-du-banc'], { jours: 14, joursAvant: 14, joueurs: { apres: 3, avant: 1 }, achats: null, revenus: { visiteurs: 2, revenus: 2 } })

      // Les repères des courbes : l'affiche et l'annonce du 20 octobre, la page fermée puis rouverte, le seuil réglé —
      // ni le téléphone allumé, ni les confettis de Léa.
      const reperes = await lire<ReperesDuQg>(banc, admin, '/api/admin/reperes')
      assert.deepEqual(
        reperes.reperes.map(r => [r.sorte, r.nom, r.mode]),
        [
          ['affiche', 'affiche : le quiz du jour', 'jour'],
          ['annonce', 'annonce à tous', null],
          ['maintenance', 'maintenance : le quiz du jour', 'jour'],
          ['ouverture', 'rouverte : le quiz du jour', 'jour'],
          ['reglage', `seuil : ${REGLE.memoire.nom}`, null],
        ],
      )
      assert.deepEqual(
        (await lire<ReperesDuQg>(banc, admin, '/api/admin/reperes?jours=7')).reperes.map(r => r.sorte),
        ['maintenance', 'ouverture', 'reglage'],
        'sept jours : ceux d’aujourd’hui seulement',
      )
      // Aucun nom, aucun identifiant de profil — le geste des confettis en citait un.
      for (const corps of [annonces, affiches, reperes]) {
        const texte = JSON.stringify(corps)
        for (const interdit of ['Léa', 'Zoé', '@lea', ...Object.values(ids)]) assert.ok(!texte.includes(interdit), `${interdit} ne sort pas`)
      }

      // L'avant / après de l'affiche : les jours de la mémoire autour de son jour, finis seulement ; un jour mal écrit est refusé.
      const autour = await lire<JoursDeLAvantApres>(banc, admin, '/api/admin/reperes/avant-apres?jour=2026-10-20')
      assert.deepEqual([autour.aujourdhui, autour.jours.length, autour.jours[0][0], autour.jours.at(-1)?.[0]], [AUJOURDHUI, 29, '2026-10-06', '2026-11-03'])
      const aa = avantApres(new Map(autour.jours), '2026-10-20', 'jour', autour.aujourdhui)
      assert.deepEqual([aa.avant.connus, aa.apres.connus], [14, 14])
      // Un joueur du quiz du jour sur les quatorze jours d'avant, trois sur ceux d'après : en jours moyens.
      assert.deepEqual(
        aa.lignes.filter(l => l.cle === 'joueurs-jour').map(l => [Math.round(l.avant! * 14), Math.round(l.apres! * 14)]),
        [[1, 3]],
      )
      const refuse = await fetch(`${banc.url}/api/admin/reperes/avant-apres?jour=hier`, { headers: { Cookie: admin } })
      assert.equal(refuse.status, 400)

      // Rouverts le même jour : rien de fini ne se relit — ni la mémoire, ni les profils, ni les destinataires, ni les
      // visites ; les gestes d'avant aujourd'hui sont gardés, ceux du jour se relisent par leur index, et les démarrages,
      // dix minutes.
      const { instructions } = await mesurer(async () => {
        await lire(banc, admin, '/api/admin/annonces/effets')
        await lire(banc, admin, '/api/admin/affiches/effets')
        await lire(banc, admin, '/api/admin/reperes')
      })
      assert.deepEqual(
        instructions.filter(sql => LU_UNE_FOIS.test(sql)),
        [],
        'les jours finis restent gardés',
      )
      assert.deepEqual(
        instructions.filter(sql => /\bqg_gestes\b/.test(sql)).map(sql => /quand >= \? AND quand < \?/.test(sql)),
        [true],
        'les gestes du jour, une lecture par leur date',
      )
      assert.deepEqual(
        instructions.filter(sql => /\bqg_demarrages\b/.test(sql)),
        [],
      )
      // Le lendemain, un jour de plus se lit — une fois.
      horloge.t += J
      const { instructions: lendemain } = await mesurer(() => lire(banc, admin, '/api/admin/annonces/effets'))
      assert.ok(lendemain.some(sql => /\bqg_presences\b/.test(sql)), 'un jour neuf, la mémoire relue')
    } finally {
      db.close()
    }
  } finally {
    await banc.close()
  }
})

/** Paris, en septembre : deux heures devant le temps universel. */
const aParis = (jour: number, heure: number, minute = 0) => Date.UTC(2026, 8, jour, heure - 2, minute)

test('au banc : « joué après le rappel » — compté une fois le soir fini, par la première lecture du QG avant le rappel suivant ou par la tournée suivante, et jamais recompté', async () => {
  const recus: string[] = []
  const service = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      recus.push(req.url ?? '')
      res.statusCode = 201
      res.end()
    })
  })
  await new Promise<void>(resolve => service.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(service.address() as AddressInfo).port}`
  const horloge = { t: aParis(26, 10) }
  const banc = await demarrer({
    horlogeDuJour: () => horloge.t,
    rappels: { intervalleMs: 20, servicesDePush: u => u.hostname === '127.0.0.1' },
  })
  /** La tournée d'un soir, faite par le serveur, telle que `/healthz` la dit. */
  const tournee = async (jour: string) => {
    for (let essai = 0; essai < 750; essai++) {
      const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { rappels: { jour: string } | null }
      if (sante.rappels?.jour === jour) return
      await patienter(20)
    }
    throw new Error(`la tournée du ${jour} n’est pas venue`)
  }
  const poster = (cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
  /** Commence la partie du jour et répond juste à ses `n` premières questions ; la suivante reste à l'écran. */
  const commencer = async (cookie: string, n: number) => {
    let etat = (await poster(cookie, '/api/jour/commencer')).corps
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const questions = JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions) as { bonne: number }[]
    db.close()
    while (etat.question && etat.question.index < n) {
      const i = etat.question.index
      assert.equal((await poster(cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne })).status, 200)
      etat = (await poster(cookie, '/api/jour/suivante')).corps
    }
  }
  const tournees = async (admin: string) => (await lire<SuiviDuJour>(banc, admin, '/api/admin/jour/suivi')).rappel.tournees
  try {
    const admin = await connexionAnimateur(banc.url)
    const cookies: Record<string, string> = {}
    for (const nom of ['lea', 'bob', 'cleo', 'dan']) {
      cookies[nom] = await inscrireProfil(banc.url, nom, nom)
      const ecdh = createECDH('prime256v1')
      ecdh.generateKeys()
      const abonnement = { endpoint: `${url}/push/${nom}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }
      assert.equal((await ecrire(banc.url, '/api/jour/rappel', { abonnement }, cookies[nom])).status, 200)
    }
    // Le matin, Bob et Cléo commencent leur partie sans la finir : le rappel les préviendra aussi.
    await commencer(cookies.bob, 3)
    await commencer(cookies.cleo, 2)

    horloge.t = aParis(26, 18, 5)
    await tournee('2026-09-26')
    for (let essai = 0; essai < 100 && (await tournees(admin)).length === 0; essai++) await patienter(20)
    assert.equal(recus.length, 4)
    // Après le rappel, Léa commence sa partie, Bob rouvre la sienne — sa question restée à l'écran s'écrit, il l'a reprise.
    // Cléo et Dan ne viennent pas.
    horloge.t = aParis(26, 18, 40)
    await commencer(cookies.lea, 10)
    assert.equal((await fetch(`${banc.url}/api/jour`, { headers: { Cookie: cookies.bob } })).status, 200)
    // Ce soir, il ne se sait pas encore.
    horloge.t = aParis(26, 21)
    assert.deepEqual(await tournees(admin), [{ jour: '2026-09-26', envoyes: 4, finis: 0, retires: 0, echecs: 0, ouverts: 0, joues: null }])

    // Le lendemain matin, la première lecture du QG le trouve fini et le compte : Léa et Bob.
    horloge.t = aParis(27, 9)
    assert.deepEqual(
      (await tournees(admin)).map(t => [t.jour, t.joues]),
      [['2026-09-26', 2]],
    )
    // Écrit, il ne se recompte jamais : une partie de Cléo redatée après le rappel n'y change rien.
    const ecriture = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    ecriture.prepare("UPDATE jour_parties SET commencee_le = ? WHERE jour = '2026-09-26'").run(aParis(26, 22))
    ecriture.close()
    assert.deepEqual(
      (await tournees(admin)).map(t => [t.jour, t.joues]),
      [['2026-09-26', 2]],
    )

    // Le soir du 27, personne ne lit le QG : la tournée du 28 compte le 27 avant de réserver ses téléphones — Dan a joué
    // après le rappel.
    horloge.t = aParis(27, 18, 5)
    await tournee('2026-09-27')
    horloge.t = aParis(27, 18, 30)
    await commencer(cookies.dan, 1)
    horloge.t = aParis(28, 18, 5)
    await tournee('2026-09-28')
    for (let essai = 0; essai < 100 && (await tournees(admin)).length < 3; essai++) await patienter(20)
    assert.deepEqual(
      (await tournees(admin)).map(t => [t.jour, t.joues]),
      [
        ['2026-09-28', null],
        ['2026-09-27', 1],
        ['2026-09-26', 2],
      ],
    )
  } finally {
    await banc.close()
    await new Promise<void>(resolve => service.close(() => resolve()))
  }
})

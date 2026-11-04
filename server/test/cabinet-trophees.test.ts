// Les trophées du Cabinet (le 4 novembre 2026 : « les trophées dans le cabinet
// ne sont pas très bien et peu nombreux en expérience », le propriétaire, et
// « que certains soient des tâches de fond, c'est à force de jouer, et
// d'autres des exploits, donc challengeants ») : leur catalogue — un exploit
// par condition, payé selon sa rareté ; une piste par jeu, à l'emoji de son
// jeu —, le résumé de la version 2 qui porte ce que les pistes comptent, les
// exploits jugés sur une traversée gagnée et elle seule, ce que les pistes
// comptent de toutes ses traversées ; puis au serveur : les exploits rangés
// sous leur traversée et payés à chaque fois, les paliers jugés à sa fin — et
// que son écran de fin dit —, et la relecture des traversées passées au
// démarrage.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import type { ResultSet } from '@libsql/client'
import { inscrireProfil } from './banc'
import { aLaMain, bancDuCabinet, enBase, fermerLesMagasins, lire, ok, poster, type BancDuCabinet } from './cabinet-banc'
import { cleDeSerie } from '../src/auth/profiles'
import { RELECTURE_DES_DEFIS } from '../src/core/cabinet/magasin'
import { statsDuCabinetLues, traverseesComptees } from '../src/core/cabinet/tables'
import { JEUX_DU_TOUCHE_A_TOUT, OR_DE_CRESUS } from '../../shared/cabinet/bareme'
import { VERSION_DES_DEFIS } from '../../shared/cabinet/defis'
import { CLES_DES_EXPLOITS, comptesDesTraversees, coupFinal, estGagnee, exploitsDeLaTraversee, type TraverseeComptee } from '../../shared/cabinet/exploits'
import { VERSION_DU_RESUME, lireLeCompte, lireLeResume, meneeAuBout, parfaite, resumeDeLaTraversee, type ResumeDeLaTraversee } from '../../shared/cabinet/resume'
import { CLES_DES_JEUX } from '../../shared/cabinet/jeux/regle'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import {
  EMOJI_DES_JEUX,
  VERSION_DE_LA_TRAVERSEE,
  etatDeLaTraversee,
  tracerLaCarte,
  type CleDeCarte,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraversee,
  type GesteDeLaTraverseeEcrit,
} from '../../shared/cabinet/traversee'
import {
  HAUTS_FAITS_DE_CARRIERE,
  HAUTS_FAITS_DU_CABINET,
  PART_DES_JOUEURS,
  XP_DES_EXPLOITS_DU_CABINET,
  cleDeLaPisteDuJeu,
  clePalier,
  hautFait,
  origineDe,
  palierDe,
  paliersDeCampagneAtteints,
  xpHorsDesSoirees,
} from '../../shared/hautsfaits'
import { rareteMesuree } from '../../shared/pistes'
import { AUCUNE_CAMPAGNE } from '../../shared/profil'
import { PISTES_DU_CABINET, pageDuTrophee } from '../../shared/pagesDesTrophees'
import type { PageDeLaTraversee } from '../../shared/cabinet/vues'

// ── Une traversée écrite à la main ────────────────────────────────────────

const GARDIENS: [string, string, string] = ['lg:renard', 'lg:sphinx', 'lg:dragon']

/**
 * Une traversée jouée au pli, geste par geste, comme le serveur les aurait écrits : le premier chemin vers une épreuve,
 * chaque amélioration à la première carte qui monte, les épreuves conclues aux étoiles demandées — trois partout
 * d'office —, jusqu'à `arret` ou sa fin.
 */
function traversee({
  cartes = ['cagnotte', 'panacee', 'pourboire'] as CleDeCarte[],
  gardiens = GARDIENS,
  etoiles = () => [3, 3, 3] as readonly (number | null)[],
  arret = (e: EtatDeLaTraversee) => e.fin !== null,
  graine = 7,
}: {
  cartes?: CleDeCarte[]
  gardiens?: [string, string, string]
  etoiles?: (n: number, gardien: boolean) => readonly (number | null)[]
  arret?: (e: EtatDeLaTraversee) => boolean
  graine?: number
} = {}) {
  let x = graine
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const depart: DepartDeLaTraversee = { v: VERSION_DE_LA_TRAVERSEE, jour: '2026-11-04', actes: tracerLaCarte(hasard, gardiens, { epingle: ['Rome'], frise: ['Rome'] }) }
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
        const p = `p${++n}`
        pousser({ quoi: 'epreuve', etape: etape.id, partie: p })
        const manches = etoiles(n, etape.sorte === 'gardien').map(etoiles => ({ etoiles, misee: false }))
        pousser({ quoi: 'conclure', partie: p, manches, aides: { eclairer: 0, changer: 0, temps: 0 } })
      }
    }
    e = etat()
  }
  assert.equal(e.ignores, 0, 'le pli accepte chaque geste écrit')
  return { depart, gestes, etat: e }
}

const somme = (jeux: Partial<Record<string, number>>) => Object.values(jeux).reduce<number>((a, b) => a + (b ?? 0), 0)

// ── Les règles, pures ─────────────────────────────────────────────────────

test('le catalogue : un exploit par condition, payé selon sa rareté ; une piste par jeu, à l’emoji de son jeu', () => {
  assert.deepEqual(HAUTS_FAITS_DU_CABINET.map(h => h.key).sort(), [...CLES_DES_EXPLOITS].sort(), 'chaque exploit a sa condition, et l’inverse')
  for (const h of HAUTS_FAITS_DU_CABINET) {
    assert.equal(h.origine, 'cabinet', h.key)
    assert.equal(h.ton, 'eclat', `${h.key} : un exploit, pas un coup du sort`)
    assert.ok(PART_DES_JOUEURS[h.key] !== undefined, `${h.key} : sa rareté`)
    // « gagner de l'expérience + niveau de rareté » : l'expérience suit la rareté, au barème des exploits du Cabinet.
    assert.equal(h.xp, XP_DES_EXPLOITS_DU_CABINET[rareteMesuree(h.key)!], `${h.key} : ${rareteMesuree(h.key)}`)
    assert.equal(pageDuTrophee(h.key), 'cabinet')
    assert.equal(h.paieUneFois, undefined, `${h.key} se regagne, et paie à chaque fois`)
  }
  // Leurs règles écrivent leurs seuils en toutes lettres : le barème et la phrase changent ensemble.
  const regle = (cle: string) => HAUTS_FAITS_DU_CABINET.find(h => h.key === cle)!.rule
  assert.equal(JEUX_DU_TOUCHE_A_TOUT, CLES_DES_JEUX.length, 'Touche-à-tout : les dix')
  assert.match(regle('hf:touche-a-tout'), /chacun des dix jeux/)
  for (const jeu of CLES_DES_JEUX) assert.ok(JEUX_PRETS.includes(jeu), `${jeu} se joue : Touche-à-tout reste possible`)
  assert.equal(OR_DE_CRESUS, 1000)
  assert.match(regle('hf:cresus'), /mille pièces/)
  // Une piste par jeu : sa clé, l'emoji de la carte de la traversée, sa mesure dans `StatsDeCampagne`.
  for (const jeu of CLES_DES_JEUX) {
    const h = hautFait(cleDeLaPisteDuJeu(jeu))
    assert.ok(h && h.famille === 'carriere', jeu)
    assert.equal(h.emoji, EMOJI_DES_JEUX[jeu], `${jeu} : l’emoji de son jeu`)
    assert.equal(h.deCampagne, `epreuves:${jeu}`)
    assert.equal(AUCUNE_CAMPAGNE[`epreuves:${jeu}`], 0)
  }
  // Toutes les pistes du Cabinet — L'Explorateur compris — se disent « Au Cabinet », et ses serveurs seuls les citent.
  const duCabinet = HAUTS_FAITS_DE_CARRIERE.filter(h => h.auCabinet)
  assert.equal(duCabinet.length, 1 + CLES_DES_JEUX.length + 6)
  for (const h of duCabinet) {
    assert.equal(origineDe(h), 'cabinet', h.key)
    assert.ok(PISTES_DU_CABINET.has(h.key), h.key)
    assert.ok(h.montreParLeServeur, `${h.key} : là où le Cabinet s’ouvre`)
    assert.ok(h.paliers[0] < h.paliers[1] && h.paliers[1] < h.paliers[2], `${h.key} : des paliers qui montent`)
    for (const k of [1, 2, 3]) assert.ok(PART_DES_JOUEURS[clePalier(h.key, k)] !== undefined, `${h.key}:${k} : sa rareté`)
  }
})

test('le résumé de la version 2 compte ce que les pistes lisent : les épreuves menées au bout jeu par jeu, les parfaites, l’or rapporté', () => {
  const t = traversee({ etoiles: n => (n === 2 ? [3, 0, 2] : [3, 3, 3]) })
  assert.equal(t.etat.fin?.issue, 'gagnee')
  const r = resumeDeLaTraversee(t.depart, t.gestes)
  assert.equal(r.v, VERSION_DU_RESUME)
  assert.equal(VERSION_DU_RESUME, 2)
  assert.equal(somme(r.compte.jeux), r.epreuves.filter(meneeAuBout).length)
  assert.equal(r.compte.parfaites, r.epreuves.filter(parfaite).length)
  assert.ok(r.compte.parfaites > 0 && r.compte.parfaites < r.epreuves.length, 'la deuxième épreuve n’est pas parfaite')
  // L'or rapporté : ce que chaque geste ajoute à la bourse, jamais ce que le marchand prend.
  let rapporte = 0
  for (let k = 1; k <= t.gestes.length; k++) {
    const avant = etatDeLaTraversee(t.depart, t.gestes.slice(0, k - 1))
    const apres = etatDeLaTraversee(t.depart, t.gestes.slice(0, k))
    if (apres.or > avant.or) rapporte += apres.or - avant.or
  }
  assert.equal(r.compte.or, rapporte)
  assert.ok(r.compte.or >= r.or, 'l’or rapporté passe ce qu’il garde en poche')
  // Ses cœurs : ceux que la deuxième épreuve a coûtés, et ceux qui restaient au coup final, avant que le gardien les rende.
  assert.equal(r.epreuves[1].coeurs, 1)
  assert.ok(coupFinal(r)?.restants !== undefined)
  // Il se relit tel qu'il s'est écrit ; une version d'avant — ses épreuves de maître, sans compte — ne se relit pas : sa page le refait.
  assert.deepEqual(lireLeResume(JSON.stringify(r)), r)
  const { compte: _compte, ...sansCompte } = r
  assert.equal(lireLeResume({ ...sansCompte, v: 1, maitrises: [] }), null)
  assert.equal(lireLeResume({ ...r, compte: { jeux: { pari: -1 }, parfaites: 0, or: 0 } }), null)
  // Le morceau que le lot des paliers en extrait : un jeu inconnu de ce code se tait, un compte abîmé aussi.
  assert.deepEqual(lireLeCompte('{"jeux":{"pari":2,"croquet":4},"parfaites":1,"or":30}'), { jeux: { pari: 2 }, parfaites: 1, or: 30 })
  for (const abime of [null, 'rien', '{"jeux":{},"parfaites":-1,"or":0}', '{"parfaites":0,"or":0}']) assert.equal(lireLeCompte(abime), null, String(abime))
})

test('les exploits se jugent sur une traversée gagnée, et elle seule : chacun sa condition', () => {
  const jouee = traversee()
  const gagnee = resumeDeLaTraversee(jouee.depart, jouee.gestes)
  assert.ok(estGagnee(gagnee))
  // Trois étoiles partout : pas un cœur perdu.
  assert.ok(exploitsDeLaTraversee(gagnee).includes('hf:intouchable'))
  assert.equal(exploitsDeLaTraversee(gagnee).includes('hf:implacable'), gagnee.assauts.every(a => a === 1))
  // Chaque condition, une à une, sur le même résumé retouché.
  const avec = (r: Partial<ResumeDeLaTraversee>) => exploitsDeLaTraversee({ ...gagnee, ...r })
  assert.ok(!avec({ epreuves: gagnee.epreuves.map((ep, k) => (k === 0 ? { ...ep, coeurs: 1 } : ep)) }).includes('hf:intouchable'), 'un cœur perdu')
  const final = gagnee.epreuves.indexOf(coupFinal(gagnee)!)
  const auCoupFinal = (restants: number) => gagnee.epreuves.map((ep, k) => (k === final ? { ...ep, restants } : ep))
  assert.ok(avec({ epreuves: auCoupFinal(1) }).includes('hf:sur-le-fil'))
  assert.ok(!avec({ epreuves: auCoupFinal(2) }).includes('hf:sur-le-fil'))
  assert.ok(avec({ assauts: [1, 1, 1] }).includes('hf:implacable'))
  assert.ok(!avec({ assauts: [1, 2, 1] }).includes('hf:implacable'))
  const jeux = (n: number) => Object.fromEntries(CLES_DES_JEUX.slice(0, n).map(j => [j, 1]))
  assert.ok(avec({ compte: { ...gagnee.compte, jeux: jeux(10) } }).includes('hf:touche-a-tout'))
  assert.ok(!avec({ compte: { ...gagnee.compte, jeux: jeux(9) } }).includes('hf:touche-a-tout'))
  assert.ok(avec({ compte: { ...gagnee.compte, or: OR_DE_CRESUS } }).includes('hf:cresus'))
  assert.ok(!avec({ compte: { ...gagnee.compte, or: OR_DE_CRESUS - 1 } }).includes('hf:cresus'))
  // Son dernier gardien debout, rien : même parfaite jusque-là, elle ne tient aucun exploit.
  const enRoute = traversee({ arret: e => e.acte === 2 })
  const r = resumeDeLaTraversee(enRoute.depart, enRoute.gestes)
  assert.ok(!estGagnee(r))
  assert.deepEqual(exploitsDeLaTraversee({ ...r, assauts: [1, 1, 1], compte: { jeux: jeux(10), parfaites: 9, or: 5000 } }), [])
  // Il se regagne : chaque fois qu'il tombe, il paie, dans la ligne des paliers.
  assert.equal(xpHorsDesSoirees(['hf:intouchable', 'hf:intouchable', 'hf:sur-le-fil']), 2 * XP_DES_EXPLOITS_DU_CABINET.legendaire + XP_DES_EXPLOITS_DU_CABINET.epique)
})

test('ce que les pistes comptent de ses traversées : les sommes, les gardiens différents, les victoires d’affilée — une traversée rendue ne coupe pas la suite', () => {
  const compte = (jeux: Partial<Record<string, number>>, parfaites = 0, or = 0) => ({ jeux, parfaites, or })
  const ts: TraverseeComptee[] = [
    { issue: 'gagnee', compte: compte({ pari: 2, frise: 1 }, 2, 400), vaincus: ['lg:renard', 'lg:sphinx', 'lg:dragon'] },
    { issue: 'gagnee', compte: compte({ pari: 1 }, 1, 300), vaincus: ['lg:renard', 'lg:janus', 'lg:kraken'] },
    // Rendue par l'administrateur : ni gagnée, ni perdue — la suite continue.
    { issue: null, compte: compte({ quiz: 1 }), vaincus: ['lg:coq'] },
    { issue: 'gagnee', compte: compte({ mot: 3 }, 0, 100), vaincus: ['lg:coq', 'lg:lion', 'lg:comete'] },
    { issue: 'perdue', compte: compte({ pari: 1 }), vaincus: [] },
    // Un résumé d'avant la version 2 : son issue et ses gardiens comptent, ses épreuves attendent la relecture.
    { issue: 'gagnee', compte: null, vaincus: ['lg:tigre', 'lg:phenix', 'lg:chimere'] },
  ]
  const c = comptesDesTraversees(ts)
  assert.equal(c.traversees, 4)
  assert.equal(c.serie, 3, 'trois d’affilée, la rendue au milieu')
  assert.equal(c.jeux.pari, 4)
  assert.equal(c.jeux.mot, 3)
  assert.equal(c.jeux.epingle, 0)
  assert.equal(c.epreuves, 2 + 1 + 1 + 1 + 3 + 1)
  assert.equal(c.gardiens, 3 + 3 + 1 + 3 + 0 + 3)
  assert.equal(c.bestiaire, 11, 'chacun une fois')
  assert.equal(c.or, 800)
  assert.equal(c.parfaites, 3)
  // Telles que la base les rend (`lectureDesComptesDuCabinet`) : un résumé abîmé ne fait rien tomber, l'issue reste.
  const lignes = [
    { issue: 'gagnee', compte: '{"jeux":{"pari":2},"parfaites":12,"or":600}', vaincus: '["lg:renard","lg:sphinx","lg:dragon","lg:inconnu"]' },
    { issue: 'perdue', compte: 'pas du json', vaincus: '[' },
    { issue: null, compte: null, vaincus: null },
  ]
  assert.deepEqual(
    traverseesComptees({ rows: lignes } as unknown as ResultSet).map(t => [t.issue, t.compte?.parfaites ?? null, t.vaincus.length]),
    [
      ['gagnee', 12, 3],
      ['perdue', null, 0],
      [null, null, 0],
    ],
  )
  const stats = statsDuCabinetLues({ rows: lignes } as unknown as ResultSet)
  assert.equal(stats.traversees, 1)
  assert.equal(stats['epreuves:pari'], 2)
  assert.equal(stats.epreuvesParfaites, 12)
  assert.equal(stats.gardiensDifferents, 3)
  // Leurs paliers tombent avec ceux de la campagne : douze parfaites, Le Perfectionniste au bronze, rien de plus.
  const atteints = paliersDeCampagneAtteints({ ...AUCUNE_CAMPAGNE, ...stats })
  assert.ok(atteints.includes('hf:perfectionniste:1') && !atteints.includes('hf:perfectionniste:2'), atteints.join(', '))
  assert.ok(atteints.includes('hf:explorateur:1'))
})

// ── Au serveur ────────────────────────────────────────────────────────────

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

let n = 0
const unProfil = () => inscrireProfil(b.banc.url, `trophees${++n}`, `Trophée ${n}`)
const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const q = (s: string) => `'${s.replace(/'/g, "''")}'`

/** Une traversée écrite en base, comme le serveur l'aurait écrite — en route, ou finie avec son résumé. */
function enBaseALaMain(profil: string, id: string, t: { depart: DepartDeLaTraversee; gestes: readonly GesteDeLaTraverseeEcrit[] }, commenceeLe: number, fin?: { issue: string; legendaire: string | null; resume: string | null }) {
  aLaMain(
    b.fichier,
    [
      fin
        ? `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le, finie_le, issue, legendaire, resume) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(t.depart))}, ${commenceeLe}, ${commenceeLe + 1000}, ${q(fin.issue)}, ${fin.legendaire ? q(fin.legendaire) : 'NULL'}, ${fin.resume ? q(fin.resume) : 'NULL'})`
        : `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(t.depart))}, ${commenceeLe})`,
      ...t.gestes.map(({ geste }, k) => `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, ${k + 1}, ${q(JSON.stringify(geste))}, ${commenceeLe + k + 1}, 'u${k}')`),
    ].join(';\n'),
  )
}

const rangesSous = (profil: string, sous: string): string[] =>
  enBase(b.fichier, db => (db.prepare('SELECT badge FROM profile_badges WHERE profile_id = ? AND soiree_id = ? ORDER BY badge').all(profil, sous) as { badge: string }[]).map(r => r.badge))
const sonEtagere = (profil: string): string[] => enBase(b.fichier, db => (db.prepare('SELECT badge FROM profile_badges WHERE profile_id = ?').all(profil) as { badge: string }[]).map(r => r.badge))
const xpDesPaliers = (profil: string): number => enBase(b.fichier, db => Number((db.prepare("SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#paliers'").get(profil) as { xp: number } | undefined)?.xp ?? 0))
const resumeEnBase = (id: string): unknown => enBase(b.fichier, db => (db.prepare('SELECT resume FROM cabinet_traversees WHERE id = ?').get(id) as { resume: string | null }).resume)
type Vu = { key: string; fois: number; valeur?: number }
const sesTrophees = async (cookie: string) => new Map((ok(await lire(b, cookie, '/api/joueur/moi'), 'le profil').profile.hautsFaits as Vu[]).map(h => [h.key, h]))

/** Une traversée écrite jusqu'au choix de son légendaire, relue au redémarrage, puis gagnée par la route : le légendaire choisi. */
async function gagnerParLaRoute(cookie: string, profil: string, id: string, commenceeLe: number, t = traversee({ arret: e => e.ou.sorte === 'legendaire' })) {
  enBaseALaMain(profil, id, t, commenceeLe)
  await b.banc.redemarrer()
  const page = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page')
  assert.equal(page.traversee!.ou.sorte, 'legendaire')
  // Les trois gardiens à terre : la vue dit déjà ses exploits, que le bilan du coup final montre.
  const attendus = exploitsDeLaTraversee(resumeDeLaTraversee(t.depart, t.gestes))
  assert.deepEqual(page.traversee!.exploits, attendus)
  const fin = ok(await poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${id}/geste`, { rang: page.traversee!.rang, geste: { quoi: 'legendaire', gardien: GARDIENS[0] } }), 'le légendaire choisi')
  return { t, attendus, fin }
}

/** Les paliers rangés sous une traversée : ce que son écran de fin doit dire. */
const sesPaliers = (cles: readonly string[]) => cles.filter(cle => palierDe(cle) !== null)

test('une traversée gagnée : ses exploits rangés sous elle et payés, ses pistes comptées, leurs paliers tombés à sa fin — puis une deuxième, qui les repaie', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  const avant = xpDesPaliers(profil)
  const { t, attendus, fin } = await gagnerParLaRoute(cookie, profil, `gagnee-de-${profil}`, 1_000)
  assert.ok(attendus.includes('hf:intouchable'), 'trois étoiles partout : pas un cœur perdu')
  // Rangés sous la traversée, comme ses paliers — jamais sous `#cabinet`, qui ne se regagne pas.
  const sous = rangesSous(profil, cleDeSerie(`gagnee-de-${profil}`))
  for (const cle of attendus) assert.ok(sous.includes(cle), cle)
  assert.ok(sous.includes('hf:explorateur:1'), 'L’Explorateur, au choix du légendaire')
  // L'écran de fin dit ses exploits, et les paliers que sa fin a fait tomber : ceux de ses pistes rangés sous elle — La
  // Légende mise à part, qu'un exploit rangé juste avant a pu faire tomber lui-même.
  assert.deepEqual(fin.traversee!.exploits, attendus)
  const paliersDits = fin.traversee!.paliers ?? []
  assert.ok(paliersDits.includes('hf:explorateur:1'))
  const horsDeLaLegende = (cles: readonly string[]) => cles.filter(cle => !cle.startsWith('hf:legende:')).sort()
  assert.deepEqual(horsDeLaLegende(paliersDits), horsDeLaLegende(sesPaliers(sous)))
  // Son résumé, écrit par le lot qui la finit, à la version du jour : ce que ses pistes lisent.
  const resume = lireLeResume(resumeEnBase(`gagnee-de-${profil}`))
  assert.ok(resume, 'un résumé de la version du jour')
  // Les paliers de ses pistes : ce que ses comptes atteignent, tombé à sa fin, rangé sous elle.
  const comptes = comptesDesTraversees([{ issue: 'gagnee', compte: resume.compte, vaincus: resume.vaincus }])
  const vus = await sesTrophees(cookie)
  assert.equal(vus.get('hf:perfectionniste')?.valeur, comptes.parfaites)
  assert.equal(vus.get('hf:chasseur')?.valeur, 3)
  assert.equal(vus.get('hf:bestiaire')?.valeur, 3)
  assert.equal(vus.get('hf:pensionnaire')?.valeur, comptes.epreuves)
  assert.equal(vus.get('hf:coffre-fort')?.valeur, comptes.or)
  for (const jeu of CLES_DES_JEUX) assert.equal(vus.get(cleDeLaPisteDuJeu(jeu))?.valeur, comptes.jeux[jeu], jeu)
  assert.equal(sous.includes('hf:perfectionniste:1'), comptes.parfaites >= 10)
  // L'expérience : la ligne des paliers, refaite de son étagère — chaque exploit, chaque palier.
  assert.equal(xpDesPaliers(profil), xpHorsDesSoirees(sonEtagere(profil)))
  assert.ok(xpDesPaliers(profil) - avant >= XP_DES_EXPLOITS_DU_CABINET.legendaire, 'L’Intouchable, au moins')
  // Une deuxième, gagnée de même : l'exploit retombe sous elle, et paie de nouveau ; deux d'affilée, L'Invaincu au bronze.
  const xpApresLaPremiere = xpDesPaliers(profil)
  const { fin: encore } = await gagnerParLaRoute(cookie, profil, `encore-de-${profil}`, 2_000_000, t)
  assert.ok(rangesSous(profil, cleDeSerie(`encore-de-${profil}`)).includes('hf:intouchable'))
  assert.ok(encore.traversee!.paliers?.includes('hf:invaincu:1'), 'son écran de fin dit L’Invaincu')
  assert.equal(encore.traversee!.paliers?.includes('hf:explorateur:1'), false, 'pas deux fois le même palier')
  const ensuite = await sesTrophees(cookie)
  assert.equal(ensuite.get('hf:intouchable')?.fois, 2)
  assert.equal(ensuite.get('hf:invaincu')?.valeur, 2)
  assert.ok(rangesSous(profil, cleDeSerie(`encore-de-${profil}`)).includes('hf:invaincu:1'))
  assert.ok(xpDesPaliers(profil) - xpApresLaPremiere >= XP_DES_EXPLOITS_DU_CABINET.legendaire)
  assert.equal(xpDesPaliers(profil), xpHorsDesSoirees(sonEtagere(profil)))
})

test('abandonnée, une traversée compte aussi : ses épreuves et ses gardiens rejoignent les pistes à sa fin — sans un exploit', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  const id = `laissee-de-${profil}`
  const t = traversee({ arret: e => e.acte === 1 && e.ou.sorte === 'carte' && e.ameliorations === 0 })
  enBaseALaMain(profil, id, t, 3_000)
  await b.banc.redemarrer()
  const page = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page')
  ok(await poster(b, cookie, `/api/cabinet/traversee/${id}/geste`, { rang: page.traversee!.rang, geste: { quoi: 'abandonner' } }), 'abandonner')
  const resume = lireLeResume(resumeEnBase(id))
  assert.ok(resume, 'son résumé, à la version du jour')
  const vus = await sesTrophees(cookie)
  assert.equal(vus.get('hf:pensionnaire')?.valeur, somme(resume.compte.jeux))
  assert.equal(vus.get('hf:chasseur')?.valeur, 1, 'le gardien de l’acte I')
  assert.ok(!sonEtagere(profil).some(cle => CLES_DES_EXPLOITS.includes(cle as never)), 'pas gagnée : aucun exploit')
})

test('au démarrage, les traversées d’avant se relisent une fois : leur résumé refait, leurs exploits rangés, leurs paliers jugés', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  // Gagnée et finie avant les trophées : son résumé de la version 1 (ses épreuves de maître, sans compte), son légendaire choisi.
  const t = traversee()
  assert.equal(t.etat.fin?.issue, 'gagnee')
  const id = `ancienne-de-${profil}`
  const { compte: _compte, ...version1 } = resumeDeLaTraversee(t.depart, t.gestes)
  enBaseALaMain(profil, id, t, 5_000, { issue: 'gagnee', legendaire: GARDIENS[0], resume: JSON.stringify({ ...version1, v: 1, maitrises: [] }) })
  aLaMain(b.fichier, `DELETE FROM campagne_meta WHERE cle = ${q(RELECTURE_DES_DEFIS)}`)
  await b.banc.redemarrer()
  // Sans qu'une page la lise : la relecture du démarrage.
  assert.equal(lireLeResume(resumeEnBase(id))?.v, VERSION_DU_RESUME, 'refait à la version du jour')
  const sous = rangesSous(profil, cleDeSerie(id))
  for (const cle of exploitsDeLaTraversee(resumeDeLaTraversee(t.depart, t.gestes))) assert.ok(sous.includes(cle), cle)
  assert.ok(sous.includes('hf:explorateur:1'), 'ses paliers, sous sa dernière traversée finie')
  assert.equal(xpDesPaliers(profil), xpHorsDesSoirees(sonEtagere(profil)))
  const version = enBase(b.fichier, db => (db.prepare('SELECT valeur FROM campagne_meta WHERE cle = ?').get(RELECTURE_DES_DEFIS) as { valeur: string } | undefined)?.valeur)
  assert.equal(Number(version), VERSION_DES_DEFIS)
  // Une fois : effacée derrière son dos, la ligne ne revient pas au démarrage suivant.
  aLaMain(b.fichier, `DELETE FROM profile_badges WHERE profile_id = ${q(profil)} AND badge = 'hf:intouchable'`)
  await b.banc.redemarrer()
  assert.ok(!sonEtagere(profil).includes('hf:intouchable'))
})

test('une épreuve de maître d’avant se tait, et le légendaire qu’elle a donné reste à lui', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  // Ce qu'un gardien vaincu en maître rangeait, du 1er au 4 novembre 2026 : sa clé, et la voie de son légendaire.
  aLaMain(
    b.fichier,
    ['cabinet:maitrise:renard', 'cabinet:renard']
      .map(c => `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (${q(profil)}, ${q(c)}, '#cabinet', '', '👑', 'maître', 1)`)
      .join(';\n'),
  )
  await b.banc.redemarrer()
  const page = ok(await lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page')
  assert.ok(page.possedes.includes('lg:renard'), 'son légendaire reste à lui')
  assert.deepEqual(Object.keys(page.defis), ['rangs'], 'ce qu’il tient ne dit plus que ses rangs')
  const moi = ok(await lire(b, cookie, '/api/joueur/moi'), 'le profil').profile
  assert.deepEqual(Object.keys(moi.defisDuCabinet), ['rangs'])
  assert.equal(moi.badges ?? 0, 0, 'ni un trophée, ni un badge')
})

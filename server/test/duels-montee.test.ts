// La montée (le choix du propriétaire du 14 octobre 2026, après le « je fais
// que reculer » d'une joueuse qui lançait beaucoup de duels : « je veux que
// tout le monde monte en Or s'il joue, même s'il n'est pas très bon »). Deux
// cotes : la cachée, l'ELO seul, dit le niveau et règle Automate ; celle
// qu'on voit, celle des ligues, avance pour qui joue — sous l'Or, une défaite
// ne coûte presque rien ; dès l'Or, l'enjeu suit l'écart ; l'Argent et l'Or
// ne se perdent plus ; qui lance un défi gagne un point de plus. Chaque test
// échouait avant : l'ELO seul faisait reculer une partie sur deux.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'
import {
  COTE_DE_DEPART,
  DUELS_DE_PLACEMENT,
  PARTICIPATION_SOUS_L_OR,
  PART_DU_LANCEUR,
  chancesDeGagner,
  coteDuScore,
  ecartContre,
  ecartDeLaMontee,
  enjeuContre,
  enjeuDuDuel,
  ligueDe,
  niveauDeLaCote,
  niveauPourLeDuel,
  plancherApres,
  releverLesDuels,
  type DuelJoue,
  type Resultat,
} from '../../shared/duels'
import { ProfileStore } from '../src/auth/profiles'
import { CampagneStore } from '../src/core/campagne'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const SEUIL_DE_L_ARGENT = 1100
const SEUIL_DE_L_OR = 1200
const semaine = () => '2026-10-05'

/** Le `n`-ième duel d'un journal : ses bonnes réponses contre celles d'en face, finis une minute après l'autre. */
const duel = (i: number, justes: number, sesJustes: number, plus: Partial<DuelJoue> = {}): DuelJoue => ({
  serie: `d${String(i).padStart(4, '0')}`,
  justes,
  sesJustes,
  finiLe: DEBUT + i * 60_000,
  ...plus,
})

test('sous l’Or, chaque duel fait avancer : une victoire rapporte cinq points au moins, une défaite en coûte un au plus — et rien à qui l’a lancé', () => {
  for (let cote = 700; cote < SEUIL_DE_L_OR; cote += 7) {
    for (let adverse = 400; adverse <= 2000; adverse += 25) {
      const ecart = (r: Resultat, lance = false) => ecartDeLaMontee(cote, adverse, r, lance)
      assert.ok(ecart(1) >= PARTICIPATION_SOUS_L_OR, `${cote} contre ${adverse} : victoire ${ecart(1)}`)
      assert.ok(ecart(0.5) > 0, `${cote} contre ${adverse} : égalité ${ecart(0.5)}`)
      assert.ok(ecart(0) >= -1, `${cote} contre ${adverse} : défaite ${ecart(0)}`)
      assert.ok(ecart(0, true) >= 0, `${cote} contre ${adverse} : défaite de qui a lancé ${ecart(0, true)}`)
      // Qui lance gagne sa part quelle que soit l'issue.
      for (const r of [1, 0.5, 0] as const) assert.equal(ecart(r, true), ecart(r) + PART_DU_LANCEUR)
    }
  }
  // Ce que l'ELO seul lui faisait : moins vingt-quatre à cotes égales, au placement — « je fais que reculer ».
  assert.equal(ecartContre(COTE_DE_DEPART, COTE_DE_DEPART, 0, 0), -24)
  assert.deepEqual(enjeuContre({ cote: COTE_DE_DEPART }, COTE_DE_DEPART), { cote: COTE_DE_DEPART, gagne: 17, egalite: 4, perdu: 2 })
})

test('dès l’Or, l’enjeu suit l’écart : contre plus fort, perdre ne coûte presque rien ; contre plus faible, plus qu’une victoire ne rapporte', () => {
  const enOr = { cote: 1300, plancher: SEUIL_DE_L_OR }
  const contreFort = enjeuContre(enOr, 1500)
  assert.ok(contreFort.perdu >= -1, `contre plus fort, perdre coûte ${contreFort.perdu}`)
  assert.ok(contreFort.gagne >= 15, `contre plus fort, gagner rapporte ${contreFort.gagne}`)
  const contreFaible = enjeuContre(enOr, 1100)
  assert.ok(-contreFaible.perdu > contreFaible.gagne, `contre plus faible : ${contreFaible.gagne} gagné, ${contreFaible.perdu} perdu`)
  // Une égalité contre plus faible coûte, contre plus fort rapporte.
  assert.ok(contreFaible.egalite < 0 && contreFort.egalite > 0)
  // La participation : cinq points par duel sous l'Or, un seul dès l'Or.
  assert.equal(ecartDeLaMontee(1300, 1300, 1), 13)
  assert.equal(ecartDeLaMontee(1100, 1100, 1), 17)
})

test('l’Argent et l’Or, une fois atteints, ne se perdent plus ; la Platine, si', () => {
  assert.equal(plancherApres(null, 1099), null)
  assert.equal(plancherApres(null, SEUIL_DE_L_ARGENT), SEUIL_DE_L_ARGENT)
  assert.equal(plancherApres(SEUIL_DE_L_ARGENT, 1250), SEUIL_DE_L_OR)
  assert.equal(plancherApres(SEUIL_DE_L_OR, 1050), SEUIL_DE_L_OR, 'un plancher ne redescend jamais')
  assert.equal(plancherApres(SEUIL_DE_L_OR, 1350), SEUIL_DE_L_OR, 'la Platine ne se garde pas')
  // Ce que la page dit d'une défaite s'arrête au plancher : contre bien plus faible, à 1205, cinq points, pas onze.
  assert.equal(enjeuContre({ cote: 1205, plancher: SEUIL_DE_L_OR }, 1050).perdu, -5)
  assert.equal(enjeuContre({ cote: 1205 }, 1050).perdu, ecartDeLaMontee(1205, 1050, 0), 'sans plancher connu — une page d’avant —, l’écart brut')
  assert.equal(ecartDeLaMontee(1205, 1050, 0), -11)

  // Des victoires jusqu'à l'Argent, puis cinquante défaites contre un score d'une bonne réponse : il y reste.
  const argent: DuelJoue[] = []
  for (let i = 0; releverLesDuels(argent, semaine).cote < SEUIL_DE_L_ARGENT; i++) argent.push(duel(i, 10, 9))
  for (let i = 0; i < 50; i++) argent.push(duel(argent.length, 0, 1))
  const enArgent = releverLesDuels(argent, semaine)
  assert.equal(ligueDe(enArgent.cote).cle, 'argent')
  assert.equal(enArgent.plancher, SEUIL_DE_L_ARGENT)
  // De même à l'Or ; puis la Platine, atteinte et reperdue : il redescend en Or, jamais dessous.
  const or: DuelJoue[] = []
  for (let i = 0; releverLesDuels(or, semaine).cote < 1300; i++) or.push(duel(i, 18, 17))
  assert.equal(ligueDe(releverLesDuels(or, semaine).cote).cle, 'platine')
  for (let i = 0; i < 50; i++) or.push(duel(or.length, 0, 1))
  const retombe = releverLesDuels(or, semaine)
  assert.deepEqual([retombe.cote, retombe.plancher], [SEUIL_DE_L_OR, SEUIL_DE_L_OR])
  // Les écarts que l'historique raconte disent ce qui s'est passé, plancher compris : leur somme fait la cote.
  assert.equal(
    [...retombe.ecarts.values()].reduce((n, e) => n + e.ecart, COTE_DE_DEPART),
    retombe.cote,
  )
})

test('deux cotes : la cachée suit l’ELO seul, placement compris, et règle Automate ; celle qu’on voit monte', () => {
  // Un duel gagné à cotes égales : l'ELO de placement à la cachée, la montée à celle qu'on voit.
  const un = releverLesDuels([duel(0, 8, 7)], semaine)
  assert.deepEqual([un.cachee, un.cote], [COTE_DE_DEPART + 24, COTE_DE_DEPART + 17])
  // Vingt duels, un gagné sur trois contre la cote de départ : la cachée descend, celle qu'on voit monte.
  const journal = Array.from({ length: 21 }, (_, i) => (i % 3 === 0 ? duel(i, 8, 7) : duel(i, 6, 7)))
  const r = releverLesDuels(journal, semaine)
  assert.ok(r.cachee < COTE_DE_DEPART, `la cachée, son niveau : ${r.cachee}`)
  assert.ok(r.cote > COTE_DE_DEPART + 50, `celle qu’on voit : ${r.cote}`)
  // Automate se règle sur la cachée : sur celle qu'on voit, il jouerait au-dessus de lui.
  assert.equal(niveauPourLeDuel(r.joues, r.cachee, 9), niveauDeLaCote(r.cachee))
  assert.ok(niveauDeLaCote(r.cachee) < niveauDeLaCote(r.cote))
})

// Le souhait même du propriétaire : qui joue monte en Or, même pas très bon.
// Un joueur faible — sa campagne le dit à quatre bonnes réponses par série —
// qui ne gagne qu'un duel sur trois contre Automate réglé sur son niveau caché
// (c'est pessimiste : à son niveau, on en gagne quatre sur dix).
test('qui joue monte en Or, même pas très bon : un duel gagné sur trois contre Automate à son niveau, et l’Or est atteint — puis gardé', () => {
  const journal: DuelJoue[] = []
  let r = releverLesDuels(journal, semaine)
  let argentA: number | null = null
  let orA: number | null = null
  for (let i = 0; i < 150; i++) {
    const avant = r
    // Automate fait le score de son niveau : celui de sa campagne au placement, puis celui de sa cote cachée.
    const sesJustes = Math.max(1, Math.round(niveauPourLeDuel(r.joues, r.cachee, 4)))
    journal.push(duel(i, i % 3 === 2 ? sesJustes + 1 : sesJustes - 1, sesJustes))
    r = releverLesDuels(journal, semaine)
    if (avant.cote < SEUIL_DE_L_OR) assert.ok(r.cote - avant.cote >= -1, `duel ${i + 1} : ${avant.cote} → ${r.cote}, plus d’un point de perdu sous l’Or`)
    if (avant.cote >= SEUIL_DE_L_OR) assert.ok(r.cote >= SEUIL_DE_L_OR, `duel ${i + 1} : l’Or reperdu (${r.cote})`)
    argentA ??= r.cote >= SEUIL_DE_L_ARGENT ? i + 1 : null
    orA ??= r.cote >= SEUIL_DE_L_OR ? i + 1 : null
  }
  // Trente duels pour l'Argent, quatre-vingt-quatre pour l'Or, le 14 octobre 2026 : un mois et demi à deux duels par jour.
  assert.ok(argentA !== null && argentA <= 40, `l’Argent en ${argentA} duels`)
  assert.ok(orA !== null && orA <= 100, `l’Or en ${orA} duels`)
  // Son niveau, lui, ne ment pas : sa cachée est bien sous la cote de départ.
  assert.ok(r.cachee < COTE_DE_DEPART)
  // Sans la montée — l'ELO seul, celui d'avant —, le même joueur ne quittait pas le Bronze.
  assert.equal(ligueDe(r.cachee).cle, 'bronze')
})

// ── Le serveur ──────────────────────────────────────────────────────────────

const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Les duels d'un journal, écrits en rencontres finies au journal de qui les a joués. */
function auJournal(banc: Banc, profileId: string, duels: readonly DuelJoue[]) {
  base(banc, db => {
    for (const d of duels) {
      const adversaire = { serie: randomUUID(), profil: '', simule: true, reponses: [...Array(d.sesJustes).fill(true), ...Array(VIES).fill(false)] }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      ).run(randomUUID(), profileId, d.justes + VIES, d.justes, d.finiLe - 30_000, d.finiLe, JSON.stringify(adversaire))
    }
  })
}

test('le serveur : Automate se règle sur la cote cachée, la page dit celle qu’on voit et son plancher, l’enjeu du dé s’y lit', async () => {
  const avant = CampagneStore.reponsesDAutomate
  const niveaux: number[] = []
  // Automate fait toujours sept bonnes réponses : le niveau qu'on lui demande, retenu.
  CampagneStore.reponsesDAutomate = ({ niveau }) => (niveaux.push(niveau), [...Array(7).fill(true), ...Array(VIES).fill(false)])
  const banc = await demarrer({ horlogeDuJour: () => DEBUT + 3_600_000, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const idLea = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('lea') as { id: string }).id)
    // Trente duels finis, un gagné sur trois : placée, sa cote cachée sous la cote de départ, celle qu'on voit en Argent.
    const journal = Array.from({ length: 30 }, (_, i) => duel(i - 40, i % 3 === 0 ? 8 : 6, 7))
    auJournal(banc, idLea, journal)
    const attendu = releverLesDuels(journal, semaine)
    assert.ok(attendu.joues >= DUELS_DE_PLACEMENT)
    assert.ok(attendu.cote >= SEUIL_DE_L_ARGENT && attendu.cachee < COTE_DE_DEPART, `${attendu.cote} / ${attendu.cachee}`)

    // La page : la cote qu'on voit, sa ligue et son plancher — jamais la cachée.
    const page = (await lire(banc, lea, '/api/duels')).corps
    assert.deepEqual([page.cote, page.ligue, page.plancher], [attendu.cote, ligueDe(attendu.cote).cle, attendu.plancher])
    assert.doesNotMatch(JSON.stringify(page), /cach/i, 'la cote cachée ne part jamais')

    // Le dé : Automate joue au niveau de sa cote cachée — sur celle qu'on voit, il serait trop fort pour elle.
    const de = await ecrire(banc.url, '/api/campagne/rencontre', {}, lea).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    assert.equal(de.status, 200, de.corps.error)
    assert.equal(niveaux.at(-1), niveauDeLaCote(attendu.cachee))
    assert.ok(niveaux.at(-1)! < niveauDeLaCote(attendu.cote))
    // Ce qui se joue se dit sur celle qu'on voit, contre la cote de son score, son plancher compris.
    assert.deepEqual(de.corps.enjeu, enjeuDuDuel(attendu, 7))
    assert.ok(de.corps.enjeu.perdu > -2, `sous l’Or, perdre ne coûte presque rien : ${de.corps.enjeu.perdu}`)
    assert.ok(chancesDeGagner(attendu.cote, coteDuScore(7)) > 0.5, 'celle qu’on voit est au-dessus de son niveau')
  } finally {
    CampagneStore.reponsesDAutomate = avant
    await banc.close()
  }
})

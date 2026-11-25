// Le Sphinx de l'accueil au QG (`/admin#sphinx`, l'étape 3 du plan du
// 24 novembre 2026, `retours/2026-11-24/le-sphinx/plan.md`), sur un serveur
// jetable : la page se lit sans une réponse ni un mot caché ; la réponse d'une
// énigme n'arrive que par son geste, qui la range parmi celles que le profil de
// l'administrateur a vues — le Sphinx ne la lui proposera plus —, et le journal
// des gestes le note sans la citer ; personne d'autre que l'administrateur n'y
// entre.
//
// Le propriétaire joue aussi : aucun message d'assertion ne cite une réponse
// ni un mot d'une légende — seulement un numéro, une place, un nom de Divin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { legendeDe } from '../src/core/divins'
import { ENIGMES_DEJA_VUES_DU_PROPRIETAIRE, ORDRE_DU_SPHINX, enigmesDuSphinx, motsDeLaLegende, normaliser, type Enigme } from '../src/core/sphinx'
import { JOURS_DU_SPHINX_AU_QG, type PageDuSphinxAuQg, type ReponseDuSphinxAuQg } from '../../shared/qgSphinx'
import type { EtatDeLaMaintenance } from '../../shared/maintenance'

ProfileStore.tirageEclat = () => false

/** Midi à Paris, un jour de septembre 2026. */
const midi = (jour: number) => Date.UTC(2026, 8, jour, 10, 0)
const septembre = (jour: number) => `2026-09-${String(jour).padStart(2, '0')}`

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des jours joués au quiz du jour, écrits en base : ce qu'un habitué a derrière lui. */
function joue(banc: Banc, login: string, premier: number, dernier: number) {
  const id = idDe(banc, login)
  base(banc, db => {
    for (let j = premier; j <= dernier; j++) {
      db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(
        septembre(j),
        JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
      )
      db.prepare(
        `INSERT OR IGNORE INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 500, 5, 2, 0)`,
      ).run(id, septembre(j))
    }
  })
}

const lire = (banc: Banc, cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const laPage = async (banc: Banc, admin: string): Promise<PageDuSphinxAuQg> => {
  const r = await lire(banc, admin, '/api/admin/sphinx')
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}
const voirLaReponse = (banc: Banc, admin: string, numero: string) => faire(banc, admin, `/api/admin/sphinx/enigmes/${numero}/reponse`)

async function avecBanc(debut: number, reglages: Parameters<typeof demarrer>[0], scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, tirageDuSphinx: () => 0, ...reglages })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const enigmeDe = (numero: string): Enigme => enigmesDuSphinx().find(e => e.numero === numero)!

/** Ce qu'une énigme ne doit jamais laisser lire hors de son geste : sa solution, sa clé, ses réponses acceptées et brûlantes. */
const sesReponses = (e: Enigme) => [e.solution, ...(e.cle ? [e.cle] : []), ...e.acceptees, ...e.presque].map(normaliser).filter(r => r.length > 2)

/** Un texte, lu comme le Sphinx lit une réponse, contient-il ce mot entier ? */
const contient = (texte: string, mot: string) => ` ${normaliser(texte)} `.includes(` ${mot} `)

/**
 * Les champs qui ne disent qu'un code, une date ou un numéro — et le refus, une phrase écrite dans le code, la même
 * pour toutes les énigmes, que chaque épreuve compare mot pour mot — : leurs valeurs ne se cherchent pas (un mot
 * ordinaire de la phrase peut être la réponse d'une énigme).
 */
const CODES = new Set(['sorte', 'difficulte', 'aToi', 'jour', 'aujourdhui', 'numero', 'key', 'error'])

/**
 * Aucun champ qui porterait un secret, et dans le texte de la page — ses
 * valeurs, sans ses vers, qui disent ce qu'ils veulent, ni ses codes —, aucune
 * réponse d'aucune énigme, aucun mot caché d'aucun Divin.
 */
function rienDeSecret(page: unknown, enigmes: readonly Enigme[], ou: string) {
  const cles = new Set<string>()
  const valeurs: string[] = []
  JSON.stringify(page, (cle, valeur) => {
    cles.add(cle)
    if (cle === 'vers') return undefined
    if (typeof valeur === 'string' && !CODES.has(cle)) valeurs.push(valeur)
    return valeur
  })
  for (const champ of ['solution', 'acceptees', 'presque', 'cle', 'legende', 'mots', 'forme', 'texte']) assert.ok(!cles.has(champ), `${ou} : aucun champ « ${champ} »`)
  const texte = valeurs.join(' · ')
  for (const e of enigmes) assert.ok(!sesReponses(e).some(r => contient(texte, r)), `${ou} : une réponse de l’énigme n° ${e.numero}`)
  for (const cle of ORDRE_DU_SPHINX) {
    const legende = legendeDe(cle)
    if (!legende) continue
    motsDeLaLegende(legende).forEach((m, i) => {
      if (m.cache) assert.ok(!contient(texte, normaliser(m.texte)), `${ou} : le mot caché n° ${i} de ${cle}`)
    })
  }
}

test('la page du Sphinx au QG compte tout et ne dit rien : ni une réponse, ni un mot caché, ni la forme d’une phrase', () => {
  const reserve = enigmesDuSphinx()
  return avecBanc(midi(26), {}, async banc => {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')).status, 200)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    joue(banc, 'lea', 23, 26)
    joue(banc, 'tom', 23, 26)
    joue(banc, 'zoe', 25, 26)

    // Zoé n'est pas une habituée ; Léa et Tom le sont, et chacun a sa visite.
    for (const c of [lea, tom, zoe]) assert.equal((await lire(banc, c, '/api/joueur/missions')).status, 200)
    const deLea = (await lire(banc, lea, '/api/joueur/sphinx')).corps.visite.enigme.numero as string
    const deTom = (await lire(banc, tom, '/api/joueur/sphinx')).corps.visite.enigme.numero as string
    const juste = await faire(banc, lea, '/api/joueur/sphinx', { geste: 'repondre', reponse: enigmeDe(deLea).solution })
    assert.equal(juste.corps.verdict, 'juste')
    assert.equal((await faire(banc, tom, '/api/joueur/sphinx', { geste: 'chat' })).corps.verdict, 'abandon')

    const page = await laPage(banc, admin)
    rienDeSecret(page, reserve, 'la page')
    // Le Divin du moment : son nom, et combien de ses mots cachés tous ont trouvés.
    const moment = ORDRE_DU_SPHINX[0]
    assert.equal(page.moment?.divin.key, moment)
    assert.equal(page.moment?.parTous, 1, 'le mot de Léa')
    assert.equal(page.moment?.aTrouver, motsDeLaLegende(legendeDe(moment)!).filter(m => m.cache).length)
    assert.deepEqual(page.reconstituees, [])
    assert.equal(page.habitues, 2, 'Léa et Tom, pas Zoé')
    // Jour par jour : trente jours, aujourd'hui au bout, ses deux visites par leur issue.
    assert.equal(page.jours.length, JOURS_DU_SPHINX_AU_QG)
    assert.deepEqual(page.jours.at(-1), { jour: septembre(26), proposee: 0, 'plus-tard': 0, resolue: 1, perdue: 0, abandonnee: 1 })
    assert.ok(page.jours.slice(0, -1).every(j => j.resolue + j.abandonnee + j.proposee + j['plus-tard'] + j.perdue === 0))
    // Énigme par énigme : toute la réserve, dans son ordre, ses comptes.
    assert.deepEqual(
      page.enigmes.map(e => e.numero),
      reserve.map(e => e.numero),
    )
    const ligne = (n: string) => page.enigmes.find(e => e.numero === n)!
    // Leurs deux énigmes : la même parfois — chacun tire la sienne de sa graine, parmi les faciles.
    const attendu = (n: string) => [(n === deLea ? 1 : 0) + (n === deTom ? 1 : 0), n === deLea ? 1 : 0, n === deTom ? 1 : 0]
    for (const n of new Set([deLea, deTom])) assert.deepEqual([ligne(n).vues, ligne(n).resolues, ligne(n).chat], attendu(n), `l’énigme n° ${n}`)
    assert.equal(
      page.enigmes.reduce((s, e) => s + e.vues, 0),
      2,
      'deux visites en tout',
    )
    assert.deepEqual(ligne(deLea).vers, enigmeDe(deLea).vers, 'ses vers, que la page ne montre qu’au toucher')
    // Sans profil tenu par le compte d'administration, rien à lui : aucune réponse ne se lit.
    assert.equal(page.profil, false)
    const sansProfil = await voirLaReponse(banc, admin, deLea)
    assert.equal(sansProfil.status, 409)
    assert.deepEqual(sansProfil.corps, { error: 'Ton compte n’a pas de profil où ranger cette énigme : connecte-toi à ton profil, puis reviens.' })
  })
})

test('« Voir la réponse » la rend, la range pour vue sur le profil de l’administrateur, et le Sphinx ne la lui propose plus', () => {
  // Les huit que le propriétaire connaissait, et deux à voir.
  const neuves = enigmesDuSphinx()
    .filter(e => !(ENIGMES_DEJA_VUES_DU_PROPRIETAIRE as readonly string[]).includes(e.numero))
    .slice(0, 2)
  const reserve = [...ENIGMES_DEJA_VUES_DU_PROPRIETAIRE.map(enigmeDe), ...neuves]
  return avecBanc(midi(26), { enigmesDuSphinx: reserve }, async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')).status, 200)
    const proprio = await inscrireProfil(banc.url, 'proprio', 'Antoine', '🦉')
    joue(banc, 'proprio', 22, 27)
    base(banc, db => db.prepare(`UPDATE accounts SET profile_id = ? WHERE role = 'admin'`).run(idDe(banc, 'proprio')))
    await banc.redemarrer()
    const idProprio = idDe(banc, 'proprio')
    const admin2 = await connexionAnimateur(banc.url)

    // Sa visite du jour : la réponse de son énigme ne se lit pas ici tant qu'elle est ouverte.
    const sienne = (await lire(banc, proprio, '/api/joueur/sphinx')).corps.visite.enigme.numero as string
    const autre = neuves.find(e => e.numero !== sienne)!.numero
    let page = await laPage(banc, admin2)
    assert.equal(page.profil, true)
    assert.equal(page.enigmes.find(e => e.numero === sienne)?.aToi, 'en-cours')
    assert.equal(page.enigmes.find(e => e.numero === autre)?.aToi, null)
    assert.equal(page.enigmes.find(e => e.numero === '32')?.aToi, 'vue', 'une des huit qu’il connaissait')
    rienDeSecret(page, reserve, 'la page')
    const refus = await voirLaReponse(banc, admin2, sienne)
    assert.equal(refus.status, 409)
    assert.deepEqual(refus.corps, { error: 'Le Sphinx te la pose en ce moment : réponds-lui, ou donne ta langue au chat, avant de lire sa réponse ici.' })

    // L'autre : sa réponse, et elle rejoint ses énigmes vues.
    const lue = await voirLaReponse(banc, admin2, autre)
    assert.equal(lue.status, 200, lue.corps.error)
    const reponse = lue.corps as ReponseDuSphinxAuQg
    const e = enigmeDe(autre)
    assert.equal(reponse.numero, autre)
    assert.ok(reponse.solution === e.solution && reponse.cle === e.cle, 'la solution du livre, et sa clé s’il en a une')
    assert.deepEqual([reponse.acceptees, reponse.presque, reponse.deja], [e.acceptees, e.presque, false])
    assert.deepEqual(
      base(banc, db => db.prepare(`SELECT jour, etat, divin, mot FROM profile_sphinx WHERE profile_id = ? AND enigme = ?`).all(idProprio, autre)),
      [{ jour: `vue:${autre}`, etat: 'vue', divin: '', mot: null }],
    )
    page = await laPage(banc, admin2)
    assert.equal(page.enigmes.find(x => x.numero === autre)?.aToi, 'vue')
    assert.equal(page.enigmes.find(x => x.numero === autre)?.vues, 0, 'comptée pour vue, ce n’est pas une visite')
    // Une des huit : déjà vue, elle se relit, sans ligne de plus.
    const deja = await voirLaReponse(banc, admin2, '32')
    assert.deepEqual([deja.status, deja.corps.deja], [200, true])

    // Le journal le note — son numéro, son profil —, jamais sa réponse.
    const gestes = base(banc, db => db.prepare(`SELECT route, sorte, resume, cible FROM qg_gestes WHERE route LIKE '%sphinx%' ORDER BY quand, rowid`).all()) as {
      route: string
      sorte: string
      resume: string
      cible: string
    }[]
    assert.deepEqual(
      gestes.map(g => [g.route, g.sorte, g.cible]),
      [
        ['POST /api/admin/sphinx/enigmes/:numero/reponse', 'profil', idProprio],
        ['POST /api/admin/sphinx/enigmes/:numero/reponse', 'profil', idProprio],
      ],
      'deux gestes, le refus ne se note pas',
    )
    // Sa phrase, mot pour mot : un numéro et un profil, rien qui dépende de la réponse.
    const phrases = [
      `Réponse d’une énigme du Sphinx lue au QG : n° ${autre} — comptée pour vue sur le profil de Antoine (@proprio)`,
      'Réponse d’une énigme du Sphinx lue au QG : n° 32, déjà vue — comptée pour vue sur le profil de Antoine (@proprio)',
    ]
    assert.deepEqual(
      gestes.map(g => g.resume),
      phrases,
    )
    const journal = (await lire(banc, admin2, '/api/admin/gestes')).corps as { gestes: { resume: string }[] }
    // Dans la même milliseconde, deux gestes se rangent par leur identifiant tiré au hasard : comparés sans leur ordre.
    assert.deepEqual(
      journal.gestes
        .filter(g => g.resume.includes('Sphinx lue au QG'))
        .map(g => g.resume)
        .sort(),
      [...phrases].sort(),
      'la page du journal lit les mêmes',
    )
    for (const x of [enigmeDe(autre), enigmeDe('32')]) assert.ok(!phrases.some(p => p.includes(x.solution)), `le journal cite la solution de l’énigme n° ${x.numero}`)

    // Le lendemain, elle l'attend encore — une énigme reste jusqu'à sa fin (le choix du propriétaire du 25 novembre
    // 2026) — : sa réponse ne se lit toujours pas ici.
    horloge.t = midi(27)
    page = await laPage(banc, admin2)
    assert.equal(page.enigmes.find(x => x.numero === sienne)?.aToi, 'en-cours')
    assert.equal((await voirLaReponse(banc, admin2, sienne)).status, 409)
    // Close, et le jour d'après : plus rien à lui poser — l'autre est vue, la réponse lue ici.
    assert.equal((await faire(banc, proprio, '/api/joueur/sphinx', { geste: 'chat' })).corps.visite.etat, 'abandonnee')
    horloge.t = midi(28)
    assert.equal((await lire(banc, proprio, '/api/joueur/sphinx')).corps.visite, null)
    assert.ok(!('sphinx' in (await lire(banc, proprio, '/api/joueur/missions')).corps))
  })
})

test('la page et son geste ne s’ouvrent qu’à l’administrateur : ni un animateur, ni un joueur, ni sa télé', () =>
  avecBanc(midi(26), {}, async banc => {
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' }, admin)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    const nadia = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'nadia-pass-1' }))
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    for (const [qui, cookie, statut] of [
      ['un animateur', nadia, 403],
      ['un joueur', lea, 401],
    ] as const) {
      const page = await lire(banc, cookie, '/api/admin/sphinx')
      assert.equal(page.status, statut, `${qui} : la page`)
      const geste = await voirLaReponse(banc, cookie, '32')
      assert.equal(geste.status, statut, `${qui} : le geste`)
      rienDeSecret([page.corps, geste.corps], enigmesDuSphinx(), qui)
    }
    assert.equal(base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_sphinx`).get() as { n: number }).n), 0, 'rien ne s’est écrit')
  }))

test('la ligne du Sphinx de la maintenance s’ouvre à ses testeurs : bientôt disponible, ses testeurs nommés, eux seuls entrent', () =>
  avecBanc(midi(26), {}, async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    joue(banc, 'lea', 23, 26)
    joue(banc, 'bob', 23, 26)
    let etat = (await lire(banc, admin, '/api/admin/maintenance')).corps as EtatDeLaMaintenance
    assert.ok(etat.bientot.sphinx !== null, 'il démarre bientôt disponible')
    assert.deepEqual(etat.testeurs.sphinx, [])
    assert.equal((await ecrire(banc.url, `/api/admin/maintenance/pages/sphinx/testeurs/${idDe(banc, 'lea')}`, undefined, admin, 'PUT')).status, 200)
    etat = (await lire(banc, admin, '/api/admin/maintenance')).corps as EtatDeLaMaintenance
    assert.deepEqual(
      etat.testeurs.sphinx.map(t => [t.nom, t.login]),
      [['Léa', 'lea']],
    )
    assert.equal((await lire(banc, lea, '/api/joueur/missions')).corps.sphinx, 'attend', 'Léa, testeuse, le voit')
    assert.ok(!('sphinx' in (await lire(banc, bob, '/api/joueur/missions')).corps), 'Bob pas encore')
    // L'audience du QG les compte tous deux avant l'ouverture : la ligne des missions a jugé leurs jours.
    assert.equal((await laPage(banc, admin)).habitues, 2)
    // Ouvert à tous : Bob aussi.
    assert.equal((await ecrire(banc.url, '/api/admin/maintenance/pages/sphinx', { etat: 'ouverte' }, admin, 'PUT')).status, 200)
    assert.equal((await lire(banc, bob, '/api/joueur/missions')).corps.sphinx, 'attend')
  }))

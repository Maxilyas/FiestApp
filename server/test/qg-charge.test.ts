// Ce que les listes du QG coûtent à la base permanente. Le 17 octobre 2026,
// la seule erreur serveur d'une heure de production : `GET
// /api/admin/espaces`, dans l'heure du seul aller-retour vers Turso tombé en
// route (`qg_sante`, `connexions.echecs`). « Les salons » comptait les quiz de
// chaque espace d'un aller-retour chacun, « Les profils » ceux de chaque
// salon — vingt-quatre espaces, près de cinquante allers-retours partis
// ensemble à chaque ouverture du QG et à chaque retour d'une page. Une
// rafale prend toutes les connexions libres, la plus ancienne comprise,
// celle que Turso referme à 5 s (règle `journaux-et-miroir.md`), et un seul
// aller-retour tombé faisait répondre 500 à toute la liste. On compte sur le
// fichier `file:` qui tient lieu de Turso, comme `profil-charge.test.ts` :
// rien ne dépend de la charge de la machine.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai, connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, inscrireProfil, qcm, type Banc } from './banc'
import type { EspaceDAdministration } from '../../shared/space'
import type { ProfilDAdministration } from '../../shared/profil'
import type { VueDEnsemble } from '../../shared/qg'
import type { PageDeLEconomie } from '../../shared/qgEconomie'
import { jourDe } from '../../shared/jour'
import { VUE_GARDEE_MS, VUE_GARDEE_PENDANT_UNE_QUESTION_MS, VueGardee } from '../src/qg'

// ── Le compteur ───────────────────────────────────────────────────────────

/**
 * Ce que la base permanente a servi pendant une mesure : un aller-retour par
 * `execute` ou `batch`, chacune de ses instructions, et les lignes que chacune
 * a rendues — le client de Turso les décode une à une.
 */
const compte = { actif: false, allersRetours: 0, instructions: [] as string[], lignes: [] as { sql: string; lignes: number }[] }

const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim()

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (!compte.actif) return origine.apply(this, args)
    compte.allersRetours++
    const sqls = (methode === 'batch' ? (args[0] as unknown[]) : [args[0]]).map(sqlDe)
    compte.instructions.push(...sqls)
    return origine.apply(this, args).then(r => {
      const resultats = (methode === 'batch' ? r : [r]) as ({ rows?: unknown[] } | undefined)[]
      resultats.forEach((x, i) => compte.lignes.push({ sql: sqls[i], lignes: x?.rows?.length ?? 0 }))
      return r
    })
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ allersRetours: number; lecturesDesQuiz: number; resultat: T }> {
  Object.assign(compte, { actif: true, allersRetours: 0, instructions: [], lignes: [] })
  try {
    const resultat = await travail()
    return { allersRetours: compte.allersRetours, lecturesDesQuiz: compte.instructions.filter(sql => /\bFROM quizzes\b/.test(sql)).length, resultat }
  } finally {
    compte.actif = false
  }
}

// ── Huit salons, et l'espace de l'administrateur ──────────────────────────

const SALONS = 8
let banc: Banc
let admin: string

const lire = async <T>(chemin: string): Promise<T> => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: admin } })
  const lu = (await r.json()) as T & { error?: string }
  assert.equal(r.status, 200, `${chemin} : ${r.status} ${lu.error ?? ''}`)
  return lu
}

before(async () => {
  // Le préchauffage de la campagne lit la base : loin des mesures.
  banc = await demarrer({ baseDeLaCampagne: baseDEssai(10), prechauffageCampagneMs: 3_600_000 })
  admin = await connexionAnimateur(banc.url)
  for (let i = 0; i < SALONS; i++) {
    const joueur = await inscrireProfil(banc.url, `salon${i}`, `Joueur ${i}`)
    const console_ = cookieDe(await ecrire(banc.url, '/api/joueur/espace', {}, joueur))
    // Le premier salon a deux quiz, les autres aucun : chacun garde son compte.
    if (i === 0) for (const titre of ['Le premier', 'Le second']) await creerQuiz(banc.url, console_, [qcm('Un ?')], titre)
  }
  // Au réveil, comme en production : les titulaires ne sont plus en mémoire,
  // et rien de la mise en place n'est encore en vol.
  await banc.redemarrer()
})

after(() => banc.close())

test('« Les salons » comptent les quiz de tous les espaces d’une seule lecture, pas d’un aller-retour par espace', async () => {
  const { allersRetours, lecturesDesQuiz, resultat: espaces } = await mesurer(() => lire<EspaceDAdministration[]>('/api/admin/espaces'))
  assert.equal(espaces.length, SALONS + 1, 'les huit salons, et l’espace de l’administrateur')
  assert.equal(lecturesDesQuiz, 1, 'une seule lecture des quiz, quel que soit le nombre d’espaces')
  assert.ok(allersRetours <= 2, `les titulaires d’un aller-retour, les quiz d’un autre — ${allersRetours}`)

  const salons = espaces.filter(e => e.salon)
  assert.equal(salons.length, SALONS)
  assert.deepEqual(
    salons.map(e => [e.titulaire?.nom, e.quiz]).sort(),
    Array.from({ length: SALONS }, (_, i) => [`Joueur ${i}`, i === 0 ? 2 : 0]).sort(),
    'chaque salon, son titulaire et ses quiz',
  )
  const sien = espaces.find(e => e.toi)
  assert.ok(sien, 'l’espace de l’administrateur, marqué')
  assert.equal(sien.quiz, (await lire<unknown[]>('/api/quizzes')).length, 'ses quiz, ceux de sa bibliothèque')
})

test('« Les profils » de même : les quiz de leurs salons, d’une seule lecture', async () => {
  const { allersRetours, lecturesDesQuiz, resultat } = await mesurer(() => lire<{ total: number; profils: ProfilDAdministration[] }>('/api/admin/profils'))
  const avecSalon = resultat.profils.filter(p => p.salon)
  assert.equal(avecSalon.length, SALONS)
  assert.equal(lecturesDesQuiz, 1, 'une seule lecture des quiz, quel que soit le nombre de salons')
  assert.ok(allersRetours <= 4, `la page, les soirées, les profils et les quiz — ${allersRetours}`)
  assert.deepEqual(
    avecSalon.map(p => [p.login, p.salon?.quiz]).sort(),
    Array.from({ length: SALONS }, (_, i) => [`salon${i}`, i === 0 ? 2 : 0]).sort(),
    'chaque salon, ses quiz',
  )

  // La fiche d'un joueur dit les mêmes.
  const premier = avecSalon.find(p => p.login === 'salon0')!
  const fiche = await lire<ProfilDAdministration>(`/api/admin/profils/${premier.id}`)
  assert.equal(fiche.salon?.quiz, 2, 'sa fiche compte ses deux quiz')
})

// La vue d'ensemble relit trente jours de séries et de parties du jour à
// chaque réveil — 3 405 séries en production le 3 novembre 2026. Le client de
// Turso décode chaque ligne à coups de `defineProperty` : 54 ms d'une traite
// sur un vrai cœur, une demi-seconde de gel au banc bridé au dixième de cœur
// (`retours/2026-11-02/reproductions/gels-rejoues.ts`). Elles arrivent en un
// seul texte JSON, comme le journal des réponses : une ligne par lecture.
test('la vue d’ensemble lit trente jours de séries et de parties du jour d’une ligne chacune, et les compte toutes', async () => {
  const SERIES = 40
  const PARTIES = 12
  const H = 3_600_000
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const profils = (db.prepare('SELECT id FROM profiles ORDER BY id LIMIT 8').all() as { id: string }[]).map(p => p.id)
    const maintenant = Date.now()
    const serie = db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 3, 0, 0, ?, NULL, ?)`)
    // Des séries sur les trois dernières semaines, la plus récente il y a une heure au plus : toutes avant maintenant.
    for (let i = 0; i < SERIES; i++) serie.run(`qg-charge-${i}`, profils[i % profils.length], maintenant - (i * 13 * H) / 2 - 60_000, i % 4 === 0 ? 'duel' : 'serie')
    const partie = db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes) VALUES (?, ?, ?, 10, 6)')
    for (let i = 0; i < PARTIES; i++) {
      const quand = maintenant - i * 25 * H - 60_000
      partie.run(profils[i % profils.length], jourDe(quand), quand)
    }
  } finally {
    db.close()
  }
  // Au réveil : rien des trente jours n'est encore gardé.
  await banc.redemarrer()
  const { resultat: vue } = await mesurer(() => lire<VueDEnsemble>('/api/admin/qg'))
  for (const [table, motif] of [
    ['les séries', /\bFROM campagne_series WHERE commencee_le >= \?/],
    ['les parties du jour', /\bFROM jour_parties WHERE jour >= \?/],
  ] as const) {
    const lectures = compte.lignes.filter(l => motif.test(l.sql))
    assert.equal(lectures.length, 2, `${table} : les trente jours, puis aujourd’hui`)
    for (const l of lectures) assert.ok(l.lignes <= 1, `${table} : ${l.lignes} lignes à décoder (${l.sql.slice(0, 80)}…)`)
  }
  // Toutes comptées : chacune est une participation de son jour.
  const parties = vue.participations.reduce((n, j) => n + j.parties.campagne + j.parties.duel + j.parties.jour, 0)
  assert.equal(parties, SERIES + PARTIES)
})

// La page du Sphinx au QG compte les visites de tous : d'un lot, en comptes
// déjà faits par la base — jamais une ligne de visite par profil à décoder,
// jamais un aller-retour par énigme ou par jour. Les mots de tous, la mémoire
// du Sphinx, se lisent une fois par processus.
test('la page du Sphinx lit les visites de tous d’un seul aller-retour, en comptes, quel que soit leur nombre', async () => {
  const VISITES = 60
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const profils = (db.prepare('SELECT id FROM profiles ORDER BY id LIMIT 8').all() as { id: string }[]).map(p => p.id)
    const visite = db.prepare(`INSERT INTO profile_sphinx (profile_id, jour, enigme, divin, etat, mot, proposee_le, close_le) VALUES (?, ?, ?, 'dv:osiris', ?, ?, ?, ?)`)
    const etats = ['resolue', 'perdue', 'abandonnee', 'plus-tard', 'proposee']
    for (let i = 0; i < VISITES; i++) {
      const quand = Date.now() - (i % 25) * 86_400_000
      const etat = etats[i % etats.length]
      // Huit profils, vingt-cinq jours : jamais deux visites d'un profil le même jour.
      visite.run(profils[i % profils.length], jourDe(quand), ['32', '211', '146'][i % 3], etat, etat === 'resolue' ? i % 4 : null, quand, quand)
    }
  } finally {
    db.close()
  }
  await banc.redemarrer()
  const premiere = await mesurer(() => lire<{ jours: unknown[]; enigmes: unknown[] }>('/api/admin/sphinx'))
  assert.ok(premiere.allersRetours <= 2, `les mots de tous, une fois, puis la page d’un lot — ${premiere.allersRetours}`)
  const sphinx = compte.lignes.filter(l => /\bprofile_sphinx\b/.test(l.sql))
  // Les mots de tous en trois lectures d'un lot — leurs places, leurs trouveurs, et depuis le 26 novembre 2026 les énigmes
  // résolues de huit jours, le rythme que suit la chance du mot neuf —, puis la page en quatre.
  assert.ok(sphinx.length <= 7, `${sphinx.length} lectures`)
  // Des comptes, déjà faits : jamais les soixante visites, une à une.
  for (const l of sphinx) assert.ok(l.lignes < VISITES / 2, `${l.lignes} lignes à décoder (${l.sql.slice(0, 80)}…)`)
  const suivante = await mesurer(() => lire('/api/admin/sphinx'))
  assert.equal(suivante.allersRetours, 1, 'la page d’un seul lot')
})

// La vue d'ensemble coûtait une seconde par lecture en production — la moitié
// des 89 lectures du 15 au 23 novembre 2026 au-delà, 2,7 % du temps du serveur —
// et se recomptait à chaque retour au poste de commande, pour chaque onglet
// ouvert, pour montrer la même chose qu'une minute plus tôt. Gardée une minute,
// partagée par qui la demande pendant qu'elle se fait, oubliée au premier geste
// du QG.
test('la vue d’ensemble se garde une minute, partagée par les onglets, et un geste du QG la fait oublier', async () => {
  // Midi à Paris : la minute qui passe ne franchit aucun minuit.
  const horloge = { t: Date.UTC(2026, 10, 4, 11) }
  const gardee = await demarrer({ vueDuQgGardeeMs: VUE_GARDEE_MS, horlogeDuJour: () => horloge.t })
  try {
    const cookie = await connexionAnimateur(gardee.url)
    const vue = async () => {
      const r = await fetch(`${gardee.url}/api/admin/qg`, { headers: { Cookie: cookie } })
      assert.equal(r.status, 200)
      return (await r.json()) as VueDEnsemble
    }
    const premiere = await mesurer(vue)
    assert.ok(premiere.allersRetours > 0, 'la première se lit')
    // Rouverte dans la minute — un retour au poste, un autre onglet : rien ne se relit, la même vue.
    horloge.t += 30_000
    const encore = await mesurer(vue)
    assert.equal(encore.allersRetours, 0, 'gardée')
    assert.deepEqual(encore.resultat, premiere.resultat)

    // Un geste du QG — un bandeau posé — l'oublie : la vue suivante dit ce qui a changé.
    const geste = await ecrire(gardee.url, '/api/admin/maintenance/bandeau', { texte: 'Un essai du banc' }, cookie, 'PUT')
    assert.equal(geste.status, 200)
    const apresLeGeste = await mesurer(vue)
    assert.ok(apresLeGeste.allersRetours > 0, 'oubliée par le geste')
    assert.equal(apresLeGeste.resultat.maintenant, horloge.t)

    // La minute passée, elle se relit — une fois pour deux onglets qui la demandent ensemble.
    horloge.t += VUE_GARDEE_MS
    const seule = await mesurer(vue)
    assert.ok(seule.allersRetours > 0, 'la minute passée, relue')
    horloge.t += VUE_GARDEE_MS
    const deux = await mesurer(() => Promise.all([vue(), vue()]))
    assert.ok(deux.allersRetours > 0 && deux.allersRetours <= seule.allersRetours, `deux onglets, une lecture : ${deux.allersRetours} contre ${seule.allersRetours}`)
    assert.deepEqual(deux.resultat[0], deux.resultat[1])
  } finally {
    await gardee.close()
  }
})

// Recomptée, la vue d'ensemble prend au dixième de cœur 0,6 à 1 s de
// processeur rationné — la production relevait des gels de 0,5 à 0,8 s sous
// elle seule, du 16 au 23 novembre 2026 —, et un gel plus long que la marge
// d'une question fait recevoir « Trop tard » à une réponse partie à temps.
// L'administrateur qui anime garde le poste ouvert : pendant une question de
// soirée, la vue gardée sert au-delà de sa minute.
test('pendant une question de soirée, la vue gardée sert au-delà de sa minute — dix au plus —, sans jamais retenir la requête', async () => {
  const horloge = { t: 1_000 }
  let enJeu = false
  let calculs = 0
  const garde = new VueGardee(VUE_GARDEE_MS, () => horloge.t, () => enJeu)
  const lire = async () => (await garde.lire(async () => ({ maintenant: ++calculs }) as unknown as VueDEnsemble)).maintenant
  assert.equal(await lire(), 1)

  // Sa minute passée, une question se joue : elle sert telle quelle.
  horloge.t += VUE_GARDEE_MS + 1
  enJeu = true
  assert.equal(await lire(), 1, 'une question se joue : la vue gardée sert')
  horloge.t = 1_000 + VUE_GARDEE_PENDANT_UNE_QUESTION_MS - 1
  assert.equal(await lire(), 1)
  // Dix minutes au plus : une question laissée ouverte ne la fige pas pour la soirée.
  horloge.t = 1_000 + VUE_GARDEE_PENDANT_UNE_QUESTION_MS
  assert.equal(await lire(), 2, 'dix minutes au plus')

  // La révélation passée, sa minute reprend.
  enJeu = false
  horloge.t += VUE_GARDEE_MS
  assert.equal(await lire(), 3)
  // Un geste du QG l'oublie, même pendant une question.
  enJeu = true
  garde.oublier()
  assert.equal(await lire(), 4, 'oubliée par un geste')

  // Rien de gardé pendant une question : elle se compte tout de suite — la requête n'attend jamais la salle.
  const neuve = new VueGardee(VUE_GARDEE_MS, () => horloge.t, () => true)
  const avant = Date.now()
  assert.equal((await neuve.lire(async () => ({ maintenant: 9 }) as unknown as VueDEnsemble)).maintenant, 9)
  assert.ok(Date.now() - avant < 200, 'servie sans attendre la révélation')
  // Le banc, qui ne garde rien, ne garde rien non plus pendant une question.
  const banc0 = new VueGardee(0, () => horloge.t, () => true)
  let n = 0
  for (let i = 0; i < 2; i++) await banc0.lire(async () => ({ maintenant: ++n }) as unknown as VueDEnsemble)
  assert.equal(n, 2)
})

// La page de l'économie comptait les bonnes réponses de la campagne heure par
// heure, cherchées dans la base par leur série, une semaine de marge : sans
// statistiques, SQLite y parcourait toutes les réponses de la campagne, puis
// la série de chacune — 60 000 lignes au quota de Turso à chaque ouverture de
// la page, le cinquième de ce que la production lisait le 3 novembre 2026.
// Le journal des réponses les sait déjà : la page n'en relit que ce qui lui
// est arrivé depuis sa dernière lecture.
test('la page de l’économie ne relit pas les réponses de la campagne : elle les compte au journal des réponses', async () => {
  const H = 3_600_000
  const maintenant = Date.now()
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const profil = (db.prepare('SELECT id FROM profiles ORDER BY id LIMIT 1').get() as { id: string }).id
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES ('qg-economie', ?, '[]', 4, 0, 3, ?, ?, 'serie')`).run(
      profil,
      maintenant - 30 * H,
      maintenant - 29 * H,
    )
    // Trois bonnes réponses et une fausse, il y a un peu plus d'un jour : la page en compte trois confettis.
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
    for (let i = 0; i < 4; i++) reponse.run('qg-economie', i, `q${i}`, i < 3 ? 1 : 0, maintenant - 30 * H + i * 60_000)
  } finally {
    db.close()
  }
  // Au réveil, la première ouverture charge le journal — une fois, pour toute la campagne, par son `rowid` ; la suivante
  // n'en relit que l'arrivé. Ce qui lit les réponses d'une partie par sa clé — les réponses d'une expédition, que la vue
  // d'ensemble compte — ne parcourt rien non plus : seul un plan qui balaie la table la parcourt toute.
  await banc.redemarrer()
  for (const fois of ['au réveil', 'à l’ouverture suivante']) {
    const { resultat: page } = await mesurer(() => lire<PageDeLEconomie>('/api/admin/economie'))
    assert.equal(page.sources.campagne, 3, `${fois} : les trois bonnes réponses, un confetti chacune`)
    const lecteur = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      const parcourues = compte.instructions.filter(sql => {
        if (!/\bcampagne_reponses\b/.test(sql)) return false
        // Le plan ne dépend pas des valeurs : autant de nuls que de paramètres, `?1` compté une fois.
        const numerotes = [...sql.matchAll(/\?(\d+)/g)].map(m => Number(m[1]))
        const parametres = numerotes.length > 0 ? Math.max(...numerotes) : (sql.match(/\?/g) ?? []).length
        const plan = lecteur.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array<null>(parametres).fill(null)) as { detail: string }[]
        return plan.some(e => /^SCAN (r|campagne_reponses)\b/.test(e.detail))
      })
      assert.deepEqual(parcourues, [], `${fois} : la page parcourt toutes les réponses de la campagne`)
    } finally {
      lecteur.close()
    }
  }
})

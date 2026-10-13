// Affronter un inconnu (le choix du 10 octobre 2026, après la question « peut-
// on défier des inconnus ? ») : un adversaire tout de suite, sans liste
// d'amis ni attente — la série finie d'un autre joueur, de son niveau, dont
// on a vu le moins de questions —, rejouée contre son score. Ni classement,
// ni laurier, ni Éclat ; le record des séries ne la compte pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES, issueDeRencontre, niveauPourUneRencontre, xpDeLaBonneReponse } from '../../shared/campagne'
import { chancesAuNiveau, choisirUnAdversaire, scoreAttendu, simulerUnAdversaire, type CandidatALaRencontre } from '../src/core/campagne'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function questions(banc: Banc, serie: string): { id: string; bonne: number; reponses: string[] }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

/** Répond à la question `index`, juste ou faux ; rend la réponse du serveur. */
async function repondre(banc: Banc, cookie: string, serie: string, index: number, juste: boolean) {
  const q = questions(banc, serie)[index]
  const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index, choix: juste ? q.bonne : (q.bonne + 1) % q.reponses.length })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

/** Une série jouée jusqu'à sa dernière vie : `justes` bonnes réponses, puis trois fautes. */
async function serieFinie(banc: Banc, cookie: string, justes: number) {
  const s = (await poster(banc, cookie, '/api/campagne/serie')).corps
  for (let i = 0; i < justes; i++) await repondre(banc, cookie, s.id, i, true)
  for (let i = justes; i < justes + VIES; i++) await repondre(banc, cookie, s.id, i, false)
  return s.id as string
}

test('son niveau est la médiane de ses dernières séries ; l’adversaire, le plus proche, dont il a vu le moins de questions', () => {
  assert.equal(niveauPourUneRencontre([]), 8, 'sans série : la marche des moyennes')
  assert.equal(niveauPourUneRencontre([3, 30, 12]), 12, 'une série ratée d’entrée ou un coup de chance ne le déplacent pas')
  assert.equal(niveauPourUneRencontre([10, 14]), 12)
  assert.deepEqual([issueDeRencontre(11, 9), issueDeRencontre(9, 9), issueDeRencontre(8, 9)], ['gagnee', 'egalite', 'perdue'])

  const candidat = (serie: string, justes: number, dejaVues = 0): CandidatALaRencontre => ({ serie, profil: `p-${serie}`, justes, finieLe: 1, dejaVues })
  const hasard = () => 0.5
  // De son niveau d'abord : à un point près, c'est pareil.
  assert.equal(choisirUnAdversaire([candidat('loin', 25), candidat('proche', 13)], 12, hasard)?.serie, 'proche')
  assert.equal(choisirUnAdversaire([candidat('loin', 25), candidat('proche', 13, 9)], 12, hasard)?.serie, 'proche', 'même s’il en a vu, l’écart d’abord')
  // À niveau égal, celui dont il a vu le moins de questions.
  assert.equal(choisirUnAdversaire([candidat('vu', 12, 4), candidat('neuf', 13, 0)], 12, hasard)?.serie, 'neuf')
  assert.equal(choisirUnAdversaire([], 12, hasard), null)
})

/** Un hasard qui se rejoue : le même tirage à chaque passage, pour qu'une moyenne se vérifie sans trembler. */
function hasardFixe(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Le souhait du propriétaire du 13 octobre 2026 : le dé « tout le temps
// disponible ». Quand il a affronté toutes les séries des autres, c'est
// Automate : une série neuve, ses réponses tirées de la difficulté mesurée de
// chaque question, réglées pour que son score soit, en moyenne, son niveau.
test('Automate joue comme un joueur de son niveau : ses fautes sur les questions difficiles, sa série finie à la troisième', () => {
  // Une série qui monte : des faciles, des moyennes, des difficiles, puis des expertes.
  const taux = [...Array(5).fill(0.9), ...Array(5).fill(0.75), ...Array(5).fill(0.45), ...Array(45).fill(0.15)]
  for (const niveau of [4, 8, 12, 16]) {
    // En moyenne, son niveau : la cote de ce score est la force qu'on attend en face.
    assert.ok(Math.abs(scoreAttendu(chancesAuNiveau(taux, niveau)) - niveau) < 0.05, `niveau ${niveau}`)
    const hasard = hasardFixe(niveau)
    const series = Array.from({ length: 400 }, () => simulerUnAdversaire(taux, niveau, hasard))
    const moyenne = series.reduce((s, r) => s + r.filter(Boolean).length, 0) / series.length
    assert.ok(Math.abs(moyenne - niveau) < 0.8, `niveau ${niveau} : ${moyenne} en moyenne`)
    // Chaque série finit à sa troisième faute — comme celle d'un joueur allé au bout de ses vies —, ou au bout de ses questions.
    for (const r of series) {
      const fautes = r.filter(x => !x).length
      assert.ok(fautes === VIES ? r.at(-1) === false : fautes < VIES && r.length === taux.length, JSON.stringify(r))
    }
    // Pas toujours le même score : c'est un joueur, pas une constante.
    assert.ok(new Set(series.map(r => r.filter(Boolean).length)).size > 3)
  }
  // Ses fautes tombent sur les questions difficiles, pas au hasard.
  const hasard = hasardFixe(42)
  const posees = Array(taux.length).fill(0)
  const ratees = Array(taux.length).fill(0)
  for (let n = 0; n < 2000; n++) {
    simulerUnAdversaire(taux, 12, hasard).forEach((juste, i) => {
      posees[i]++
      if (!juste) ratees[i]++
    })
  }
  const partRatee = (de: number, a: number) => ratees.slice(de, a).reduce((s, x) => s + x, 0) / posees.slice(de, a).reduce((s, x) => s + x, 0)
  assert.ok(partRatee(0, 5) < partRatee(5, 10) && partRatee(5, 10) < partRatee(10, 15), 'les faciles, puis les moyennes, puis les difficiles')
})

test('une rencontre rejoue la série finie d’un autre, contre son score — ce qu’il avait fait de chaque question, après la sienne', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    // Personne n'a fini de série : Zoé affronte Automate, l'adversaire simulé — le dé ne mène plus à
    // « personne à affronter » (le souhait du propriétaire du 13 octobre 2026 : « tout le temps disponible »).
    const seule = await poster(banc, zoe, '/api/campagne/rencontre')
    assert.equal(seule.status, 200, seule.corps.error)
    assert.deepEqual(seule.corps.adversaire, { nom: 'Automate', avatar: '🤖', simule: true }, 'dit simulé, et sans son score')
    assert.ok(seule.corps.enjeu, 'ce qui se joue sur sa cote, comme contre un joueur')
    // Une série neuve, tirée pour elle : ses réponses à lui gardées au départ, comme celles d'un joueur.
    const garde = (() => {
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
      try {
        return JSON.parse((db.prepare('SELECT adversaire FROM campagne_series WHERE id = ?').get(seule.corps.serie.id) as { adversaire: string }).adversaire)
      } finally {
        db.close()
      }
    })()
    assert.deepEqual([garde.simule, garde.profil, garde.serie], [true, '', seule.corps.serie.id])
    assert.ok(garde.reponses.filter((x: boolean) => !x).length <= VIES)
    // Trois fautes : elle finit, et compte comme un duel — la cote de son score, comme celle d'un joueur.
    let derniere: any = null
    for (let i = 0; i < VIES; i++) derniere = await repondre(banc, zoe, seule.corps.serie.id, i, false)
    assert.equal(derniere.finie, true)
    assert.equal(derniere.rencontre.enTout, garde.reponses.filter(Boolean).length, 'son score entier, enfin')
    const pourZoe = (await lire(banc, zoe, '/api/duels')).corps
    assert.equal(pourZoe.joues, 1)
    assert.equal('auHasard' in pourZoe, false, 'le dé est toujours là : plus rien à demander')
    assert.deepEqual(pourZoe.dernieres[0].adversaire, { nom: 'Automate', avatar: '🤖', simule: true, justes: garde.reponses.filter(Boolean).length })
    // Ni parmi les joueurs croisés : il n'a pas de carte.
    assert.deepEqual((await lire(banc, zoe, '/api/duels/croises')).corps, [])

    // Zoé abandonne la sienne : une série laissée avant sa dernière vie ne dit pas son niveau, elle ne sert pas.
    const laissee = (await poster(banc, zoe, '/api/campagne/serie')).corps
    await repondre(banc, zoe, laissee.id, 0, true)
    assert.equal((await poster(banc, zoe, `/api/campagne/serie/${laissee.id}/abandon`)).status, 200)
    // Tom va au bout de ses vies : six bonnes réponses, puis trois fautes.
    const sienne = await serieFinie(banc, tom, 6)
    horloge.t += 60_000

    const r = await poster(banc, lea, '/api/campagne/rencontre')
    assert.equal(r.status, 200, r.corps.error)
    // Qui l'on affronte, sans son score : « à battre : 6 » se lisait avant même la première question
    // (le souhait du propriétaire du 12 octobre 2026). Il se dit à la dernière réponse.
    assert.deepEqual(r.corps.adversaire, { nom: 'Tom', avatar: '🐻' })
    assert.equal(r.corps.serie.vies, VIES)
    const id = r.corps.serie.id as string
    assert.deepEqual(
      questions(banc, id).map(q => q.id),
      questions(banc, sienne).map(q => q.id),
      'ses questions, dans le même ordre',
    )
    assert.equal(r.corps.serie.question.bonne, undefined, 'jamais la bonne réponse avant la sienne (invariant 1)')

    // Ce que Tom avait fait de chaque question se dit après sa réponse à elle.
    const r0 = await repondre(banc, lea, id, 0, true)
    assert.deepEqual(r0.rencontre, { lui: true, toi: 1, sesJustes: 1 })
    assert.equal(r0.xp, xpDeLaBonneReponse(1), 'une bonne réponse paie comme en série')
    // Laissée en route, elle se reprend — et ne s'abandonne pas.
    const reprise = (await poster(banc, lea, '/api/campagne/rencontre')).corps
    assert.deepEqual([reprise.serie.id, reprise.serie.question.index, reprise.adversaire.nom, reprise.sesJustes], [id, 1, 'Tom', 1], 'et le score d’en face jusque-là')
    assert.equal(reprise.adversaire.justes, undefined, 'jusque-là seulement : son score entier attend la fin')
    assert.equal((await lire(banc, lea, '/api/duels')).corps.enCours.adversaire.justes, undefined, 'sur la page des duels non plus')
    // Et ce qu'il porte : Tom prend le blaireau de la forêt — la partie et la page des duels le montrent, pas
    // l'emoji d'en dessous (le retour du propriétaire du 13 octobre 2026 : « un emoji et non mon avatar légendaire »).
    const deTom = (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)').run(deTom, 'foret', 5, horloge.t)
    db.close()
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'br:blaireau' }, tom, 'PUT')).status, 200)
    assert.equal((await poster(banc, lea, '/api/campagne/rencontre')).corps.adversaire.legendaire, 'br:blaireau')
    assert.equal((await lire(banc, lea, '/api/duels')).corps.enCours.adversaire.legendaire, 'br:blaireau')
    const abandon = await poster(banc, lea, `/api/campagne/serie/${id}/abandon`)
    assert.equal(abandon.status, 400)
    assert.equal(abandon.corps.error, 'Une rencontre se joue jusqu’au bout : elle ne s’abandonne pas')
    for (let i = 1; i < 6; i++) await repondre(banc, lea, id, i, true)
    // Six partout, une faute chacun à la septième : rien n'est joué, la rencontre continue.
    const r6 = await repondre(banc, lea, id, 6, false)
    assert.deepEqual(r6.rencontre, { lui: false, toi: 6, sesJustes: 6 })
    assert.equal(r6.finie, false)
    // La bonne réponse qui dépasse son score la gagne, et la finit là : il n'y a
    // plus rien à jouer — elle allait jusqu'à la troisième erreur, sous « −36 si
    // tu perds » (l'experte du jeu solo, le 11 octobre 2026).
    const fin = await repondre(banc, lea, id, 7, true)
    assert.equal(fin.finie, true)
    // Finie, son score entier, enfin : la carte du verdict le retourne.
    assert.deepEqual(fin.rencontre, { lui: false, toi: 7, sesJustes: 6, issue: 'gagnee', enTout: 6 })
    assert.equal(fin.suivante, undefined)
    const apres = await poster(banc, lea, `/api/campagne/serie/${id}/reponse`, { index: 8, choix: 0 })
    assert.equal(apres.corps.error, 'Cette rencontre est finie : cherche un autre adversaire')
    assert.equal(fin.recordAvant, undefined, 'le record des séries ne la compte pas')
    assert.deepEqual([(await lire(banc, lea, '/api/campagne')).corps.record, (await lire(banc, lea, '/api/campagne')).corps.series], [0, 0])
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${id}/correction`)).status, 200, 'sa correction ne souffle rien : la série de Tom est finie')

    // Ses rencontres : celle-ci, gagnée.
    const miennes = (await lire(banc, lea, '/api/campagne/rencontres')).corps
    assert.equal(miennes.enCours, null)
    assert.deepEqual(
      miennes.passees.map((x: any) => [x.adversaire.nom, x.adversaire.justes, x.justes, x.issue]),
      [['Tom', 6, 7, 'gagnee']],
    )
    assert.equal(miennes.passees[0].adversaire.legendaire, 'br:blaireau', 'son historique le montre aussi')
    // Jamais deux fois la même série : Tom n'en a pas d'autre — c'est Automate, sur une série neuve.
    const encore = (await poster(banc, lea, '/api/campagne/rencontre')).corps
    assert.equal(encore.adversaire.nom, 'Automate')
    assert.notDeepEqual(
      questions(banc, encore.serie.id).map(q => q.id),
      questions(banc, sienne).map(q => q.id),
      'pas la série de Tom une seconde fois',
    )
    for (let i = 0; i < VIES; i++) await repondre(banc, lea, encore.serie.id, i, false)

    // Masqué au quiz du jour, Tom ne s'affronte plus — sa nouvelle série non plus —, et ne se nomme plus.
    await serieFinie(banc, tom, 4)
    const admin = await connexionAnimateur(banc.url)
    const idTom = (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idTom, masque: true })).status, 200)
    assert.equal((await poster(banc, lea, '/api/campagne/rencontre')).corps.adversaire.nom, 'Automate', 'ni sa nouvelle série : Automate, encore')
    assert.deepEqual(
      (await lire(banc, lea, '/api/campagne/rencontres')).corps.passees.find((x: any) => !x.adversaire.simule).adversaire,
      { nom: 'Un joueur', avatar: '🎲', justes: 6 },
    )
  } finally {
    await banc.close()
  }
})

// Le dé, le duel au hasard (le choix du 10 octobre 2026, après la question
// « peut-on défier des inconnus ? ») : un adversaire tout de suite, sans
// liste d'amis ni attente. Il rejouait la série finie d'un autre joueur, sous
// son prénom et son avatar ; depuis le 13 octobre 2026, c'est toujours
// Automate, l'adversaire simulé de son niveau — « à chaque fois ça me montre
// le profil d'un ami, mais c'est sûr que c'est un automate : c'est trompeur »
// (le propriétaire). Ni classement, ni laurier, ni Éclat ; le record des
// séries ne la compte pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { NIVEAUX, VIES, issueDeRencontre, xpDeLaBonneReponse, type Niveau } from '../../shared/campagne'
import { SCORE_DE_REFERENCE } from '../../shared/duels'
import { CampagneStore, ECART_D_AUTOMATE, jouerSesChances, partieDAutomate } from '../src/core/campagne'
import { AUCUN_ECART, chancesDeReference, forcePourLeNiveau, scoreAttendu, serieDeReference } from '../src/core/modeleDuSavoir'
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

/** Ce que la rencontre garde de son adversaire, lu dans la base. */
function adversaireGarde(banc: Banc, serie: string): { serie: string; profil: string; reponses: boolean[]; simule?: true } {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare('SELECT adversaire FROM campagne_series WHERE id = ?').get(serie) as { adversaire: string }).adversaire)
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

// Son niveau ne se lit plus à la médiane de ses dix dernières séries, mais
// dans toutes ses réponses (le modèle du savoir) : `modele-du-savoir.test.ts`
// en vérifie la règle — sans réponse, le score de référence ; ni une série
// ratée d'entrée ni un coup de chance ne le déplacent beaucoup.
test('l’issue se lit contre le score entier d’en face', () => {
  assert.deepEqual([issueDeRencontre(11, 9), issueDeRencontre(9, 9), issueDeRencontre(8, 9)], ['gagnee', 'egalite', 'perdue'])
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

/**
 * Une série qui monte : des faciles que 90 % des joueurs trouvent, des
 * moyennes 75 %, des difficiles 45 %, puis des expertes 15 % — cinq de
 * chaque, puis les expertes (`serieDeReference`, à la place de chacune des
 * douze catégories). À la force nulle, ses chances sont ces parts.
 */
const SERIE_QUI_MONTE = (() => {
  const parts: Record<Niveau, number> = { facile: 0.9, moyen: 0.75, difficile: 0.45, expert: 0.15 }
  const questions = NIVEAUX.flatMap(niveau =>
    CATEGORIES.flatMap(categorie => Array.from({ length: 5 }, () => ({ niveau, meta: { categorie }, difficulte: -Math.log(parts[niveau] / (1 - parts[niveau])) }))),
  )
  return serieDeReference(questions, q => q.niveau, q => q.difficulte)
})()

/** Les chances d'Automate à ce niveau sur la série qui monte, sans écart de catégorie : toutes décalées du même pas. */
const chancesAuNiveau = (niveau: number): number[] =>
  chancesDeReference(forcePourLeNiveau(niveau, AUCUN_ECART, SERIE_QUI_MONTE), AUCUN_ECART, SERIE_QUI_MONTE)

// Automate, l'adversaire du dé : une série neuve, ses réponses tirées de la
// difficulté de chaque question, réglées pour que son score soit, en
// moyenne, le niveau de qui le joue.
test('Automate joue comme un joueur de son niveau : ses fautes sur les questions difficiles, sa série finie à la troisième', () => {
  // À la force nulle, ses chances sont les parts de la série : cinq de chaque marche, puis les expertes.
  const taux = chancesDeReference(0, AUCUN_ECART, SERIE_QUI_MONTE)
  assert.deepEqual(
    taux.map(x => Math.round(x * 100)),
    [...Array(5).fill(90), ...Array(5).fill(75), ...Array(5).fill(45), ...Array(45).fill(15)],
  )
  for (const niveau of [4, 8, 12, 16]) {
    // En moyenne, son niveau : la cote de ce score est la force qu'on attend en face.
    const chances = chancesAuNiveau(niveau)
    assert.ok(Math.abs(scoreAttendu(chances) - niveau) < 0.05, `niveau ${niveau}`)
    const hasard = hasardFixe(niveau)
    const series = Array.from({ length: 400 }, () => jouerSesChances(chances, hasard))
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
  const douze = chancesAuNiveau(12)
  for (let n = 0; n < 2000; n++) {
    jouerSesChances(douze, hasard).forEach((juste, i) => {
      posees[i]++
      if (!juste) ratees[i]++
    })
  }
  const partRatee = (de: number, a: number) => ratees.slice(de, a).reduce((s, x) => s + x, 0) / posees.slice(de, a).reduce((s, x) => s + x, 0)
  assert.ok(partRatee(0, 5) < partRatee(5, 10) && partRatee(5, 10) < partRatee(10, 15), 'les faciles, puis les moyennes, puis les difficiles')
})

// Le choix du propriétaire du 13 octobre 2026, après « parfois la différence
// était énorme » : libre, son score s'écartait de son niveau de quatre ou plus
// un duel sur cinq. Il s'y tient à deux bonnes réponses près de ce qu'on
// attend de lui sur la série — ici, une série moyenne : son niveau.
test('Automate se tient à deux bonnes réponses de son niveau au plus — sans changer sa façon de jouer', () => {
  assert.equal(ECART_D_AUTOMATE, 2, 'un choix de produit')
  const taux = chancesDeReference(0, AUCUN_ECART, SERIE_QUI_MONTE)
  const justes = (r: boolean[]) => r.filter(Boolean).length
  for (const niveau of [4, 8, 9.5, 12, 16]) {
    const hasard = hasardFixe(Math.round(niveau * 10))
    const chances = chancesAuNiveau(niveau)
    const libres = Array.from({ length: 400 }, () => justes(jouerSesChances(chances, hasard)))
    assert.ok(libres.some(s => Math.abs(s - niveau) > ECART_D_AUTOMATE + 1), `libre, il s’écarte bien plus (niveau ${niveau})`)
    const tenus = Array.from({ length: 400 }, () => justes(partieDAutomate(chances, niveau, hasard)))
    assert.ok(
      tenus.every(s => Math.abs(s - niveau) <= ECART_D_AUTOMATE),
      `niveau ${niveau} : de ${Math.min(...tenus)} à ${Math.max(...tenus)}`,
    )
    assert.ok(new Set(tenus).size >= 3, 'pas toujours le même score : un peu de surprise')
    // Toujours de son niveau en moyenne.
    assert.ok(Math.abs(tenus.reduce((s, x) => s + x, 0) / tenus.length - niveau) < 0.8, `niveau ${niveau}`)
  }
  // Ses fautes tombent toujours sur les questions difficiles d'abord.
  const hasard = hasardFixe(7)
  const posees = Array(taux.length).fill(0)
  const ratees = Array(taux.length).fill(0)
  const douze = chancesAuNiveau(12)
  for (let n = 0; n < 2000; n++) {
    partieDAutomate(douze, 12, hasard).forEach((juste, i) => {
      posees[i]++
      if (!juste) ratees[i]++
    })
  }
  const partRatee = (de: number, a: number) => ratees.slice(de, a).reduce((s, x) => s + x, 0) / posees.slice(de, a).reduce((s, x) => s + x, 0)
  assert.ok(partRatee(0, 5) < partRatee(5, 10) && partRatee(5, 10) < partRatee(10, 15), 'les faciles, puis les moyennes, puis les difficiles')
  // Et c'est lui que le dé affronte : la partie que le serveur tire d'office.
  const huit = chancesAuNiveau(8)
  for (let n = 0; n < 200; n++) assert.ok(Math.abs(justes(CampagneStore.reponsesDAutomate({ chances: huit, cible: 8, niveau: 8 })) - 8) <= ECART_D_AUTOMATE)
})

test('le dé ne joue que contre Automate, même quand un ami a fini une série : jamais son profil — et le duel se joue comme contre un joueur', async () => {
  // Les réponses d'Automate, fixées : six bonnes, puis trois fautes. Le niveau qu'on lui demande, retenu.
  const avant = CampagneStore.reponsesDAutomate
  const niveaux: number[] = []
  CampagneStore.reponsesDAutomate = ({ niveau }) => (niveaux.push(niveau), [...Array(6).fill(true), ...Array(VIES).fill(false)])
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    // Personne n'a fini de série : Zoé affronte Automate, sur une série neuve tirée pour elle.
    const seule = await poster(banc, zoe, '/api/campagne/rencontre')
    assert.equal(seule.status, 200, seule.corps.error)
    assert.deepEqual(seule.corps.adversaire, { nom: 'Automate', avatar: '🤖', simule: true }, 'dit simulé, et sans son score')
    assert.ok(seule.corps.enjeu, 'ce qui se joue sur sa cote, comme contre un joueur')
    assert.equal(niveaux.at(-1), SCORE_DE_REFERENCE, 'sans série ni duel : le niveau de la cote de départ')
    const garde = adversaireGarde(banc, seule.corps.serie.id)
    assert.deepEqual([garde.simule, garde.profil, garde.serie], [true, '', seule.corps.serie.id])
    assert.deepEqual(garde.reponses, [...Array(6).fill(true), ...Array(VIES).fill(false)], 'ses réponses, gardées au départ comme celles d’un joueur')
    // Trois fautes : elle finit, et compte comme un duel — la cote de son score, comme celle d'un joueur.
    let derniere: any = null
    for (let i = 0; i < VIES; i++) derniere = await repondre(banc, zoe, seule.corps.serie.id, i, false)
    assert.equal(derniere.finie, true)
    assert.equal(derniere.rencontre.enTout, 6, 'son score entier, enfin')
    const pourZoe = (await lire(banc, zoe, '/api/duels')).corps
    assert.equal(pourZoe.joues, 1)
    assert.equal('auHasard' in pourZoe, false, 'le dé est toujours là : plus rien à demander')
    assert.deepEqual(pourZoe.dernieres[0].adversaire, { nom: 'Automate', avatar: '🤖', simule: true, justes: 6 })
    // Ni parmi les joueurs croisés : il n'a pas de carte.
    assert.deepEqual((await lire(banc, zoe, '/api/duels/croises')).corps, [])

    // Tom — un ami, sur un serveur de quelques amis — va au bout de ses vies : six bonnes réponses, puis trois
    // fautes. Sa série finie était celle que le dé rejouait, sous son prénom et son avatar.
    const sienne = await serieFinie(banc, tom, 6)
    // Léa, elle, en a fini une de douze : Automate jouera à son niveau.
    await serieFinie(banc, lea, 12)
    const recordAvant = (await lire(banc, lea, '/api/campagne')).corps.record
    horloge.t += 60_000

    // Le dé : Automate encore — jamais Tom, sa série finie ne se rejoue plus sous son profil.
    const r = await poster(banc, lea, '/api/campagne/rencontre')
    assert.equal(r.status, 200, r.corps.error)
    assert.deepEqual(r.corps.adversaire, { nom: 'Automate', avatar: '🤖', simule: true })
    // De son niveau, avant son placement : ce que ses réponses disent d'elle,
    // prudemment — une série à douze ne fait pas une experte (le modèle du
    // savoir, plutôt que la médiane de ses séries d'avant le 13 octobre 2026).
    const sonNiveau = niveaux.at(-1)!
    assert.ok(sonNiveau > 9 && sonNiveau < 12, `de son niveau : ${sonNiveau}`)
    assert.equal(r.corps.serie.vies, VIES)
    const id = r.corps.serie.id as string
    assert.notDeepEqual(
      questions(banc, id).map(q => q.id),
      questions(banc, sienne).map(q => q.id),
      'une série neuve, pas celle de Tom',
    )
    assert.equal(adversaireGarde(banc, id).profil, '', 'ni le profil de personne')
    assert.equal(r.corps.serie.question.bonne, undefined, 'jamais la bonne réponse avant la sienne (invariant 1)')

    // Ce qu'Automate avait fait de chaque question se dit après sa réponse à elle.
    const r0 = await repondre(banc, lea, id, 0, true)
    assert.deepEqual(r0.rencontre, { lui: true, toi: 1, sesJustes: 1 })
    assert.equal(r0.xp, xpDeLaBonneReponse(1), 'une bonne réponse paie comme en série')
    // Laissée en route, elle se reprend — et ne s'abandonne pas.
    const reprise = (await poster(banc, lea, '/api/campagne/rencontre')).corps
    assert.deepEqual([reprise.serie.id, reprise.serie.question.index, reprise.adversaire.nom, reprise.sesJustes], [id, 1, 'Automate', 1], 'et le score d’en face jusque-là')
    assert.equal(reprise.adversaire.justes, undefined, 'jusque-là seulement : son score entier attend la fin')
    assert.equal((await lire(banc, lea, '/api/duels')).corps.enCours.adversaire.justes, undefined, 'sur la page des duels non plus')
    assert.equal(niveaux.length, 2, 'reprise, elle ne tire rien de neuf')
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
    assert.equal(apres.corps.error, 'Ce duel est fini : relance le dé pour en jouer un autre')
    assert.equal(fin.recordAvant, undefined, 'le record des séries ne la compte pas')
    assert.deepEqual([(await lire(banc, lea, '/api/campagne')).corps.record, (await lire(banc, lea, '/api/campagne')).corps.series], [recordAvant, 1])
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${id}/correction`)).status, 200, 'sa correction ne souffle rien : Automate a fini la sienne')
    const miennes = (await lire(banc, lea, '/api/campagne/rencontres')).corps
    assert.equal(miennes.enCours, null)
    assert.deepEqual(
      miennes.passees.map((x: any) => [x.adversaire.nom, x.adversaire.justes, x.justes, x.issue]),
      [['Automate', 6, 7, 'gagnee']],
    )
  } finally {
    CampagneStore.reponsesDAutomate = avant
    await banc.close()
  }
})

// Les rencontres d'avant le 13 octobre 2026 rejouaient la série d'un joueur :
// gardées telles quelles, elles le montrent encore — ce qu'il porte, puis
// « Un joueur » une fois masqué.
test('une rencontre d’avant, contre la série d’un joueur, le montre encore — et ne le nomme plus, masqué', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [idLea, idTom] = [(await lire(banc, lea, '/api/joueur/moi')).corps.profile.id, (await lire(banc, tom, '/api/joueur/moi')).corps.profile.id]
    // Tom prend le blaireau de la forêt : sa rencontre le montre, pas l'emoji d'en dessous.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)').run(idTom, 'foret', 5, DEBUT)
    const adversaire = { serie: randomUUID(), profil: idTom, reponses: [...Array(6).fill(true), ...Array(VIES).fill(false)] }
    db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
       VALUES (?, ?, '[]', 10, 0, 7, ?, ?, 'rencontre', ?)`,
    ).run(randomUUID(), idLea, DEBUT - 3_600_000, DEBUT - 3_000_000, JSON.stringify(adversaire))
    db.close()
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'br:blaireau' }, tom, 'PUT')).status, 200)
    const passee = (await lire(banc, lea, '/api/campagne/rencontres')).corps.passees[0]
    assert.deepEqual([passee.adversaire.nom, passee.adversaire.justes, passee.justes, passee.issue], ['Tom', 6, 7, 'gagnee'])
    assert.equal(passee.adversaire.legendaire, 'br:blaireau')
    // Masqué au quiz du jour, il ne se nomme plus.
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idTom, masque: true })).status, 200)
    assert.deepEqual((await lire(banc, lea, '/api/campagne/rencontres')).corps.passees[0].adversaire, { nom: 'Un joueur', avatar: '🎲', justes: 6 })
  } finally {
    await banc.close()
  }
})

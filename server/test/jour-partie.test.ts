// Le quiz du jour, joué de bout en bout sur un serveur jetable : la réserve
// amorcée par les quiz livrés, le tirage figé, la partie chronométrée au
// serveur, le classement de tout le serveur, et la nuit qui clôt la journée
// — son podium, son expérience. L'horloge du quiz du jour est celle du test :
// il la fait passer minuit.
//
// Les règles pures (le jour de Paris, la médaille, la série) sont dans
// `jour.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'
const LENDEMAIN = '2026-09-27'

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Le tirage du jour, lu en base : les bonnes réponses que le téléphone ne voit jamais. */
function tirage(banc: Banc, jour = JOUR): { bonne: number; reponses: string[]; anecdote: string | null; texte: string }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  } finally {
    db.close()
  }
}

/** Joue toute la partie : `juste(i)` dit s'il trouve la question i, chaque réponse `delai` ms après l'affichage. */
async function jouer(banc: Banc, horloge: Horloge, cookie: string, juste: (i: number) => boolean, delai = 0) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc, etat.jour)
  const revelations = []
  while (etat.question) {
    const i = etat.question.index
    horloge.t += delai
    const bonne = questions[i].bonne
    const choix = juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    revelations.push(r.corps)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return { etat, revelations }
}

test('le quiz du jour est aux profils : un invité anonyme n’y lit qu’une invitation', () =>
  avecBanc(async banc => {
    const res = await fetch(`${banc.url}/api/jour`)
    assert.equal(res.status, 401)
    assert.match(((await res.json()) as any).error, /profil/)
  }))

test('dix questions, les mêmes pour tous, figées ; ni bonne réponse ni anecdote avant d’avoir répondu', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // La réserve s'est amorcée des quiz livrés qui se jouent seuls.
    const avant = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(avant.etat, 'a-jouer')
    assert.equal(avant.total, 10)
    assert.equal(avant.jour, JOUR)
    assert.equal(avant.pointsPossibles, 2000)

    const partie = (await poster(banc, alice, '/api/jour/commencer')).corps
    assert.equal(partie.etat, 'en-cours')
    const q = partie.question
    assert.equal(q.index, 0)
    assert.equal(q.echeance, DEBUT + q.duree * 1000, 'l’échéance est une heure du serveur')
    // Invariant 1 : rien qui trahisse la réponse.
    assert.equal(JSON.stringify(partie).includes('"bonne"'), false)
    assert.equal(JSON.stringify(partie).includes('anecdote'), false)

    // Bob a la même question, les réponses dans le même ordre.
    const deBob = (await poster(banc, bob, '/api/jour/commencer')).corps.question
    assert.deepEqual([deBob.texte, deBob.reponses], [q.texte, q.reponses])

    // Répondre révèle : la bonne réponse, les points, la suite à demander.
    const bonne = tirage(banc)[0].bonne
    horloge.t += 500
    const r = (await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 0, choix: bonne })).corps
    assert.equal(r.juste, true)
    assert.equal(r.bonne, bonne)
    assert.equal(r.points, 200, 'pendant le temps de lecture, le maximum')
    assert.equal(r.cumul, 200)
    assert.equal(r.trouveePar, null, 'à deux, « trouvée par » ne dit rien')
    // Touchée deux fois : rendue telle quelle, payée une fois.
    const encore = (await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 0, choix: (bonne + 1) % 2 })).corps
    assert.equal(encore.points, 200)
    assert.equal(encore.cumul, 200)
    // La suivante ne se montre qu'à la demande — l'anecdote se lit sans chrono.
    const entre = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(entre.question, undefined)
    assert.equal(entre.revelation?.index, 0)
    assert.equal((await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 1, choix: 0 })).status, 400, 'pas encore posée')
  }))

test('le chrono est celui du serveur : trop tard ne paie rien, et un téléphone qui a sonné retrouve la question révélée', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const q = (await poster(banc, alice, '/api/jour/commencer')).corps.question
    const questions = tirage(banc)
    // Après l'échéance et la marge du réseau : la réponse ne compte pas.
    horloge.t += q.duree * 1000 + 2000
    const tard = (await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 0, choix: questions[0].bonne })).corps
    assert.equal(tard.tropTard, true)
    assert.equal(tard.points, 0)
    assert.equal(tard.juste, false)

    // La deuxième, montrée… puis le téléphone sonne. Au retour, elle est
    // passée : révélée, sans réponse — et la troisième attend son geste.
    const q2 = (await poster(banc, alice, '/api/jour/suivante')).corps.question
    assert.equal(q2.index, 1)
    horloge.t += 5 * 60_000
    const retour = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(retour.question, undefined)
    assert.equal(retour.revelation.index, 1)
    assert.equal(retour.revelation.choix, null)
    assert.equal(retour.revelation.bonne, questions[1].bonne)
    // Recharger ne rejoue rien : la suivante, demandée deux fois, garde son échéance.
    const q3 = (await poster(banc, alice, '/api/jour/suivante')).corps.question
    horloge.t += 3000
    const q3bis = (await poster(banc, alice, '/api/jour/suivante')).corps.question
    assert.equal(q3bis.index, 2)
    assert.equal(q3bis.echeance, q3.echeance)
  }))

test('une partie parfaite : l’or, 75 XP, la correction — et le classement de tout le serveur', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    // Avant d'avoir fini, pas de correction : elle donnerait le quiz.
    assert.equal((await lire(banc, alice, `/api/jour/correction/${JOUR}`)).status, 404)

    const { etat, revelations } = await jouer(banc, horloge, alice, () => true)
    assert.equal(etat.etat, 'finie')
    assert.equal(etat.points, 2000)
    assert.equal(etat.justes, 10)
    assert.equal(etat.medaille, 'or')
    assert.equal(etat.xp, 75, 'le barème d’un quiz de soirée de dix questions parfait')
    assert.equal(revelations.at(-1).derniere, true)
    // Son profil l'a reçue — sans une soirée de plus dans son historique.
    const moi = ((await lire(banc, alice, '/api/joueur/moi')).corps as any).profile
    assert.equal(moi.xp, 75)
    assert.deepEqual(moi.soirees, [], 'le quiz du jour n’est pas une soirée')

    // Bob en trouve six, moins vite.
    const bob6 = await jouer(banc, horloge, bob, i => i < 6, 3000)
    assert.equal(bob6.etat.medaille, 'bronze')
    assert.ok(bob6.etat.points <= 1200 && bob6.etat.points >= 600)
    assert.equal(bob6.etat.rang, 2)
    assert.equal(bob6.etat.joueurs, 2)
    assert.deepEqual(bob6.etat.devant, { nom: 'Alice', ecart: 2000 - bob6.etat.points })

    const classement = (await lire(banc, bob, '/api/jour/classement')).corps
    assert.deepEqual(
      classement.lignes.map((l: any) => [l.nom, l.rang, l.points]),
      [
        ['Alice', 1, 2000],
        ['Bob', 2, bob6.etat.points],
      ],
    )
    assert.equal(classement.fige, false, 'il se fige à minuit')

    const correction = (await lire(banc, alice, `/api/jour/correction/${JOUR}`)).corps
    assert.equal(correction.questions.length, 10)
    assert.ok(correction.questions.every((q: any) => q.juste && q.repondue))
  }))

test('minuit clôt la journée : le podium est payé une fois, le lendemain le raconte, la série continue', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await jouer(banc, horloge, alice, () => true)
    // Bob s'arrête en route : cinq réponses, et la sixième question à l'écran quand minuit sonne.
    await poster(banc, bob, '/api/jour/commencer')
    const questions = tirage(banc)
    for (let i = 0; i < 5; i++) {
      await poster(banc, bob, '/api/jour/repondre', { jour: JOUR, index: i, choix: questions[i].bonne })
      await poster(banc, bob, '/api/jour/suivante')
    }
    const xpAvant = ((await lire(banc, alice, '/api/joueur/moi')).corps as any).profile.xp

    // Le lendemain, 8 h à Paris : la première demande clôt la veille.
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const matin = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(matin.jour, LENDEMAIN)
    assert.equal(matin.etat, 'a-jouer')
    assert.deepEqual(matin.vainqueursDHier, [{ nom: 'Alice', avatar: '🦊' }])
    assert.equal(matin.sonHier.rang, 1)
    assert.equal(matin.sonHier.xpPodium, 25, 'à deux, seul le premier monte sur le podium')
    assert.equal(matin.sonHier.medaille, 'or')
    assert.equal(matin.serie, 1, 'hier compte, aujourd’hui pas encore joué')
    const apres = ((await lire(banc, alice, '/api/joueur/moi')).corps as any).profile.xp
    assert.equal(apres, xpAvant + 25)
    const deBob = (await lire(banc, bob, '/api/jour')).corps
    assert.equal(deBob.sonHier.xpPodium, 0)

    // Une seconde demande ne paie pas deux fois.
    await lire(banc, bob, '/api/jour')
    assert.equal(((await lire(banc, alice, '/api/joueur/moi')).corps as any).profile.xp, xpAvant + 25)

    // Le classement d'hier est figé, et sa correction ouverte à tous.
    const hier = (await lire(banc, bob, `/api/jour/classement?jour=${JOUR}`)).corps
    assert.equal(hier.fige, true)
    const carol = await inscrireProfil(banc.url, 'carol', 'Carol', '🐙')
    assert.equal((await lire(banc, carol, `/api/jour/correction/${JOUR}`)).status, 200)

    // Un nouveau tirage, d'autres questions ; et la série passe à deux.
    const nouveau = (await poster(banc, alice, '/api/jour/commencer')).corps
    assert.notEqual(nouveau.question.texte, tirage(banc, JOUR)[0].texte)
    assert.equal(nouveau.serie, 2)
    // La réponse de Bob à la question d'hier, arrivée après minuit, ne compte plus.
    const tardive = await poster(banc, bob, '/api/jour/repondre', { jour: JOUR, index: 5, choix: questions[5].bonne })
    assert.equal(tardive.status, 400)
    assert.match(tardive.corps.error, /Minuit/)
  }))

test('l’administrateur : coller une liste, lire un signalement, annuler une question pour tous, masquer un profil', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carol = await inscrireProfil(banc.url, 'carol', 'Carol', '🐙')
    assert.equal((await lire(banc, alice, '/api/admin/jour')).status, 401, 'pas un animateur')

    const etat = (await lire(banc, admin, '/api/admin/jour')).corps
    assert.ok(etat.reserve.pretes >= 30, 'les quiz livrés amorcent la réserve')
    const liste = [
      'Quelle est la capitale de l’Australie ?\n*Canberra\nSydney\nMelbourne',
      'Quelle est la capitale de l’Australie ?\n*Canberra\nPerth',
      'Combien de cordes a un violoncelle ?\n= 4',
      'Quel est ce monument ?\nPhoto : tour.jpg\n*La tour Eiffel\nBig Ben',
    ].join('\n\n')
    const colle = (await poster(banc, admin, '/api/admin/jour/liste', { texte: liste })).corps
    assert.equal(colle.ajoutees, 1)
    assert.deepEqual(
      colle.ecartees.map((e: any) => e.raison),
      ['en double', 'une estimation', 'une photo'],
    )
    // Recollée, elle est déjà là.
    assert.equal((await poster(banc, admin, '/api/admin/jour/liste', { texte: liste })).corps.ajoutees, 0)

    // Alice et Bob jouent tout juste, Carol moins ; Alice signale la première question.
    await jouer(banc, horloge, alice, () => true)
    await jouer(banc, horloge, bob, () => true)
    await jouer(banc, horloge, carol, i => i % 2 === 0)
    assert.equal((await poster(banc, alice, '/api/jour/signaler', { jour: JOUR, index: 0, texte: 'Deux réponses justes' })).status, 200)
    const signalement = (await lire(banc, admin, '/api/admin/jour')).corps.signalements[0]
    assert.equal(signalement.index, 0)
    assert.equal(signalement.joueurs, 1)
    assert.deepEqual(signalement.textes, ['Deux réponses justes'])
    assert.equal(signalement.annulable, true)

    // Annulée pour tous : ses points repartent, les médailles se comptent sur neuf.
    assert.equal((await poster(banc, admin, '/api/admin/jour/annuler', { jour: JOUR, index: 0 })).status, 200)
    const apres = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(apres.points, 1800)
    assert.equal(apres.pointsPossibles, 1800)
    assert.equal(apres.xp, 75, 'neuf sur neuf, parfaites : le maximum')
    assert.equal(apres.medaille, 'or')
    assert.deepEqual((await lire(banc, admin, '/api/admin/jour')).corps.signalements, [], 'traité')

    // Masquée : Alice disparaît du classement de Bob, pas du sien — et elle n'en sait rien.
    const trouves = (await lire(banc, admin, '/api/admin/jour/profils?q=ali')).corps
    const idAlice = trouves.find((p: any) => p.login === 'alice').id
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idAlice, masque: true })).status, 200)
    assert.deepEqual((await lire(banc, bob, '/api/jour/classement')).corps.lignes.map((l: any) => l.nom), ['Bob', 'Carol'])
    assert.deepEqual(
      (await lire(banc, alice, '/api/jour/classement')).corps.lignes.map((l: any) => l.nom).sort(),
      ['Alice', 'Bob', 'Carol'],
    )
    // À minuit, masquée, elle ne monte pas sur le podium : Bob le prend.
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    assert.equal((await lire(banc, bob, '/api/jour')).corps.sonHier.xpPodium, 25)
    assert.equal((await lire(banc, alice, '/api/jour')).corps.sonHier.xpPodium, 0)
  }))

test('un redémarrage ne perd rien : la partie reprend où elle était, et son expérience ne se relit pas au barème des soirées', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    await poster(banc, alice, '/api/jour/commencer')
    const questions = tirage(banc)
    await poster(banc, alice, '/api/jour/repondre', { jour: JOUR, index: 0, choix: questions[0].bonne })
    const q2 = (await poster(banc, alice, '/api/jour/suivante')).corps.question
    // Une ligne écrite par une version d'avant du barème : le démarrage suivant la relit.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    db.prepare(`UPDATE profile_xp SET detail = '{"v":1,"jours":1}' WHERE soiree_id = '#jour'`).run()
    db.close()

    await banc.redemarrer({ disqueEfface: true })
    const reprise = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(reprise.etat, 'en-cours')
    assert.equal(reprise.question?.index, 1, 'la question montrée, avec son échéance')
    assert.equal(reprise.question?.echeance, q2.echeance)
    assert.equal(reprise.points, 200)
    const profil = ((await lire(banc, alice, '/api/joueur/moi')).corps as any).profile
    assert.equal(profil.xp, 7, 'deux cents points sur deux mille : 7 XP, gardés')
    assert.deepEqual(profil.soirees, [])
    const lu = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const ligne = lu.prepare(`SELECT xp, detail FROM profile_xp WHERE soiree_id = '#jour'`).get() as { xp: number; detail: string }
    lu.close()
    assert.equal(ligne.xp, 7)
    assert.notEqual(JSON.parse(ligne.detail).v, 1, 'remise à la version du jour')
  }))

test('deux ex æquo en tête gagnent tous les deux : le podium les paie, le lendemain les nomme', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await jouer(banc, horloge, alice, () => true)
    await jouer(banc, horloge, bob, () => true)
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const matin = (await lire(banc, bob, '/api/jour')).corps
    assert.deepEqual(matin.vainqueursDHier.map((v: any) => v.nom), ['Alice', 'Bob'])
    assert.equal(matin.sonHier.rang, 1)
    assert.equal(matin.sonHier.xpPodium, 25)
    assert.equal((await lire(banc, alice, '/api/jour')).corps.sonHier.xpPodium, 25)
  }))

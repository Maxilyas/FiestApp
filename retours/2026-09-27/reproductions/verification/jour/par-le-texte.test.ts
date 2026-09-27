// Contre-expertise de jour-regles-1 (le second profil qui souffle).
//
// L'expert propose de mélanger les réponses (et l'ordre des questions) par
// profil, et sa reproduction recopie des INDEX : elle passera le jour où les
// index ne se transposent plus. Mais le tricheur n'a pas besoin des index :
// chaque révélation porte aussi le TEXTE de la question et de la bonne
// réponse. Recopiées par le texte — une recherche qui ne dépend d'aucun
// ordre —, en prenant 2,5 s pour retrouver la réponse à l'écran, elles font
// toujours le maximum : le bonus de rapidité ne fond qu'après le temps de
// lecture offert (1 s + 55 ms par caractère, `tempsDeLecture`,
// server/src/games/quiz.ts:172-190).
//
// Épreuve 1 : échoue aujourd'hui, et échouerait encore après un mélange par
// profil — c'est elle qui dit si la porte est fermée, pas celle des index.
// Épreuve 2 : ce qui tient déjà — masquer le tricheur avant minuit le tient
// hors du podium ; masqué après la nuit, il perd le laurier mais garde ce
// que la nuit lui a payé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/verification/jour/par-le-texte.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, inscrireProfil } from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import { toPlayable } from '../../../../shared/library'
import { tempsDeLecture } from '../../../../server/src/games/quiz'
import { avecBanc, base, idDe, jouer, JOUR, lire, poster, tirage } from '../../jour-regles/outils'

ProfileStore.tirageEclat = () => false

/** Le second profil joue au hasard et note, pour chaque intitulé, le texte de la bonne réponse. */
async function souffler(banc: any, cookie: string): Promise<Map<string, string>> {
  const soufflees = new Map<string, string>()
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  while (etat.question) {
    const r = (await poster(banc, cookie, '/api/jour/repondre', { jour: JOUR, index: etat.question.index, choix: 0 })).corps
    soufflees.set(r.texte, r.reponses[r.bonne])
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return soufflees
}

/** Le vrai profil lit l'intitulé à l'écran, retrouve le texte soufflé parmi SES réponses, et touche — `delai` ms après l'affichage. */
async function jouerSouffle(banc: any, horloge: { t: number }, cookie: string, soufflees: Map<string, string>, delai: number) {
  let partie = (await poster(banc, cookie, '/api/jour/commencer')).corps
  while (partie.question) {
    const q = partie.question
    const choix = q.reponses.indexOf(soufflees.get(q.texte))
    assert.ok(choix >= 0, 'le texte soufflé se retrouve parmi les réponses affichées')
    horloge.t += delai
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: JOUR, index: q.index, choix })
    assert.equal(r.status, 200)
    partie = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return partie
}

test('souffler par le texte, en 2,5 s par question, fait toujours 2 000 : un mélange par profil ne ferme pas la porte', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const honnete = await jouer(banc, horloge, alice, i => i !== 4, 2000)
    const mallory = await inscrireProfil(banc.url, 'mallory', 'Mallory', '🐺')
    const bis = await inscrireProfil(banc.url, 'mallory-bis', 'M', '🐸')
    const soufflees = await souffler(banc, bis)
    const partie = await jouerSouffle(banc, horloge, mallory, soufflees, 2500)

    // Le temps de lecture offert, question par question, dans le tirage du jour
    // et dans toute la réserve amorcée.
    const lectures = tirage(banc).map((q: any) => q.lectureMs as number)
    const reserve = base(banc, db => db.prepare('SELECT question FROM jour_reserve').all() as { question: string }[])
    const toutes = reserve
      .map(r => toPlayable({ ...JSON.parse(r.question), id: 'x' }))
      .filter((p): p is NonNullable<typeof p> => p !== null && p.kind === 'choice')
      .map(p => tempsDeLecture(p))
      .sort((a, b) => a - b)
    console.log(
      `[texte] Mallory, par le texte à 2,5 s : ${partie.points} pts, ${partie.justes}/10 ; Alice, honnête à 2 s : ${honnete.etat.points} pts` +
        ` ; lecture offerte au tirage : ${Math.min(...lectures)} à ${Math.max(...lectures)} ms` +
        ` ; dans la réserve amorcée (${toutes.length}) : min ${toutes[0]}, médiane ${toutes[Math.floor(toutes.length / 2)]} ms`,
    )

    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    await lire(banc, alice, '/api/jour')
    const premier = base(banc, db => db.prepare('SELECT profile_id FROM jour_podiums WHERE jour = ? AND rang = 1').all(JOUR)) as { profile_id: string }[]
    console.log(`[texte] première marche : ${premier.map(p => (p.profile_id === idDe(banc, 'mallory') ? 'Mallory' : p.profile_id)).join(', ')}`)
    assert.equal(partie.points, 2000, 'le score soufflé par le texte')
    assert.ok(!premier.some(p => p.profile_id === idDe(banc, 'mallory')), 'une partie soufflée ne devrait pas monter sur la première marche')
  }))

test('ce qui tient déjà : masqués avant minuit, le tricheur et son second profil ne montent pas', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await jouer(banc, horloge, alice, i => i !== 4, 2000)
    await jouer(banc, horloge, bob, i => i > 3, 2000)
    const mallory = await inscrireProfil(banc.url, 'mallory', 'Mallory', '🐺')
    const bis = await inscrireProfil(banc.url, 'mallory-bis', 'M', '🐸')
    await jouerSouffle(banc, horloge, mallory, await souffler(banc, bis), 2500)
    const admin = await connexionAnimateur(banc.url)
    const masquer = (login: string) => poster(banc, admin, '/api/admin/jour/masquer', { profileId: idDe(banc, login), masque: true })
    assert.equal((await masquer('mallory')).status, 200)
    assert.equal((await masquer('mallory-bis')).status, 200)

    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    await lire(banc, alice, '/api/jour')
    const nom = (id: string) => (id === idDe(banc, 'alice') ? 'Alice' : id === idDe(banc, 'bob') ? 'Bob' : 'Mallory ou M')
    const podium = base(banc, db => db.prepare('SELECT profile_id, rang, xp FROM jour_podiums WHERE jour = ? ORDER BY rang').all(JOUR)) as any[]
    const clos = base(banc, db => db.prepare('SELECT joueurs FROM jour_clotures WHERE jour = ?').get(JOUR)) as any
    console.log(`[masque avant] podium : ${JSON.stringify(podium.map(p => [nom(p.profile_id), p.rang, p.xp]))} ; salle comptée : ${clos.joueurs}`)
    assert.deepEqual(podium.map(p => [nom(p.profile_id), p.rang, p.xp]), [['Alice', 1, 25]])
    assert.equal(clos.joueurs, 2, 'les masqués sortent aussi de la salle')
  }))

test('masqué après la nuit : le tricheur perd le laurier, garde le podium payé et le Champion du jour', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    await jouer(banc, horloge, alice, i => i !== 4, 2000)
    const mallory = await inscrireProfil(banc.url, 'mallory', 'Mallory', '🐺')
    const bis = await inscrireProfil(banc.url, 'mallory-bis', 'M', '🐸')
    await jouerSouffle(banc, horloge, mallory, await souffler(banc, bis), 2500)
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    await lire(banc, alice, '/api/jour')
    const avant = (await lire(banc, mallory, '/api/joueur/moi')).corps.profile
    const admin = await connexionAnimateur(banc.url)
    await poster(banc, admin, '/api/admin/jour/masquer', { profileId: idDe(banc, 'mallory'), masque: true })
    const apres = (await lire(banc, mallory, '/api/joueur/moi')).corps.profile
    const vueAlice = (await lire(banc, alice, '/api/jour')).corps
    const vusParAlice = vueAlice.vainqueursDHier
    // jour-regles-10 : le rang d'hier se relit avec les masques d'aujourd'hui, l'expérience du podium non.
    console.log(`[masque après] « Hier » d’Alice : ${JSON.stringify(vueAlice.sonHier)}`)
    const paliers = base(banc, db => db.prepare(`SELECT badge FROM profile_badges WHERE profile_id = ? AND badge LIKE 'hf:champion-du-jour:%'`).all(idDe(banc, 'mallory')))
    console.log(
      `[masque après] Mallory : laurier ${avant.laurier === true} → ${apres.laurier === true}, XP ${avant.xp} → ${apres.xp}, Champion ${JSON.stringify(paliers)} ; vainqueurs d’hier vus par Alice : ${JSON.stringify(vusParAlice)}`,
    )
    assert.equal(apres.laurier === true, false)
    assert.equal(apres.xp, avant.xp, 'masquer ne reprend rien de ce que la nuit a payé')
  }))

// La question bonus du quiz du jour (le choix du propriétaire du 8 novembre
// 2026, « 1 + 2 + 4 ») : la question du public ne se mêle plus aux dix —
// mêlée à elles, on la jouait à la course sans voir qu'un joueur l'avait
// écrite, et l'administrateur qui l'avait relue la jouait en en sachant la
// réponse. Elle vient après elles, hors des points ; trouvée, des confettis
// et de l'expérience. Son auteur et celui qui l'a relue ne la jouent pas ; la
// salle la note d'un pouce ; la nuit juge son dosage, qui paie son auteur, et
// son accueil le raconte le lendemain. Les jours d'avant, où elle était
// l'une des dix : `jour-question-du-public.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { QUESTIONS_PAR_JOUR, XP_MAX_DU_JOUR } from '../../shared/jour'
import {
  CONFETTIS_DE_LA_QUESTION_BONUS,
  CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE,
  DUREE_DE_LA_QUESTION_BONUS,
  XP_DE_LA_QUESTION_BONUS,
  dosageDe,
} from '../../shared/propositions'
import { phraseDeLaProposition, type AnnonceDeLAdministrateur } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

/** Lundi 9 novembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 10, 9, 9, 0)
const JOUR = '2026-11-09'

const CHENILLE = {
  texte: 'Quelle danse de fête fait-on en file, les mains sur les épaules de celui de devant ?',
  reponses: ['Le madison', 'La chenille', 'La farandole', 'La macarena'],
  bonne: 1,
  categorie: 'Autour de la fête',
  anecdote: 'Elle a même sa chanson, « La Chenille », un tube de la Bande à Basile.',
}

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

interface QuestionLue {
  texte: string
  reponses: string[]
  bonne: number
  duree: number
  auteur?: string
  relecteur?: string
}

/** Le tirage d'un jour, lu en base : les dix, et la question bonus à part. */
function tirage(banc: Banc, jour = JOUR): { questions: QuestionLue[]; bonus: QuestionLue | null } {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const t = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    const b = db.prepare('SELECT question FROM jour_bonus WHERE jour = ?').get(jour) as { question: string } | undefined
    return { questions: t ? JSON.parse(t.questions) : [], bonus: b ? JSON.parse(b.question) : null }
  } finally {
    db.close()
  }
}

/** Un profil, et l'identifiant que le serveur lui a donné. */
async function profil(banc: Banc, login: string, nom: string, avatar: string) {
  const cookie = await inscrireProfil(banc.url, login, nom, avatar)
  return { cookie, id: (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string }
}

/** Il propose sa question, l'administrateur l'accepte : elle attend son jour, signée. */
async function proposerEtAccepter(banc: Banc, auteur: string, admin: string, q: typeof CHENILLE) {
  const { categorie, anecdote, ...sienne } = q
  assert.equal((await poster(banc, auteur, '/api/jour/propositions', sienne)).status, 200)
  const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
  const id = page.aRelire.find((p: any) => p.texte === q.texte).id
  const ok = await poster(banc, admin, `/api/admin/jour/propositions/${id}/accepter`, { question: { ...sienne, categorie, anecdote } })
  assert.equal(ok.status, 200, ok.corps.error)
}

/** Ses dix questions, chacune répondue à la première seconde — juste si `juste(i)` —, jusqu'à la fin. Rend la vue finale. */
async function jouerLesDix(banc: Banc, cookie: string, juste: (i: number) => boolean = () => true) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const { questions } = tirage(banc, etat.jour)
  for (let garde = 0; garde < 30 && etat.etat === 'en-cours'; garde++) {
    if (etat.question) {
      const i = etat.question.index
      const bonne = questions[i].bonne
      const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
      assert.equal(r.status, 200, r.corps.error)
    }
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  assert.equal(etat.etat, 'finie')
  return etat
}

/** Ses dix, puis la question bonus : juste ou non. Rend ce que sa réponse révèle. */
async function jouerLeBonus(banc: Banc, cookie: string, juste: boolean) {
  const montree = await poster(banc, cookie, '/api/jour/bonus')
  assert.equal(montree.status, 200, montree.corps.error)
  const { bonus } = tirage(banc)
  const r = await poster(banc, cookie, '/api/jour/bonus/repondre', { jour: JOUR, choix: juste ? bonus!.bonne : (bonus!.bonne + 1) % 4 })
  assert.equal(r.status, 200, r.corps.error)
  return r.corps
}

const solde = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.boutique?.confettis.solde as number
const xpDe = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.xp as number
type CarteDUneProposition = Extract<AnnonceDeLAdministrateur, { sorte: 'proposition' }>
const annoncesDe = async (banc: Banc, cookie: string): Promise<CarteDUneProposition[]> =>
  ((await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.annonces ?? []).filter((a: AnnonceDeLAdministrateur) => a.sorte === 'proposition')

test('la question du public ne se mêle plus aux dix : dix questions de la réserve, et la sienne à part, en bonus', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const bob = await profil(banc, 'bob', 'Bob', '🐻')
    const vue = (await lire(banc, bob.cookie, '/api/jour')).corps
    assert.equal(vue.total, QUESTIONS_PAR_JOUR)

    const { questions, bonus } = tirage(banc)
    assert.equal(questions.length, QUESTIONS_PAR_JOUR)
    assert.ok(
      questions.every(q => !q.auteur && q.texte !== CHENILLE.texte),
      'aucune des dix n’est la sienne',
    )
    assert.equal(bonus?.texte, CHENILLE.texte)
    assert.equal(bonus?.auteur, lea.id, 'son auteur, figé avec le jour')
    assert.ok(bonus!.duree >= DUREE_DE_LA_QUESTION_BONUS, 'son chrono, plus long que les dix')
    assert.equal(bonus!.reponses[bonus!.bonne], CHENILLE.reponses[CHENILLE.bonne], 'ses réponses mélangées, la bonne suit')

    // Pour Bob, avant ses dix : elle attend, signée — ni son intitulé, ni sa bonne réponse.
    assert.equal(vue.bonus.etat, 'a-venir')
    assert.deepEqual(vue.bonus.auteur, { nom: 'Léa', avatar: '🦊' })
    assert.deepEqual([vue.bonus.confettis, vue.bonus.xp], [CONFETTIS_DE_LA_QUESTION_BONUS, XP_DE_LA_QUESTION_BONUS])
    assert.equal(JSON.stringify(vue).includes(CHENILLE.texte), false)
    assert.equal(JSON.stringify(vue).includes(lea.id), false, 'son identifiant ne part pas aux téléphones')
    // Pendant ses dix, son état seul : la vue de chaque question ne la signe pas.
    const enCours = (await poster(banc, bob.cookie, '/api/jour/commencer')).corps
    assert.deepEqual(Object.keys(enCours.bonus).sort(), ['confettis', 'duree', 'etat', 'xp'])
    assert.equal(enCours.bonus.etat, 'a-venir')
  }))

test('elle se joue après les dix, au chrono du serveur, hors des points : trouvée, des confettis et de l’expérience — une fois', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const bob = await profil(banc, 'bob', 'Bob', '🐻')

    // Avant la fin de ses dix : elle attend son tour.
    await poster(banc, bob.cookie, '/api/jour/commencer')
    const tropTot = await poster(banc, bob.cookie, '/api/jour/bonus')
    assert.equal(tropTot.status, 400)
    assert.match(tropTot.corps.error, /dix questions/)

    const fin = await jouerLesDix(banc, bob.cookie)
    assert.deepEqual([fin.points, fin.justes, fin.medaille, fin.xp], [2000, 10, 'or', XP_MAX_DU_JOUR])
    assert.equal(fin.bonus.etat, 'a-jouer')
    assert.deepEqual(fin.bonus.auteur, { nom: 'Léa', avatar: '🦊' })
    const avant = { solde: await solde(banc, bob.cookie), xp: await xpDe(banc, bob.cookie) }

    // Montrée : l'intitulé, ses réponses, son échéance au serveur — jamais sa bonne réponse.
    const montree = (await poster(banc, bob.cookie, '/api/jour/bonus')).corps
    assert.equal(montree.etat, 'en-cours')
    assert.equal(montree.question.texte, CHENILLE.texte)
    assert.equal(montree.question.echeance, horloge.t + montree.duree * 1000)
    assert.equal(montree.revelation, undefined)
    assert.equal(JSON.stringify(montree).includes('bonne'), false, 'la bonne réponse attend la sienne (invariant 1)')
    assert.equal(JSON.stringify(montree).includes(CHENILLE.anecdote), false, 'son anecdote aussi')
    // Redemandée — un double toucher, un téléphone qui revient : la même échéance, son chrono ne repart pas.
    horloge.t += 2000
    assert.equal((await poster(banc, bob.cookie, '/api/jour/bonus')).corps.question.echeance, montree.question.echeance)

    const { bonus } = tirage(banc)
    const r = (await poster(banc, bob.cookie, '/api/jour/bonus/repondre', { jour: JOUR, choix: bonus!.bonne })).corps
    assert.equal(r.etat, 'jouee')
    assert.deepEqual(
      [r.revelation.juste, r.revelation.choix, r.revelation.bonne, r.revelation.confettis, r.revelation.xp, r.revelation.anecdote],
      [true, bonus!.bonne, bonus!.bonne, CONFETTIS_DE_LA_QUESTION_BONUS, XP_DE_LA_QUESTION_BONUS, CHENILLE.anecdote],
    )
    assert.deepEqual(r.auteur, { nom: 'Léa', avatar: '🦊' })
    assert.equal(r.revelation.salle, undefined, 'la salle et ses pouces : à son auteur seulement')

    // Ses points, ses étoiles, son expérience de partie : rien n'a bougé. Ce qu'elle rapporte vient en plus.
    const apres = (await lire(banc, bob.cookie, '/api/jour')).corps
    assert.deepEqual([apres.points, apres.justes, apres.medaille, apres.xp], [2000, 10, 'or', XP_MAX_DU_JOUR])
    assert.equal(apres.bonus.etat, 'jouee')
    assert.equal(await solde(banc, bob.cookie), avant.solde + CONFETTIS_DE_LA_QUESTION_BONUS)
    assert.equal(await xpDe(banc, bob.cookie), avant.xp + XP_DE_LA_QUESTION_BONUS)

    // Rejouée — le réseau a hoqueté, une autre réponse touchée : la même révélation, rien de plus.
    const rejouee = (await poster(banc, bob.cookie, '/api/jour/bonus/repondre', { jour: JOUR, choix: (bonus!.bonne + 1) % 4 })).corps
    assert.equal(rejouee.revelation.juste, true)
    assert.equal(await solde(banc, bob.cookie), avant.solde + CONFETTIS_DE_LA_QUESTION_BONUS)
    assert.equal(await xpDe(banc, bob.cookie), avant.xp + XP_DE_LA_QUESTION_BONUS)
    // Le classement ne la voit pas.
    assert.equal((await lire(banc, bob.cookie, '/api/jour/classement')).corps.lignes[0].points, 2000)
  }))

test('ratée ou laissée au temps, elle ne rapporte rien ; une réponse arrivée après la fin ne compte pas', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const [chloe, dan, eve] = await Promise.all([profil(banc, 'chloe', 'Chloé', '🐼'), profil(banc, 'dan', 'Dan', '🐸'), profil(banc, 'eve', 'Ève', '🦉')])
    for (const j of [chloe, dan, eve]) await jouerLesDix(banc, j.cookie)
    const soldes = await Promise.all([chloe, dan, eve].map(j => solde(banc, j.cookie)))

    // Ève se trompe : rien.
    const ratee = await jouerLeBonus(banc, eve.cookie, false)
    assert.deepEqual([ratee.revelation.juste, ratee.revelation.confettis, ratee.revelation.xp], [false, 0, 0])

    // Chloé la laisse au temps : sa page relit après l'échéance, elle compte sans réponse.
    await poster(banc, chloe.cookie, '/api/jour/bonus')
    const duree = tirage(banc).bonus!.duree
    horloge.t += duree * 1000 + 2000
    const vue = (await lire(banc, chloe.cookie, '/api/jour')).corps
    assert.equal(vue.bonus.etat, 'jouee')
    assert.deepEqual([vue.bonus.revelation.choix, vue.bonus.revelation.juste, vue.bonus.revelation.confettis], [null, false, 0])

    // Dan répond juste, mais après l'échéance et sa marge : trop tard.
    await poster(banc, dan.cookie, '/api/jour/bonus')
    horloge.t += duree * 1000 + 1600
    const tard = (await poster(banc, dan.cookie, '/api/jour/bonus/repondre', { jour: JOUR, choix: tirage(banc).bonus!.bonne })).corps
    assert.deepEqual([tard.revelation.tropTard, tard.revelation.juste, tard.revelation.confettis], [true, false, 0])

    assert.deepEqual(await Promise.all([chloe, dan, eve].map(j => solde(banc, j.cookie))), soldes)
  }))

test('son auteur et l’administrateur qui l’a relue ne la jouent pas : ils la voient, réponse et salle comprises, et leurs dix comptent pleinement', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    // L'administrateur tient un profil : c'est lui qui relira.
    const anim = await profil(banc, 'anim', 'Antoine', '🦁')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, admin)).status, 200)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const { bonus } = (await lire(banc, lea.cookie, '/api/jour'), tirage(banc))
    assert.equal(bonus?.relecteur, anim.id, 'qui l’a relue, figé avec le jour')

    // Léa : sa question, d'emblée — la bonne réponse et la salle, sans sa propre signature.
    const sienne = (await lire(banc, lea.cookie, '/api/jour')).corps.bonus
    assert.equal(sienne.etat, 'tienne')
    assert.equal(sienne.auteur, undefined)
    assert.equal(sienne.revelation.bonne, bonus!.bonne)
    assert.deepEqual(sienne.revelation.salle, { joueurs: 0, trouvees: 0, pour: 0, contre: 0 })
    // Antoine : relue, signée de Léa.
    const relue = (await lire(banc, anim.cookie, '/api/jour')).corps.bonus
    assert.equal(relue.etat, 'relue')
    assert.deepEqual(relue.auteur, { nom: 'Léa', avatar: '🦊' })

    // Leurs dix comptent pleinement — plus de moyenne d'auteur —, et la question bonus ne se sert à aucun des deux.
    for (const j of [lea, anim]) {
      const fin = await jouerLesDix(banc, j.cookie)
      assert.deepEqual([fin.points, fin.justes, fin.medaille], [2000, 10, 'or'])
      const servie = await poster(banc, j.cookie, '/api/jour/bonus')
      assert.equal(servie.status, 400)
      assert.match(servie.corps.error, /connais/)
    }

    // La salle joue : Léa la voit grandir.
    const bob = await profil(banc, 'bob', 'Bob', '🐻')
    await jouerLesDix(banc, bob.cookie)
    await jouerLeBonus(banc, bob.cookie, true)
    assert.equal((await poster(banc, bob.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: 1 })).status, 200)
    assert.deepEqual((await lire(banc, lea.cookie, '/api/jour')).corps.bonus.revelation.salle, { joueurs: 1, trouvees: 1, pour: 1, contre: 0 })
  }))

test('le pouce : une fois jouée, changeable jusqu’à minuit — le QG et « Tes questions » le comptent', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const [bob, chloe] = await Promise.all([profil(banc, 'bob', 'Bob', '🐻'), profil(banc, 'chloe', 'Chloé', '🐼')])
    for (const j of [bob, chloe]) await jouerLesDix(banc, j.cookie)

    // Pas avant de l'avoir jouée, et rien d'autre qu'un pouce.
    assert.equal((await poster(banc, bob.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: 1 })).status, 400)
    await jouerLeBonus(banc, bob.cookie, true)
    await jouerLeBonus(banc, chloe.cookie, false)
    assert.equal((await poster(banc, bob.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: 5 })).status, 400)

    const vote = (await poster(banc, bob.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: -1 })).corps
    assert.equal(vote.revelation.vote, -1)
    // Il se ravise : le dernier compte.
    assert.equal((await poster(banc, bob.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: 1 })).corps.revelation.vote, 1)
    await poster(banc, chloe.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: -1 })

    // Le QG : la question bonus d'aujourd'hui, son auteur, ses réponses et ses pouces.
    const suivi = (await lire(banc, admin, '/api/admin/jour/suivi')).corps
    assert.equal(suivi.questions.length, QUESTIONS_PAR_JOUR, 'les dix seules dans « Question par question »')
    assert.equal(suivi.bonus.texte, CHENILLE.texte)
    assert.deepEqual(suivi.bonus.auteur, { id: lea.id, nom: 'Léa' })
    assert.deepEqual([suivi.bonus.joueurs, suivi.bonus.trouvees, suivi.bonus.pour, suivi.bonus.contre], [2, 1, 1, 1])
    assert.equal(suivi.bonus.parReponse.reduce((s: number, n: number) => s + n, 0), 2)
    // Sa page des questions du public, parmi les relues, et « Tes questions » sous la plume de Léa.
    const relue = (await lire(banc, admin, '/api/admin/jour/propositions')).corps.relues.find((p: any) => p.texte === CHENILLE.texte)
    assert.deepEqual([relue.statut, relue.salle], ['posee', { joueurs: 2, trouvees: 1, pour: 1, contre: 1 }])
    const siennes = (await lire(banc, lea.cookie, '/api/jour/propositions')).corps
    assert.deepEqual(siennes[0].salle, { joueurs: 2, trouvees: 1, pour: 1, contre: 1 })

    // Minuit passé, la question d'hier est close : plus de pouce.
    horloge.t += 24 * 3_600_000
    const tard = await poster(banc, bob.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: -1 })
    assert.equal(tard.status, 400)
    assert.match(tard.corps.error, /Minuit/)
  }))

test('le défi de l’auteur : la nuit juge son dosage — bien dosée, des confettis de plus — et son accueil le raconte le lendemain', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const salle = await Promise.all(['b', 'c', 'd', 'e', 'f'].map((l, i) => profil(banc, `joueur-${l}`, `Joueur ${l}`, ['🐻', '🐼', '🐸', '🦉', '🐯'][i])))
    // Deux sur cinq la trouvent : 40 %, ni évidente, ni impossible.
    for (const [i, j] of salle.entries()) {
      await jouerLesDix(banc, j.cookie)
      await jouerLeBonus(banc, j.cookie, i < 2)
      await poster(banc, j.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: i < 4 ? 1 : -1 })
    }
    const avant = await solde(banc, lea.cookie)
    assert.deepEqual(
      (await annoncesDe(banc, lea.cookie)).map(a => [a.issue, a.bonus]),
      [['posee', true]],
      'le jour même, sa carte dit qu’elle est la question bonus',
    )

    // Minuit : la nuit se clôt à la première demande, et juge.
    horloge.t += 24 * 3_600_000
    await lire(banc, salle[0].cookie, '/api/jour')
    assert.equal(await solde(banc, lea.cookie), avant + CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE)
    const cartes = await annoncesDe(banc, lea.cookie)
    assert.deepEqual(
      cartes.map(a => a.issue),
      ['bilan'],
      'son bilan prend la place de la carte du jour',
    )
    const bilan = cartes[0]
    assert.deepEqual(bilan.salle, { joueurs: 5, trouvees: 2, pour: 4, contre: 1 })
    assert.equal(dosageDe(5, 2), 'bien')
    assert.match(phraseDeLaProposition(bilan).titre, new RegExp(`bien dosée : \\+${CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE}`))
    assert.match(phraseDeLaProposition(bilan).phrase, /5 joueurs l’ont jouée, 2 l’ont trouvée · 👍 4 · 👎 1/)

    // L'économie du QG le compte comme le solde : au confetti près, ce qui circule est la somme des soldes.
    const economie = (await lire(banc, admin, '/api/admin/economie')).corps
    const soldes = await Promise.all([lea, ...salle].map(j => solde(banc, j.cookie)))
    assert.equal(economie.circulation?.total, soldes.reduce((s, n) => s + n, 0))
  }))

test('trop facile, ou jouée par trop peu : son dosage ne rapporte rien de plus, et son bilan le dit sans reproche', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const salle = await Promise.all(['b', 'c', 'd', 'e', 'f'].map((l, i) => profil(banc, `joueur-${l}`, `Joueur ${l}`, ['🐻', '🐼', '🐸', '🦉', '🐯'][i])))
    // Les cinq la trouvent : évidente.
    for (const j of salle) {
      await jouerLesDix(banc, j.cookie)
      await jouerLeBonus(banc, j.cookie, true)
    }
    const avant = await solde(banc, lea.cookie)
    horloge.t += 24 * 3_600_000
    await lire(banc, salle[0].cookie, '/api/jour')
    assert.equal(await solde(banc, lea.cookie), avant)
    const bilan = (await annoncesDe(banc, lea.cookie))[0]
    assert.equal(bilan.issue, 'bilan')
    assert.equal(dosageDe(bilan.salle!.joueurs, bilan.salle!.trouvees), 'facile')
    assert.match(phraseDeLaProposition(bilan).phrase, /un peu facile/)
    // À quatre, la part ne dit rien : ni bien, ni mal dosée.
    assert.equal(dosageDe(4, 2), null)
  }))

test('la correction la montre au bout : à qui l’a jouée, puis à tous une fois le jour clos — jamais avant qu’il ait pu la jouer', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    const [bob, chloe] = await Promise.all([profil(banc, 'bob', 'Bob', '🐻'), profil(banc, 'chloe', 'Chloé', '🐼')])
    for (const j of [bob, chloe]) await jouerLesDix(banc, j.cookie)
    // Chloé a fini ses dix, pas la question bonus : sa correction ne la lui souffle pas.
    const sansElle = (await lire(banc, chloe.cookie, `/api/jour/correction/${JOUR}`)).corps
    assert.equal(sansElle.questions.length, QUESTIONS_PAR_JOUR)
    assert.equal(sansElle.bonus, undefined)
    // Bob l'a jouée : elle est au bout de la sienne.
    await jouerLeBonus(banc, bob.cookie, true)
    const deBob = (await lire(banc, bob.cookie, `/api/jour/correction/${JOUR}`)).corps
    assert.deepEqual([deBob.bonus.etat, deBob.bonus.revelation.juste, deBob.bonus.revelation.texte], ['jouee', true, CHENILLE.texte])
    // Le lendemain, à tous.
    horloge.t += 24 * 3_600_000
    const deChloe = (await lire(banc, chloe.cookie, `/api/jour/correction/${JOUR}`)).corps
    assert.deepEqual([deChloe.bonus.revelation.choix, deChloe.bonus.revelation.texte], [null, CHENILLE.texte])
  }))

test('masqué des classements ou supprimé, son auteur ne signe plus la question bonus — elle reste, sans nom', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await proposerEtAccepter(banc, lea.cookie, admin, CHENILLE)
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: lea.id, masque: true })).status, 200)
    const bob = await profil(banc, 'bob', 'Bob', '🐻')
    const fin = await jouerLesDix(banc, bob.cookie)
    assert.equal(fin.bonus.auteur, undefined)
    const r = await jouerLeBonus(banc, bob.cookie, true)
    assert.equal(r.auteur, undefined)
    assert.equal(r.revelation.juste, true, 'elle se joue toujours')
  }))

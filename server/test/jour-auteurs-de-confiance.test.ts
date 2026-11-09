// La confiance aux auteurs connus (le choix du propriétaire du 9 novembre
// 2026, « Sur la 3 ») : le QG relisait chaque question du public, et
// l'administrateur, qui joue le quiz du jour, en savait d'avance chaque
// question bonus. Il ne relit plus que la première de chaque joueur : une
// question acceptée, et les suivantes passent d'office — c'est le joueur qui
// choisit leur catégorie. Le QG les montre closes dans la file : les lire,
// c'est ne pas les jouer. Les filets : retirer une question de la file avant
// son jour, annuler pour tous la question bonus du jour — l'une et l'autre
// rendent son auteur à la relecture. Le circuit d'avant : `jour-propositions.test.ts` ;
// la question bonus : `jour-question-bonus.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import {
  CONFETTIS_DE_LA_QUESTION_BONUS,
  CONFETTIS_D_UNE_QUESTION_ACCEPTEE,
  CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE,
  CONFETTIS_D_UNE_QUESTION_JOUEE,
  QUESTIONS_D_OFFICE_EN_FILE_MAX,
  XP_DE_LA_QUESTION_BONUS,
  conseilDeLaProposition,
  estDeConfiance,
  lireLaProposition,
} from '../../shared/propositions'
import { phraseDeLaProposition, type AnnonceDeLAdministrateur } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

/** Lundi 9 novembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 10, 9, 9, 0)
const JOUR = '2026-11-09'
const H = 3_600_000

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

/** Une question de Léa, la n-ième : sa catégorie choisie. */
const question = (n: number, categorie = 'Histoire') => ({
  texte: `Quelle est la question numéro ${n} écrite par Léa ?`,
  reponses: [`Un${n}`, `Deux${n}`, `Trois${n}`, `Quatre${n}`],
  bonne: 1,
  categorie,
})

/** Ce que la base garde d'une question du public, par son intitulé : sa ligne de la réserve et sa proposition. */
function enBase(banc: Banc, texte: string) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return db
      .prepare(
        `SELECT r.id, r.source, r.auteur, r.relecteur, r.categorie, r.d_office, r.posee_le, r.retiree_le, p.statut, p.motif
         FROM jour_reserve r LEFT JOIN jour_propositions p ON p.reserve_id = r.id WHERE json_extract(r.question, '$.text') = ?`,
      )
      .get(texte) as
      | { id: string; source: string; auteur: string | null; relecteur: string | null; categorie: string | null; d_office: number; posee_le: string | null; retiree_le: number | null; statut: string; motif: string | null }
      | undefined
  } finally {
    db.close()
  }
}

/** La question bonus d'un jour, telle que le tirage l'a figée. */
function bonusDu(banc: Banc, jour = JOUR): { texte: string; bonne: number; reponses: string[]; annulee?: number } | null {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const b = db.prepare('SELECT question FROM jour_bonus WHERE jour = ?').get(jour) as { question: string } | undefined
    return b ? JSON.parse(b.question) : null
  } finally {
    db.close()
  }
}

/** Un profil, et l'identifiant que le serveur lui a donné. */
async function profil(banc: Banc, login: string, nom: string, avatar: string) {
  const cookie = await inscrireProfil(banc.url, login, nom, avatar)
  return { cookie, id: (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string }
}

/** Sa première question, relue et acceptée par le QG : il devient de confiance. */
async function premiereAcceptee(banc: Banc, auteur: string, admin: string, n = 1) {
  const proposee = await poster(banc, auteur, '/api/jour/propositions', question(n))
  assert.equal(proposee.status, 200, proposee.corps.error)
  assert.equal(proposee.corps.statut, 'en-relecture', 'sa première question se relit')
  const ok = await poster(banc, admin, `/api/admin/jour/propositions/${proposee.corps.id}/accepter`, { question: { ...question(n), anecdote: '' } })
  assert.equal(ok.status, 200, ok.corps.error)
  return proposee.corps.id as string
}

/** Ses dix questions, toutes justes, jusqu'à la fin. */
async function jouerLesDix(banc: Banc, cookie: string) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  const questions = JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions) as { bonne: number }[]
  db.close()
  for (let garde = 0; garde < 30 && etat.etat === 'en-cours'; garde++) {
    if (etat.question) {
      const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: questions[etat.question.index].bonne })
      assert.equal(r.status, 200, r.corps.error)
    }
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  assert.equal(etat.etat, 'finie')
  return etat
}

const solde = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.boutique?.confettis.solde as number
const xpDe = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.xp as number
type CarteDUneProposition = Extract<AnnonceDeLAdministrateur, { sorte: 'proposition' }>
const annoncesDe = async (banc: Banc, cookie: string): Promise<CarteDUneProposition[]> =>
  ((await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.annonces ?? []).filter((a: AnnonceDeLAdministrateur) => a.sorte === 'proposition')

test('sa catégorie se choisit au téléphone, relue aux mêmes règles ; la confiance se lit de trois instants', () => {
  const q = question(1, 'Géographie')
  // Le dernier geste : la carte prête par ailleurs, il reste sa catégorie.
  assert.equal(conseilDeLaProposition(q.texte, q.reponses, q.bonne, '', ''), 'Dernier geste : sa catégorie, en haut de la carte.')
  assert.equal(conseilDeLaProposition(q.texte, q.reponses, null, '', ''), 'Touche une forme : c’est la bonne réponse.', 'le reste d’abord')
  assert.equal(conseilDeLaProposition(q.texte, q.reponses, q.bonne, '', 'Géographie'), null)
  assert.deepEqual(lireLaProposition(q), q)
  assert.equal(lireLaProposition({ ...q, categorie: 'Astrologie' }), 'Dernier geste : sa catégorie, en haut de la carte.', 'l’une des douze, rien d’autre')
  // Une page d'avant n'envoie pas de catégorie : sa question se lit, et part en relecture.
  const { categorie: _, ...sansCategorie } = q
  assert.deepEqual(lireLaProposition(sansCategorie), sansCategorie)

  assert.equal(estDeConfiance(null, null, null), false, 'jamais acceptée : pas encore')
  assert.equal(estDeConfiance(100, null, null), true)
  assert.equal(estDeConfiance(100, 200, null), false, 'retirée après : à la relecture')
  assert.equal(estDeConfiance(100, null, 200), false, 'annulée après : à la relecture')
  assert.equal(estDeConfiance(300, 200, 250), true, 'acceptée de nouveau par le QG : la confiance revient')
})

test('sa première question se relit ; acceptée, les suivantes passent d’office — closes au QG, et la lire, c’est ne pas la jouer', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    // L'administrateur tient un profil, et joue le quiz du jour.
    const anim = await profil(banc, 'anim', 'Antoine', '🦁')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, admin)).status, 200)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    const avant = await solde(banc, lea.cookie)

    await premiereAcceptee(banc, lea.cookie, admin)
    // De confiance : la suivante passe d'office, sa catégorie à elle. (Une minute entre chaque geste : la file
    // passe dans l'ordre d'arrivée, et l'horloge du banc ne bouge que si on la pousse.)
    horloge.t += 60_000
    const deux = await poster(banc, lea.cookie, '/api/jour/propositions', question(2, 'Sciences'))
    assert.equal(deux.status, 200, deux.corps.error)
    assert.deepEqual([deux.corps.statut, deux.corps.dOffice, deux.corps.categorie], ['acceptee', true, 'Sciences'])
    const ligne = enBase(banc, question(2).texte)
    assert.deepEqual(
      [ligne?.source, ligne?.auteur, ligne?.relecteur, ligne?.categorie, ligne?.d_office, ligne?.statut],
      ['public', lea.id, null, 'Sciences', 1, 'acceptee'],
      'dans la réserve, signée, sans relecteur : personne ne la connaît',
    )
    horloge.t += 60_000
    const trois = await poster(banc, lea.cookie, '/api/jour/propositions', question(3, 'Nature'))
    assert.equal(trois.corps.statut, 'acceptee')
    // Ses confettis d'acceptée, chacune.
    assert.equal(await solde(banc, lea.cookie), avant + 3 * CONFETTIS_D_UNE_QUESTION_ACCEPTEE)
    // Son accueil le dit, sans « de l'administrateur » : personne ne l'a acceptée.
    const cartes = await annoncesDe(banc, lea.cookie)
    const dOffice = cartes.filter(c => c.issue === 'acceptee' && c.dOffice)
    assert.equal(dOffice.length, 2)
    assert.match(phraseDeLaProposition(dOffice[0]).titre, /acceptée d’office/)

    // Sa file au QG : rien à relire, la première lisible — il l'a acceptée —, les deux autres closes, dans l'ordre où elles passeront.
    const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.equal(page.aRelire.length, 0)
    assert.deepEqual(
      page.enFile.map((q: any) => [q.auteur?.nom, q.categorie, q.dOffice, q.question?.texte ?? null]),
      [
        ['Léa', 'Histoire', false, question(1).texte],
        ['Léa', 'Sciences', true, null],
        ['Léa', 'Nature', true, null],
      ],
    )
    assert.equal(JSON.stringify(page).includes(question(2).texte), false, 'son intitulé ne part pas au QG avant « La lire »')
    assert.equal(JSON.stringify(page).includes(question(3).reponses[1]), false)

    // Il en lit une : elle se montre telle qu'elle se jouera, et il en devient le relecteur.
    const idTrois = page.enFile[2].id
    const lue = await poster(banc, admin, `/api/admin/jour/propositions/${idTrois}/lire`)
    assert.equal(lue.status, 200, lue.corps.error)
    assert.deepEqual(lue.corps.question, { texte: question(3).texte, reponses: question(3).reponses, bonne: 1, categorie: 'Nature' })
    assert.equal(enBase(banc, question(3).texte)?.relecteur, anim.id)
    assert.equal((await lire(banc, admin, '/api/admin/jour/propositions')).corps.enFile[2].question?.texte, question(3).texte, 'lue, elle reste ouverte')
    assert.equal((await poster(banc, admin, '/api/admin/jour/propositions/inconnue/lire')).status, 404)

    // Un jour chacune, la plus ancienne d'abord. Le deuxième jour, la question qu'il n'a pas lue : il la joue comme tout le monde.
    await lire(banc, lea.cookie, '/api/jour')
    assert.equal(bonusDu(banc)?.texte, question(1).texte)
    horloge.t += 24 * H
    const jour2 = '2026-11-10'
    await jouerLesDix(banc, anim.cookie)
    assert.equal(bonusDu(banc, jour2)?.texte, question(2).texte)
    const servie = await poster(banc, anim.cookie, '/api/jour/bonus')
    assert.equal(servie.status, 200, servie.corps.error)
    assert.equal(servie.corps.etat, 'en-cours')
    // Le troisième, celle qu'il a lue : relue, elle ne se joue pas pour lui.
    horloge.t += 24 * H
    const fin = await jouerLesDix(banc, anim.cookie)
    assert.equal(fin.bonus.etat, 'relue')
    assert.equal((await poster(banc, anim.cookie, '/api/jour/bonus')).status, 400)
  }))

test('une page d’avant, sans catégorie, repasse par la relecture — une question que la réserve a déjà aussi, sans le dire au joueur', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await premiereAcceptee(banc, lea.cookie, admin)

    const { categorie: _, ...sansCategorie } = question(2)
    const vieille = await poster(banc, lea.cookie, '/api/jour/propositions', sansCategorie)
    assert.equal(vieille.corps.statut, 'en-relecture', 'personne ne l’aurait classée')
    assert.equal(enBase(banc, question(2).texte), undefined)

    // L'intitulé d'une question déjà dans la réserve : la relecture le dira au QG — le joueur n'apprend rien de ce qu'elle contient.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
    const deja = JSON.parse((db.prepare("SELECT question FROM jour_reserve WHERE source = 'livre' LIMIT 1").get() as { question: string }).question)
    db.close()
    const copie = await poster(banc, lea.cookie, '/api/jour/propositions', { texte: deja.text, reponses: ['Ceci', 'Cela', 'Autre chose', 'Rien'], bonne: 0, categorie: 'Histoire' })
    if (copie.status === 200) {
      assert.equal(copie.corps.statut, 'en-relecture')
      assert.equal(JSON.stringify(copie.corps).includes('réserve'), false)
    } else {
      // Une question livrée que le conseil refuse déjà (sa réponse dans l'intitulé…) : rien ne passe, et rien ne s'y dit de la réserve.
      assert.equal(String(copie.corps.error).includes('réserve'), false)
    }
    const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.ok(page.aRelire.some((p: any) => p.texte === question(2).texte))
  }))

test('sa part de la file a un plafond : au-delà, la suivante attend que l’une passe', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await premiereAcceptee(banc, lea.cookie, admin)
    // La première attend aussi son jour : elle compte.
    for (let n = 2; n <= QUESTIONS_D_OFFICE_EN_FILE_MAX; n++) {
      horloge.t += 60_000
      assert.equal((await poster(banc, lea.cookie, '/api/jour/propositions', question(n))).corps.statut, 'acceptee')
    }
    const deTrop = await poster(banc, lea.cookie, '/api/jour/propositions', question(9))
    assert.equal(deTrop.status, 400)
    assert.match(deTrop.corps.error, /attendent déjà leur jour/)
    assert.equal(enBase(banc, question(9).texte), undefined, 'ni dans la réserve, ni en relecture')
    // Le jour tiré, la première passe en question bonus : une place se libère.
    await lire(banc, lea.cookie, '/api/jour')
    assert.equal(bonusDu(banc)?.texte, question(1).texte)
    assert.equal((await poster(banc, lea.cookie, '/api/jour/propositions', question(9))).corps.statut, 'acceptee')
  }))

test('retirer de la file : elle quitte la réserve, son auteur le lit et garde ses confettis — sa suivante repasse par la relecture', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    const premiere = await premiereAcceptee(banc, lea.cookie, admin)
    horloge.t += 60_000
    const deux = (await poster(banc, lea.cookie, '/api/jour/propositions', question(2))).corps
    assert.equal(deux.statut, 'acceptee')
    const avant = await solde(banc, lea.cookie)

    // Un motif, toujours : le joueur doit savoir pourquoi.
    horloge.t += 60_000
    assert.equal((await poster(banc, admin, `/api/admin/jour/propositions/${deux.id}/retirer`, { motif: ' ' })).status, 400)
    const retrait = await poster(banc, admin, `/api/admin/jour/propositions/${deux.id}/retirer`, { motif: 'Sa réponse se discute' })
    assert.equal(retrait.status, 200, retrait.corps.error)
    const ligne = enBase(banc, question(2).texte)
    assert.deepEqual([ligne?.statut, ligne?.motif, typeof ligne?.retiree_le, ligne?.posee_le], ['retiree', 'Sa réponse se discute', 'number', null])
    // Un second geste se refuse ; une inconnue, 404.
    assert.equal((await poster(banc, admin, `/api/admin/jour/propositions/${deux.id}/retirer`, { motif: 'Encore' })).status, 400)
    assert.equal((await poster(banc, admin, '/api/admin/jour/propositions/inconnue/retirer', { motif: 'Encore' })).status, 404)

    // Son acceptation reste payée ; son accueil le dit, une fois.
    assert.equal(await solde(banc, lea.cookie), avant)
    const carte = (await annoncesDe(banc, lea.cookie)).find(c => c.issue === 'retiree')
    assert.ok(carte, 'la carte du retrait')
    assert.equal(carte.motif, 'Sa réponse se discute')
    assert.match(phraseDeLaProposition(carte).phrase, /relue avant de passer/)
    assert.equal((await lire(banc, lea.cookie, '/api/jour/propositions')).corps.find((p: any) => p.id === deux.id)?.statut, 'retiree')
    // Le QG la range parmi les relues, et la file ne la montre plus.
    const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.deepEqual(page.enFile.map((q: any) => q.id), [premiere])
    assert.deepEqual(
      page.relues.map((p: any) => [p.statut, p.motif, p.dOffice]),
      [['retiree', 'Sa réponse se discute', true]],
    )

    // Sa suivante se relit ; acceptée par le QG, la confiance revient.
    horloge.t += 60_000
    const trois = (await poster(banc, lea.cookie, '/api/jour/propositions', question(3))).corps
    assert.equal(trois.statut, 'en-relecture')
    horloge.t += 60_000
    assert.equal((await poster(banc, admin, `/api/admin/jour/propositions/${trois.id}/accepter`, { question: { ...question(3), anecdote: '' } })).status, 200)
    assert.equal((await poster(banc, lea.cookie, '/api/jour/propositions', question(4))).corps.statut, 'acceptee')

    // Passée au quiz du jour, elle ne se retire plus : son jour l'annule pour tous.
    await lire(banc, lea.cookie, '/api/jour')
    assert.equal(bonusDu(banc)?.texte, question(1).texte)
    const tard = await poster(banc, admin, `/api/admin/jour/propositions/${premiere}/retirer`, { motif: 'Trop tard' })
    assert.equal(tard.status, 400)
    assert.match(tard.corps.error, /annule-la pour tous/)
  }))

test('annuler la question bonus pour tous : elle ne se joue plus, et ce qu’elle a rapporté repart — à qui l’a trouvée, à son auteur, et sa confiance avec', () =>
  avecBanc(async (banc, horloge) => {
    const admin = await connexionAnimateur(banc.url)
    const lea = await profil(banc, 'lea', 'Léa', '🦊')
    await premiereAcceptee(banc, lea.cookie, admin)
    const salle = await Promise.all(['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l, i) => profil(banc, `joueur-${l}`, `Joueur ${l}`, ['🐻', '🐼', '🐸', '🦉', '🐯', '🐨', '🐙'][i])))
    // Cinq la jouent — deux la trouvent : bien dosée, si rien ne l'annulait. Le sixième l'a sous les yeux ; le septième finit ses dix après.
    for (const [i, j] of salle.slice(0, 6).entries()) {
      await jouerLesDix(banc, j.cookie)
      assert.equal((await poster(banc, j.cookie, '/api/jour/bonus')).status, 200)
      if (i === 5) continue
      const b = bonusDu(banc)!
      assert.equal((await poster(banc, j.cookie, '/api/jour/bonus/repondre', { jour: JOUR, choix: i < 2 ? b.bonne : (b.bonne + 1) % 4 })).status, 200)
    }
    const [trouveur, autreTrouveur, , , , enRoute, enRetard] = salle
    const soldes = await Promise.all(salle.map(j => solde(banc, j.cookie)))
    const xpAvant = await xpDe(banc, trouveur.cookie)
    const auteurAvant = await solde(banc, lea.cookie)
    assert.equal(auteurAvant, CONFETTIS_D_UNE_QUESTION_ACCEPTEE + CONFETTIS_D_UNE_QUESTION_JOUEE, 'acceptée, puis jouée ce matin')

    // Un jour qui n'est pas aujourd'hui ne s'annule pas.
    assert.equal((await poster(banc, admin, '/api/admin/jour/bonus/annuler', { jour: '2026-11-08' })).status, 400)
    horloge.t += 1000
    const annulee = await poster(banc, admin, '/api/admin/jour/bonus/annuler', { jour: JOUR })
    assert.equal(annulee.status, 200, annulee.corps.error)
    assert.equal(typeof bonusDu(banc)?.annulee, 'number')

    // Qui l'a trouvée : ses confettis et son expérience repartent ; sa révélation dit encore qu'il l'avait trouvée.
    assert.equal(await solde(banc, trouveur.cookie), soldes[0] - CONFETTIS_DE_LA_QUESTION_BONUS)
    assert.equal(await solde(banc, autreTrouveur.cookie), soldes[1] - CONFETTIS_DE_LA_QUESTION_BONUS)
    assert.equal(await xpDe(banc, trouveur.cookie), xpAvant - XP_DE_LA_QUESTION_BONUS)
    const vue = (await lire(banc, trouveur.cookie, '/api/jour')).corps.bonus
    assert.deepEqual(
      [vue.etat, vue.annulee, vue.revelation.juste, vue.revelation.confettis, vue.revelation.xp, vue.revelation.trouveePar],
      ['jouee', true, true, 0, 0, null],
    )
    assert.deepEqual(await Promise.all(salle.slice(2).map(j => solde(banc, j.cookie))), soldes.slice(2), 'ceux qui l’ont ratée n’avaient rien gagné')
    // Plus de pouce.
    assert.equal((await poster(banc, trouveur.cookie, '/api/jour/bonus/vote', { jour: JOUR, vote: 1 })).status, 400)

    // Celui qui l'avait sous les yeux : sa réponse n'écrit rien.
    const b = bonusDu(banc)!
    const reponse = await poster(banc, enRoute.cookie, '/api/jour/bonus/repondre', { jour: JOUR, choix: b.bonne })
    assert.equal(reponse.status, 200, reponse.corps.error)
    assert.deepEqual([reponse.corps.etat, reponse.corps.annulee, reponse.corps.revelation], ['annulee', true, undefined])
    assert.equal(await solde(banc, enRoute.cookie), soldes[5])
    // Celui qui finit ses dix après : elle ne se sert plus.
    const fin = await jouerLesDix(banc, enRetard.cookie)
    assert.deepEqual([fin.bonus.etat, fin.bonus.annulee], ['annulee', true])
    const servie = await poster(banc, enRetard.cookie, '/api/jour/bonus')
    assert.equal(servie.status, 200)
    assert.deepEqual([servie.corps.etat, servie.corps.question], ['annulee', undefined])

    // Son auteur : son acceptation reste payée, pas son jour ; sa carte le dit, et sa suivante se relit.
    assert.equal(await solde(banc, lea.cookie), CONFETTIS_D_UNE_QUESTION_ACCEPTEE)
    const carte = (await annoncesDe(banc, lea.cookie)).find(c => c.issue === 'annulee')
    assert.ok(carte, 'la carte de l’annulation')
    assert.equal(carte.bonus, true)
    assert.match(phraseDeLaProposition(carte).phrase, /relue avant de passer/)
    assert.equal((await poster(banc, lea.cookie, '/api/jour/propositions', question(2))).corps.statut, 'en-relecture')

    // Le QG : le suivi la dit annulée ; un second geste ne change rien à personne.
    assert.equal((await lire(banc, admin, '/api/admin/jour/suivi')).corps.bonus.annulee, true)
    assert.equal((await poster(banc, admin, '/api/admin/jour/bonus/annuler', { jour: JOUR })).status, 200)
    assert.equal(await solde(banc, trouveur.cookie), soldes[0] - CONFETTIS_DE_LA_QUESTION_BONUS)
    // L'économie du QG le compte comme les soldes.
    const economie = (await lire(banc, admin, '/api/admin/economie')).corps
    const tous = await Promise.all([lea, ...salle].map(j => solde(banc, j.cookie)))
    assert.equal(economie.circulation?.total, tous.reduce((s, n) => s + n, 0))

    // Minuit : rien n'est jugé — ni son dosage, ni son bilan —, et le jour clos ne s'annule plus.
    horloge.t += 24 * H
    await lire(banc, trouveur.cookie, '/api/jour')
    assert.equal(await solde(banc, lea.cookie), CONFETTIS_D_UNE_QUESTION_ACCEPTEE, `pas de +${CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE}`)
    assert.deepEqual(
      (await annoncesDe(banc, lea.cookie)).map(c => c.issue).filter(i => i === 'bilan' || i === 'annulee'),
      ['annulee'],
    )
    const close = await poster(banc, admin, '/api/admin/jour/bonus/annuler', { jour: JOUR })
    assert.equal(close.status, 400)
    assert.match(close.corps.error, /clos/)
    // La correction la montre, annulée.
    const correction = (await lire(banc, trouveur.cookie, `/api/jour/correction/${JOUR}`)).corps
    assert.deepEqual([correction.bonus.annulee, correction.bonus.revelation.confettis], [true, 0])
  }))

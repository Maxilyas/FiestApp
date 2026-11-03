// Les questions du public (`shared/propositions.ts`), de la plume au QG : un
// joueur propose une question au quiz du jour, l'administrateur la relit —
// l'accepte, retouchée, ou la refuse en disant pourquoi —, et le joueur
// l'apprend sur son accueil. Ce qu'elle devient au quiz du jour — une par
// jour, signée, sa propre question comptée à sa moyenne — :
// `jour-question-du-public.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ANECDOTE_DU_PUBLIC_MAX, PROPOSITIONS_EN_RELECTURE_MAX, conseilDeLaProposition, lireLaProposition, partDeLAuteur } from '../../shared/propositions'
import { MAX_ANECDOTE } from '../../shared/library'
import type { AnnonceDeLAdministrateur } from '../../shared/profil'

/** Lundi 2 novembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 10, 2, 9, 0)

const NEPAL = { texte: 'Quel est le seul pays dont le drapeau n’est pas un rectangle ?', reponses: ['Le Bhoutan', 'Le Népal', 'La Suisse', 'Le Vatican'], bonne: 1 }
const ACCEPTEE = { ...NEPAL, categorie: 'Géographie', anecdote: 'Deux triangles superposés, pour deux branches de sa dynastie.' }

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Une question de la réserve, lue en base par son intitulé. */
function dansLaReserve(banc: Banc, texte: string): { source: string; auteur: string | null; categorie: string | null; question: any } | undefined {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare("SELECT source, auteur, categorie, question FROM jour_reserve WHERE json_extract(question, '$.text') = ?").get(texte) as any
    return r && { ...r, question: JSON.parse(r.question) }
  } finally {
    db.close()
  }
}

/** Ce que son accueil lui dit de ses questions. */
async function sesNouvelles(banc: Banc, cookie: string): Promise<Extract<AnnonceDeLAdministrateur, { sorte: 'proposition' }>[]> {
  return ((await lire(banc, cookie, '/api/joueur/moi?accueil')).corps.profile.annonces ?? []).filter((a: AnnonceDeLAdministrateur) => a.sorte === 'proposition')
}

test('la carte à écrire conseille ce que le serveur refuse : la même règle, une phrase à la fois', () => {
  assert.equal(conseilDeLaProposition('', ['', '', '', ''], null), 'Écris ta question, puis ses quatre réponses.')
  assert.equal(conseilDeLaProposition(NEPAL.texte, ['Le Bhoutan', '', '', ''], null), 'Encore 3 réponses.')
  assert.equal(conseilDeLaProposition(NEPAL.texte, NEPAL.reponses, null), 'Touche une forme : c’est la bonne réponse.')
  assert.equal(conseilDeLaProposition(NEPAL.texte, ['Le Népal', 'le nepal', 'La Suisse', 'Le Vatican'], 0), 'Deux réponses sont pareilles.')
  assert.equal(conseilDeLaProposition('Quel fleuve, la Loire ou un autre, est le plus long de France ?', ['La Loire', 'Le Rhône', 'La Seine', 'La Garonne'], 0), 'Ta réponse se lit dans la question.')
  assert.equal(conseilDeLaProposition('Quel animal 🦖 a vécu le plus longtemps ?', ['A', 'B', 'C', 'D'], 0), 'Sans emoji : certains écrans ne l’affichent pas.')
  assert.equal(conseilDeLaProposition(NEPAL.texte, NEPAL.reponses, 1), null)
  // Relue au serveur : ses espaces nettoyés, rien de coupé en silence.
  assert.deepEqual(lireLaProposition({ ...NEPAL, texte: `  ${NEPAL.texte}  `, reponses: [' Le Bhoutan', 'Le  Népal', 'La Suisse', 'Le Vatican'] }), NEPAL)
  assert.equal(lireLaProposition({ ...NEPAL, reponses: ['Le Bhoutan', 'Le Népal'] }), 'Une question du public a quatre réponses.')
  assert.match(String(lireLaProposition({ ...NEPAL, texte: `${'Une très longue question '.repeat(10)}?` })), /200 caractères au plus/)
  assert.equal(lireLaProposition({ ...NEPAL, bonne: 7 }), 'Touche une forme : c’est la bonne réponse.')
})

test('son anecdote, facultative, relue aux mêmes règles : nettoyée, sans emoji, refusée trop longue — jamais coupée', () => {
  // Le propriétaire du dépôt, le 2 novembre 2026 : « On ne peut pas mettre
  // d'anecdote pour la question ? » — seul le QG en écrivait une, en l'acceptant.
  const anecdote = 'Deux triangles superposés, pour deux branches de sa dynastie.'
  assert.deepEqual(lireLaProposition({ ...NEPAL, anecdote: `  Deux triangles  superposés, pour deux branches de sa dynastie. ` }), { ...NEPAL, anecdote })
  assert.deepEqual(lireLaProposition({ ...NEPAL, anecdote: '   ' }), NEPAL, 'vide, elle n’existe pas')
  assert.equal(conseilDeLaProposition(NEPAL.texte, NEPAL.reponses, 1, 'Un drapeau de dinosaure 🦖.'), 'Sans emoji : certains écrans ne l’affichent pas.')
  assert.equal(lireLaProposition({ ...NEPAL, anecdote: 'Un drapeau de dinosaure 🦖.' }), 'Sans emoji : certains écrans ne l’affichent pas.')
  assert.equal(lireLaProposition({ ...NEPAL, anecdote: 'x'.repeat(ANECDOTE_DU_PUBLIC_MAX + 1) }), `L’anecdote tient en ${ANECDOTE_DU_PUBLIC_MAX} caractères.`)
  // Ce qu'il écrit passe tel quel à l'acceptation, qui relit toute anecdote à la limite des quiz.
  assert.ok(ANECDOTE_DU_PUBLIC_MAX <= MAX_ANECDOTE, `${ANECDOTE_DU_PUBLIC_MAX} caractères au joueur, ${MAX_ANECDOTE} à l’acceptation`)
})

test('son anecdote va au QG, qui la lit sous les réponses et la garde — ou la retouche — en l’acceptant', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const admin = await connexionAnimateur(banc.url)
    const anecdote = 'Deux triangles superposés, pour deux branches de sa dynastie.'
    const longue = await poster(banc, lea, '/api/jour/propositions', { ...NEPAL, anecdote: 'x'.repeat(ANECDOTE_DU_PUBLIC_MAX + 1) })
    assert.equal(longue.status, 400)
    assert.equal(longue.corps.error, `L’anecdote tient en ${ANECDOTE_DU_PUBLIC_MAX} caractères.`)
    const proposee = await poster(banc, lea, '/api/jour/propositions', { ...NEPAL, anecdote })
    assert.equal(proposee.status, 200, proposee.corps.error)
    assert.equal(proposee.corps.anecdote, anecdote)
    const p = (await lire(banc, admin, '/api/admin/jour/propositions')).corps.aRelire[0]
    assert.equal(p.anecdote, anecdote, 'le QG la lit avec sa question')
    // « Accepter » la reprend dans son champ : envoyée telle quelle, elle passe à la réserve.
    const ok = await poster(banc, admin, `/api/admin/jour/propositions/${p.id}/accepter`, { question: { ...p, categorie: 'Géographie' } })
    assert.equal(ok.status, 200, ok.corps.error)
    assert.equal(dansLaReserve(banc, NEPAL.texte)?.question.anecdote, anecdote)
  }))

test('sa propre question lui compte sa moyenne sur les autres, en points comme en bonnes réponses', () => {
  // 1 620 points sur neuf questions : sa question en vaut 180, sa partie 1 800.
  assert.equal(partDeLAuteur(1620, 9), 180)
  assert.equal(partDeLAuteur(9, 9), 1, 'neuf sur neuf : la sienne compte juste, et le sans-faute reste possible')
  assert.equal(partDeLAuteur(4, 9), 0)
  assert.equal(partDeLAuteur(5, 9), 1)
  assert.equal(partDeLAuteur(800, 0), 0, 'un jour réduit à sa seule question : rien sur quoi se prendre')
})

test('proposer, accepter : la question rejoint la réserve signée, et son auteur l’apprend sur son accueil', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id
    const admin = await connexionAnimateur(banc.url)

    // La plume est aux profils ; une question pas prête se refuse avec la phrase du conseil.
    assert.equal((await ecrire(banc.url, '/api/jour/propositions', NEPAL)).status, 401)
    const pasPrete = await poster(banc, lea, '/api/jour/propositions', { ...NEPAL, texte: 'Quel pays ?' })
    assert.equal(pasPrete.status, 400)
    assert.equal(pasPrete.corps.error, 'Un peu courte : précise-la.')

    const proposee = await poster(banc, lea, '/api/jour/propositions', NEPAL)
    assert.equal(proposee.status, 200, proposee.corps.error)
    assert.equal(proposee.corps.statut, 'en-relecture')
    assert.deepEqual(
      (await lire(banc, lea, '/api/jour/propositions')).corps.map((p: any) => [p.texte, p.statut]),
      [[NEPAL.texte, 'en-relecture']],
    )

    // Le QG la voit, son auteur nommé par son profil ; un joueur ne relit rien.
    assert.notEqual((await lire(banc, lea, '/api/admin/jour/propositions')).status, 200)
    const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.equal(page.aRelire.length, 1)
    assert.deepEqual(page.aRelire[0].auteur, { id: leaId, nom: 'Léa', login: 'lea' })
    assert.equal(page.enAttente, 0)
    const id = page.aRelire[0].id

    // Sans catégorie, elle ne passe pas : le quiz du jour mêle les siennes.
    const sansCategorie = await poster(banc, admin, `/api/admin/jour/propositions/${id}/accepter`, { question: NEPAL })
    assert.equal(sansCategorie.status, 400)
    assert.match(sansCategorie.corps.error, /catégorie/)
    assert.equal(dansLaReserve(banc, NEPAL.texte), undefined)

    // Acceptée, retouchée d'une anecdote : dans la réserve, signée, à part des autres.
    const ok = await poster(banc, admin, `/api/admin/jour/propositions/${id}/accepter`, { question: ACCEPTEE })
    assert.equal(ok.status, 200, ok.corps.error)
    const ligne = dansLaReserve(banc, NEPAL.texte)
    assert.equal(ligne?.source, 'public')
    assert.equal(ligne?.auteur, leaId)
    assert.equal(ligne?.categorie, 'Géographie')
    assert.equal(ligne?.question.anecdote, ACCEPTEE.anecdote)
    assert.deepEqual([ligne?.question.answers, ligne?.question.correct], [NEPAL.reponses, NEPAL.bonne])

    // Relue une fois : un second geste se refuse, et la page la range parmi les relues.
    assert.equal((await poster(banc, admin, `/api/admin/jour/propositions/${id}/refuser`, { motif: 'Trop facile' })).status, 400)
    const apres = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.deepEqual([apres.aRelire.length, apres.relues.map((p: any) => p.statut), apres.enAttente], [0, ['acceptee'], 1])
    // Une question du public sort une par jour : elle ne fait pas des jours d'avance à la réserve.
    const reserve = (await lire(banc, admin, '/api/admin/jour')).corps.reserve
    const prochaines = (await lire(banc, admin, '/api/admin/jour/prochaines')).corps
    assert.equal(prochaines.some((q: any) => q.question.text === NEPAL.texte), false, 'sa file est à part')
    assert.equal(reserve.pretes, 38, 'seules les questions des quiz livrés font des jours d’avance')

    // Son accueil le lui dit, une fois la relecture faite ; « Tes questions » aussi.
    const nouvelles = await sesNouvelles(banc, lea)
    assert.deepEqual(
      nouvelles.map(a => [a.issue, a.question]),
      [['acceptee', NEPAL.texte]],
    )
    assert.equal((await lire(banc, lea, '/api/jour/propositions')).corps[0].statut, 'acceptee')
  }))

test('refuser dit pourquoi ; trois en relecture à la fois au plus ; un profil supprimé emporte les siennes', () =>
  avecBanc(async banc => {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const leaId = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id
    const admin = await connexionAnimateur(banc.url)
    const question = (n: number) => ({ texte: `Quelle est la question numéro ${n} de Léa ?`, reponses: [`Un${n}`, `Deux${n}`, `Trois${n}`, `Quatre${n}`], bonne: 0 })

    for (let n = 1; n <= PROPOSITIONS_EN_RELECTURE_MAX; n++) assert.equal((await poster(banc, lea, '/api/jour/propositions', question(n))).status, 200)
    const deTrop = await poster(banc, lea, '/api/jour/propositions', question(9))
    assert.equal(deTrop.status, 400)
    assert.match(deTrop.corps.error, /en relecture : attends qu’une soit relue/)

    const page = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.equal(page.aRelire.length, PROPOSITIONS_EN_RELECTURE_MAX)
    const premiere = page.aRelire[0].id
    // Un motif vide se refuse : le joueur doit savoir pourquoi.
    assert.equal((await poster(banc, admin, `/api/admin/jour/propositions/${premiere}/refuser`, { motif: '  ' })).status, 400)
    const non = await poster(banc, admin, `/api/admin/jour/propositions/${premiere}/refuser`, { motif: 'Sa réponse se discute' })
    assert.equal(non.status, 200, non.corps.error)
    // Une place se libère.
    assert.equal((await poster(banc, lea, '/api/jour/propositions', question(9))).status, 200)
    const nouvelles = await sesNouvelles(banc, lea)
    assert.deepEqual(
      nouvelles.map(a => [a.issue, a.motif]),
      [['refusee', 'Sa réponse se discute']],
    )
    // Inconnue : 404.
    assert.equal((await poster(banc, admin, '/api/admin/jour/propositions/inconnue/accepter', { question: ACCEPTEE })).status, 404)

    // Une acceptée, puis le profil supprimé : ses propositions partent, sa question reste au quiz du jour, sans signature.
    const autre = (await lire(banc, admin, '/api/admin/jour/propositions')).corps.aRelire[0]
    assert.equal((await poster(banc, admin, `/api/admin/jour/propositions/${autre.id}/accepter`, { question: { ...autre, categorie: 'Histoire', anecdote: '' } })).status, 200)
    const suppression = await fetch(`${banc.url}/api/admin/profils/${leaId}`, { method: 'DELETE', headers: { Cookie: admin, 'X-Requested-With': 'quizz' } })
    assert.equal(suppression.status, 200)
    const apres = (await lire(banc, admin, '/api/admin/jour/propositions')).corps
    assert.deepEqual([apres.aRelire.length, apres.relues.length], [0, 0])
    const ligne = dansLaReserve(banc, autre.texte)
    assert.deepEqual([ligne?.source, ligne?.auteur], ['public', null])
  }))

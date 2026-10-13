// Défier quelqu'un (le souhait du propriétaire du 11 octobre 2026 : « tu
// choisis sur quoi tu veux défier, une barre de recherche, un classement de
// la ligue avec des petites épées pour affronter les personnes ; une fois le
// quiz fait de mon côté, ça envoie automatiquement une notification pour
// faire le défi, pas de lien à partager ; une liste d'amis avec leur
// classement et leur ligue, et pouvoir ajouter des amis »). « Trouver un
// adversaire » disait qu'il fallait que quelqu'un ait fini une série : on ne
// pouvait défier personne en particulier.
//
// Un duel classé entre deux vrais joueurs : celui qui défie joue d'abord ; à
// sa dernière réponse, l'autre le reçoit — dans ses duels, à l'accueil, et
// son téléphone sonne (`rappel.test.ts`). Joué des deux côtés, chacun bouge
// contre la cote de l'autre, figée au lancement. Un troisième ne le voit
// pas ; un seul duel ouvert par paire ; un ami retiré ne le reçoit pas, sans
// que l'autre l'apprenne ; fermé, un duel commencé des deux côtés compte sur
// ce qu'il a atteint.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { DUELS_OUVERTS_MAX, DUREE_D_UN_DUEL_MS, VIES } from '../../shared/campagne'
import { COTE_DE_DEPART, coteDuScore, ecartContre, enjeuContre, ligueDe, releverLesDuels, type DuelJoue } from '../../shared/duels'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const JOUR_MS = 24 * 3_600_000
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des duels au hasard déjà joués, écrits dans le journal : `n` fois `justes` contre `sesJustes`, finis à partir de `depuis`. */
function duelsJoues(banc: Banc, profileId: string, n: number, justes: number, sesJustes: number, depuis: number) {
  base(banc, db => {
    for (let i = 0; i < n; i++) {
      const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      ).run(randomUUID(), profileId, justes + VIES, justes, depuis + i * 60_000, depuis + i * 60_000 + 30_000, JSON.stringify(adversaire))
    }
  })
}

/** Joue une tentative jusqu'à sa fin — ou ses `jusqua` premières questions : `justes` bonnes réponses, puis des fautes. Rend la dernière réponse. */
async function jouer(banc: Banc, cookie: string, serie: string, justes: number, jusqua = Infinity): Promise<any> {
  const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  let derniere: any = null
  for (let i = 0; i < Math.min(qs.length, jusqua); i++) {
    const choix = i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    if (r.corps.finie) break
  }
  return derniere
}

test('le relevé d’un duel contre quelqu’un se joue contre la cote d’en face, figée au lancement — pas contre son score', () => {
  const t = Date.UTC(2026, 9, 6, 10)
  const semaine = () => '2026-10-05'
  const contreFort: DuelJoue = { serie: 'a', justes: 9, sesJustes: 8, finiLe: t, coteAdverse: 1400 }
  const ecart = releverLesDuels([contreFort], semaine).ecarts.get('a')!.ecart
  assert.equal(ecart, ecartContre(COTE_DE_DEPART, 1400, 0, 1))
  // Huit bonnes réponses en face valent la cote de départ : battre un joueur classé à 1400 rapporte bien plus.
  const contreSonScore = releverLesDuels([{ ...contreFort, coteAdverse: undefined }], semaine).ecarts.get('a')!.ecart
  assert.equal(contreSonScore, ecartContre(COTE_DE_DEPART, coteDuScore(8), 0, 1))
  assert.ok(ecart > contreSonScore)
  // Ce que la préparation dit avant de jouer, c'est ce que le relevé fera.
  assert.deepEqual(enjeuContre(COTE_DE_DEPART, 1400, 0), {
    cote: COTE_DE_DEPART,
    gagne: ecart,
    egalite: ecartContre(COTE_DE_DEPART, 1400, 0, 0.5),
    perdu: ecartContre(COTE_DE_DEPART, 1400, 0, 0),
  })
})

test('défier quelqu’un : il le reçoit à sa dernière réponse, sans lien ; joué des deux côtés, chacun bouge contre la cote de l’autre, figée au lancement', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
    const [deLea, deTom] = [idDe(banc, 'lea'), idDe(banc, 'tom')]
    // Tom a déjà joué : six duels au hasard gagnés, la semaine passée.
    duelsJoues(banc, deTom, 6, 12, 8, horloge.t - 3 * JOUR_MS)
    const coteDeTom = (await lire(banc, tom, '/api/duels')).corps.cote
    assert.ok(coteDeTom > COTE_DE_DEPART)

    // On ne se défie pas soi-même, ni un inconnu.
    assert.equal((await poster(banc, lea, '/api/campagne/duel', { adversaire: deLea })).corps.error, 'Tu ne peux pas te défier toi-même : choisis quelqu’un d’autre')
    assert.equal((await poster(banc, lea, '/api/campagne/duel', { adversaire: 'personne' })).corps.error, 'Ce joueur est introuvable : cherche-le de nouveau')

    // Léa le défie, sur l'histoire : ce qui se joue se dit contre sa cote à lui.
    const lance = await poster(banc, lea, '/api/campagne/duel', { categories: ['Histoire'], adversaire: deTom })
    assert.equal(lance.status, 200, lance.corps.error)
    const code: string = lance.corps.code
    assert.deepEqual(lance.corps.enjeu, enjeuContre(COTE_DE_DEPART, coteDeTom, 0))
    // Tant qu'elle joue, rien n'arrive chez Tom : ni dans ses duels, ni à l'accueil.
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.recus, [])
    assert.deepEqual((await lire(banc, tom, '/api/duels')).corps.contre, [])
    // Un seul duel ouvert par paire, dans un sens comme dans l'autre — et chacun sait quoi faire.
    assert.equal(
      (await poster(banc, lea, '/api/campagne/duel', { adversaire: deTom })).corps.error,
      'Tu as déjà un duel en cours contre Tom : finis-le, il partira à ta dernière réponse',
    )
    assert.equal((await poster(banc, tom, '/api/campagne/duel', { adversaire: deLea })).corps.error, 'Léa t’a déjà défié : son duel t’arrivera à sa dernière réponse')
    // Hugo, qui n'en est pas, ne le voit pas, même son code en main.
    assert.equal((await lire(banc, hugo, `/api/campagne/duel/${code}`)).corps.error, 'Ce défi est introuvable : vérifie son lien')
    assert.equal((await poster(banc, hugo, `/api/campagne/duel/${code}`)).corps.error, 'Ce défi est introuvable : vérifie son lien')

    // Sa dernière réponse : parti à Tom — sa cote bougera quand il l'aura joué.
    horloge.t += 60_000
    const fin = await jouer(banc, lea, lance.corps.serie.id, 4)
    assert.equal(fin.finie, true)
    assert.deepEqual(fin.partiA, ['Tom'])
    assert.equal(fin.classe, true)
    assert.equal(fin.duel, undefined, 'pas encore de cote : Tom ne l’a pas joué')
    assert.equal(fin.defi, undefined, 'un duel classé n’a pas de classement')
    // Tom le trouve en tête de ses duels — classé, son score caché : il se dévoile à sa dernière
    // réponse (le souhait du propriétaire du 12 octobre 2026 : on le voyait avant même de jouer) —,
    // et l'accueil le dit.
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.recus, [
      {
        code,
        auteur: { nom: 'Léa', avatar: '🦊' },
        categories: ['Histoire'],
        minutesRestantes: (DUREE_D_UN_DUEL_MS - 60_000) / 60_000,
        classe: true,
      },
    ])
    assert.deepEqual((await lire(banc, tom, '/api/joueur/moi?accueil')).corps.profile.duels.defisRecus, { n: 1, de: 'Léa' })
    // Un duel classé ne fait pas des amis : on ajoute qui l'on veut.
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.amis, [])
    assert.deepEqual((await lire(banc, lea, '/api/campagne/amis')).corps.amis, [])
    // Sa correction attend que Tom l'ait joué : elle lui soufflerait les réponses.
    const tropTot = await lire(banc, lea, `/api/campagne/serie/${lance.corps.serie.id}/correction`)
    assert.equal(tropTot.status, 400)
    assert.equal(tropTot.corps.error, 'La correction du duel s’ouvre quand vous l’aurez joué tous les deux')
    // Sa page, pour Léa : à qui il est parti ; pour Tom : ce qui se joue — le score de Léa, ni sur
    // la page, ni sur la ligne du score, ni dans ses duels : il se dévoile à sa dernière réponse.
    // Chacun à la couleur de sa ligue — l'anneau de son avatar, le bord de sa carte —, s'il a fini un duel classé :
    // Léa n'en a fini aucun, l'absence, pas une ligue de bronze.
    const pourLea = (await lire(banc, lea, `/api/campagne/duel/${code}`)).corps
    assert.deepEqual(pourLea.contre, { nom: 'Tom', avatar: '🐻', ligue: ligueDe(coteDeTom).cle })
    assert.deepEqual(pourLea.auteur, { nom: 'Léa', avatar: '🦊', toi: true })
    assert.equal(pourLea.enjeu, undefined, 'joué : plus rien à annoncer')
    assert.equal(pourLea.aBattre, undefined, 'Tom ne l’a pas joué')
    assert.equal(pourLea.nouveau, undefined, 'rien de joué des deux côtés : rien de nouveau')
    const pourTom = (await lire(banc, tom, `/api/campagne/duel/${code}`)).corps
    assert.deepEqual(pourTom.contre, { nom: 'Tom', avatar: '🐻', toi: true, ligue: ligueDe(coteDeTom).cle })
    assert.deepEqual(pourTom.auteur, { nom: 'Léa', avatar: '🦊' })
    assert.equal(pourTom.aBattre, undefined, 'son score se dévoile à sa dernière réponse')
    assert.deepEqual(pourTom.lignes, [], 'ni sur la ligne du score')
    assert.deepEqual(pourTom.enjeu, enjeuContre(coteDeTom, COTE_DE_DEPART, 6))
    assert.deepEqual((await lire(banc, tom, '/api/duels')).corps.contre, [
      { code, contre: { profileId: deLea, nom: 'Léa', avatar: '🦊' }, lance: false, categories: ['Histoire'], justes: null, sesJustes: null, minutesRestantes: (DUREE_D_UN_DUEL_MS - 60_000) / 60_000 },
    ])

    // Entre-temps, Tom gagne un duel au hasard : sa cote monte — celle que Léa affronte reste celle du lancement.
    duelsJoues(banc, deTom, 1, 12, 8, horloge.t - 30 * 60_000)
    const avantTom = (await lire(banc, tom, '/api/duels')).corps
    assert.ok(avantTom.cote > coteDeTom)
    // Tom le relève et gagne : sa cinquième bonne réponse dépasse les quatre de Léa, le duel finit là.
    horloge.t += 60_000
    const tentative = await poster(banc, tom, `/api/campagne/duel/${code}`)
    assert.equal(tentative.status, 200, tentative.corps.error)
    const finTom = await jouer(banc, tom, tentative.corps.id, 6)
    assert.deepEqual([finTom.finie, finTom.justes, finTom.vies, finTom.suivante], [true, 5, VIES, undefined], 'gagné : plus rien à jouer')
    assert.deepEqual(finTom.contre, { nom: 'Léa', avatar: '🦊', justes: 4, profileId: deLea }, 'sa fin dit qui l’a lancé, et son score')
    assert.equal(finTom.classe, undefined)
    const ecartDeTom = ecartContre(avantTom.cote, COTE_DE_DEPART, avantTom.joues, 1)
    assert.equal(finTom.duel.avant, avantTom.cote)
    assert.equal(finTom.duel.ecart, ecartDeTom, 'Tom bouge contre la cote de Léa au lancement')
    assert.equal(finTom.duel.apres, avantTom.cote + ecartDeTom)
    assert.equal(finTom.duel.rang, 1, 'et sa place au classement, sa cote d’après comptée')
    // Léa bouge contre la cote de Tom au lancement — pas celle d'après son duel au hasard, ni celle de son score.
    const ecartDeLea = ecartContre(COTE_DE_DEPART, coteDeTom, 0, 0)
    const apresLea = (await lire(banc, lea, '/api/duels')).corps
    assert.equal(apresLea.cote, COTE_DE_DEPART + ecartDeLea)
    assert.equal(apresLea.joues, 1)
    assert.equal(apresLea.ligue, ligueDe(COTE_DE_DEPART + ecartDeLea).cle)
    // Son résultat l'attend : nouveau tant qu'elle ne l'a pas vu, daté du second qui a fini, Tom à la couleur de sa ligue.
    assert.deepEqual(apresLea.contre, [
      {
        code,
        contre: { profileId: deTom, nom: 'Tom', avatar: '🐻', ligue: ligueDe(avantTom.cote + ecartDeTom).cle },
        lance: true,
        categories: ['Histoire'],
        justes: 4,
        sesJustes: 5,
        ecart: ecartDeLea,
        le: horloge.t,
        nouveau: true,
        minutesRestantes: (DUREE_D_UN_DUEL_MS - 2 * 60_000) / 60_000,
      },
    ])
    // L'accueil le compte, et mène à lui : il n'y avait ni signe ni message (le retour du propriétaire du 12 octobre 2026).
    assert.deepEqual((await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.duels.resultats, { n: 1, de: 'Tom', code })
    assert.equal((await lire(banc, tom, '/api/joueur/moi?accueil')).corps.profile.duels.resultats, undefined, 'Tom l’a vu à sa dernière réponse')
    assert.equal((await lire(banc, tom, '/api/duels')).corps.cote, avantTom.cote + ecartDeTom)
    // Joué des deux côtés, il n'attend plus personne : sa correction s'ouvre, sa page le dit — sa carte se retourne, une fois —, la revanche se lance.
    assert.equal((await lire(banc, lea, `/api/campagne/serie/${lance.corps.serie.id}/correction`)).status, 200)
    const joue = (await lire(banc, lea, `/api/campagne/duel/${code}`)).corps
    assert.equal(joue.corrige, true)
    assert.equal(joue.ecart, ecartDeLea)
    assert.equal(joue.aBattre, 5)
    assert.equal(joue.nouveau, true, 'vu pour la première fois : la page retourne sa carte')
    // Sa cote juste après, sa ligue, sa place — et sa semaine, que la carte du verdict dit en losanges.
    const { semaine, ...apres } = joue.apres
    assert.deepEqual(apres, { cote: COTE_DE_DEPART + ecartDeLea, ligue: ligueDe(COTE_DE_DEPART + ecartDeLea).cle, rang: 2 }, 'sa cote juste après, sa ligue, sa place')
    assert.deepEqual([semaine.duels, semaine.ligue], [1, ligueDe(Math.max(COTE_DE_DEPART, COTE_DE_DEPART + ecartDeLea)).cle], 'sa meilleure ligue de la semaine, celle d’avant comprise')
    // Les deux à la couleur de leur ligue d'après : Léa a maintenant la sienne.
    assert.equal(joue.auteur.ligue, ligueDe(COTE_DE_DEPART + ecartDeLea).cle)
    assert.equal(joue.contre.ligue, ligueDe(avantTom.cote + ecartDeTom).cle)
    assert.deepEqual(joue.revanche, { profileId: deTom, nom: 'Tom', avatar: '🐻' }, 'la revanche, d’un toucher')
    assert.equal((await lire(banc, lea, `/api/campagne/duel/${code}`)).corps.nouveau, undefined, 'vu : plus nouveau')
    assert.equal((await lire(banc, lea, '/api/duels')).corps.contre[0].nouveau, undefined)
    assert.equal((await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.duels.resultats, undefined, 'l’accueil ne le compte plus')
    assert.equal((await poster(banc, lea, '/api/campagne/duel', { adversaire: deTom })).status, 200, 'la revanche')
  } finally {
    await banc.close()
  }
})

test('un duel joué des deux côtés ne compte plus parmi les ouverts ; fermé, un duel commencé des deux côtés compte sur ce qu’il a atteint, jamais commencé, il ne compte pas', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
    const deTom = idDe(banc, 'tom')
    // Cinq duels contre Tom, joués des deux côtés l'un après l'autre : le sixième se lance encore.
    for (let i = 0; i < DUELS_OUVERTS_MAX; i++) {
      const d = await poster(banc, lea, '/api/campagne/duel', { adversaire: deTom })
      assert.equal(d.status, 200, d.corps.error)
      await jouer(banc, lea, d.corps.serie.id, 3)
      await jouer(banc, tom, (await poster(banc, tom, `/api/campagne/duel/${d.corps.code}`)).corps.id, 2)
      horloge.t += 60_000
    }
    assert.equal((await lire(banc, lea, '/api/duels')).corps.joues, DUELS_OUVERTS_MAX)

    // Hugo défie Léa et joue ; elle commence, s'arrête en route après deux bonnes réponses. Hugo défie aussi Tom, qui ne l'ouvre jamais.
    const contreLea = await poster(banc, hugo, '/api/campagne/duel', { adversaire: idDe(banc, 'lea') })
    await jouer(banc, hugo, contreLea.corps.serie.id, 5)
    await jouer(banc, lea, (await poster(banc, lea, `/api/campagne/duel/${contreLea.corps.code}`)).corps.id, 2, 2)
    const contreTom = await poster(banc, hugo, '/api/campagne/duel', { adversaire: deTom })
    await jouer(banc, hugo, contreTom.corps.serie.id, 5)
    // Ouvert, il ne compte pas encore : Léa peut le finir.
    assert.equal((await lire(banc, hugo, '/api/duels')).corps.joues, 0)
    // Fermé : celui que Léa a commencé compte, sur ses deux bonnes réponses ; celui que Tom n'a jamais ouvert, non.
    horloge.t += DUREE_D_UN_DUEL_MS + 60_000
    const deHugoApres = (await lire(banc, hugo, '/api/duels')).corps
    assert.equal(deHugoApres.joues, 1)
    assert.equal(deHugoApres.cote, COTE_DE_DEPART + ecartContre(COTE_DE_DEPART, (await coteAuLancement(banc, contreLea.corps.code)).adversaire, 0, 1))
    const ligne = deHugoApres.contre.find((d: any) => d.code === contreLea.corps.code)
    assert.deepEqual([ligne.justes, ligne.sesJustes, ligne.minutesRestantes], [5, 2, 0])
    assert.equal(deHugoApres.contre.find((d: any) => d.code === contreTom.corps.code).ecart, undefined, 'jamais ouvert : personne ne perd de points en dormant')
    assert.equal((await lire(banc, tom, '/api/duels')).corps.joues, DUELS_OUVERTS_MAX)
  } finally {
    await banc.close()
  }
})

/** Les deux cotes qu'un duel a figées à son lancement. */
async function coteAuLancement(banc: Banc, code: string): Promise<{ auteur: number; adversaire: number }> {
  return base(banc, db => {
    const r = db.prepare('SELECT cote_auteur, cote_adversaire FROM campagne_duels WHERE code = ?').get(code) as { cote_auteur: number; cote_adversaire: number }
    return { auteur: r.cote_auteur, adversaire: r.cote_adversaire }
  })
}

test('chercher quelqu’un par son prénom, l’ajouter à ses amis, le retirer : sa ligue et sa cote sur chaque ligne ; un retiré ne reçoit plus rien, sans que l’autre l’apprenne', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const leo = await inscrireProfil(banc.url, 'leo', 'Léo', '🐯')
    await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐸')
    const [deLea, deTom, deLeo, deZoe] = ['lea', 'tom', 'leo', 'zoe'].map(l => idDe(banc, l))
    // Léo a joué : sa ligue, sa cote et sa place.
    duelsJoues(banc, deLeo, 4, 12, 8, horloge.t - JOUR_MS)
    const coteDeLeo = (await lire(banc, leo, '/api/duels')).corps.cote

    // « le », sans les accents : Léa et Léo — le prénom qui commence par le texte d'abord ; pas Tom lui-même.
    const trouves = (await lire(banc, tom, `/api/duels/joueurs?q=${encodeURIComponent('le')}`)).corps
    assert.deepEqual(
      trouves.map((j: any) => j.nom),
      ['Léa', 'Léo'],
    )
    // Et ce qu'il porte, comme au classement : sa bordure de ligue, quatre victoires en bronze.
    assert.deepEqual(
      trouves.find((j: any) => j.nom === 'Léo'),
      { profileId: deLeo, nom: 'Léo', avatar: '🐯', bordure: { ligue: 'bronze', crans: 4 }, cote: coteDeLeo, ligue: ligueDe(coteDeLeo).cle, rang: 1 },
    )
    assert.deepEqual(
      trouves.find((j: any) => j.nom === 'Léa'),
      { profileId: deLea, nom: 'Léa', avatar: '🦊' },
      'aucun duel classé : ni ligue ni cote — l’absence, pas une ligue de bronze',
    )
    assert.deepEqual((await lire(banc, tom, '/api/duels/joueurs?q=to')).corps, [], 'lui-même ne se trouve pas')
    assert.deepEqual((await lire(banc, tom, '/api/duels/joueurs?q=l')).corps, [], 'une lettre ne suffit pas')
    // Un masqué ne se trouve pas, ne s'ajoute pas, ne se défie pas.
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: deZoe, masque: true }, admin)).status, 200)
    assert.deepEqual((await lire(banc, tom, '/api/duels/joueurs?q=zoe')).corps, [])
    assert.equal((await poster(banc, tom, `/api/campagne/amis/${deZoe}/ajout`)).corps.error, 'Ce joueur est introuvable : cherche-le de nouveau')
    assert.equal((await poster(banc, tom, '/api/campagne/duel', { adversaire: deZoe })).corps.error, 'Ce joueur est introuvable : cherche-le de nouveau')

    // Tom ajoute Léo et Léa : sans demande ni attente, sa liste à lui — la plus haute cote d'abord.
    assert.equal((await poster(banc, tom, `/api/campagne/amis/${deLea}/ajout`)).status, 200)
    assert.equal((await poster(banc, tom, `/api/campagne/amis/${deLeo}/ajout`)).status, 200)
    assert.deepEqual((await lire(banc, tom, '/api/campagne/amis')).corps.amis, [
      { profileId: deLeo, nom: 'Léo', avatar: '🐯', bordure: { ligue: 'bronze', crans: 4 }, cote: coteDeLeo, ligue: ligueDe(coteDeLeo).cle, rang: 1 },
      { profileId: deLea, nom: 'Léa', avatar: '🦊' },
    ])
    assert.equal((await lire(banc, tom, '/api/duels/joueurs?q=leo')).corps[0].ami, true, 'la recherche dit qu’il est déjà son ami')
    assert.equal((await poster(banc, tom, `/api/campagne/amis/${deTom}/ajout`)).corps.error, 'Ce joueur est introuvable : cherche-le de nouveau')

    // Léa porte le blaireau de la forêt : sa ligne d'amie et sa ligne trouvée
    // le portent aussi. L'emoji seul lui donnait deux visages sur la même page
    // — une chouette dans « Tes amis », son portrait au classement
    // (l'experte du jeu solo, le 11 octobre 2026).
    base(banc, db =>
      db
        .prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)')
        .run(deLea, 'foret', 5, Date.now()),
    )
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'br:blaireau' }, lea, 'PUT')).status, 200)
    assert.equal((await lire(banc, tom, '/api/campagne/amis')).corps.amis.find((a: any) => a.profileId === deLea).legendaire, 'br:blaireau')
    assert.equal((await lire(banc, tom, '/api/duels/joueurs?q=lea')).corps[0].legendaire, 'br:blaireau')

    // Léa retire Tom : le duel qu'il lui lance part — sa fin le dit —, mais ne lui parvient pas.
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${deTom}/retrait`)).status, 200)
    const retenu = await poster(banc, tom, '/api/campagne/duel', { adversaire: deLea })
    assert.equal(retenu.status, 200, retenu.corps.error)
    const fin = await jouer(banc, tom, retenu.corps.serie.id, 3)
    assert.deepEqual(fin.partiA, ['Léa'], 'celui qui défie n’apprend pas qu’on l’a retiré')
    assert.deepEqual((await lire(banc, lea, '/api/campagne/amis')).corps.recus, [])
    assert.deepEqual((await lire(banc, lea, '/api/duels')).corps.contre, [])
    assert.equal((await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.duels.defisRecus, undefined)
    // Le duel retenu tient la paire : on lui dit quoi faire pour le recevoir — jamais « relève son duel », qu'elle ne voit nulle part.
    assert.equal(
      (await poster(banc, lea, '/api/campagne/duel', { adversaire: deTom })).corps.error,
      'Tom t’a déjà défié : remets ce profil dans tes amis pour recevoir son duel',
    )
    // Rajouté, il revient — et son duel retenu l'attend, en tête de ses duels.
    horloge.t += 60_000
    assert.equal((await poster(banc, lea, `/api/campagne/amis/${deTom}/ajout`)).status, 200)
    assert.deepEqual(
      (await lire(banc, lea, '/api/campagne/amis')).corps.amis.map((a: any) => a.nom),
      ['Tom'],
    )
    assert.deepEqual(
      (await lire(banc, lea, '/api/campagne/amis')).corps.recus.map((d: any) => [d.code, d.auteur.nom, d.classe, d.score]),
      [[retenu.corps.code, 'Tom', true, undefined]],
      'classé : son score se dévoile à sa dernière réponse',
    )
    assert.equal(
      (await poster(banc, lea, '/api/campagne/duel', { adversaire: deTom })).corps.error,
      'Tom t’a déjà défié : relève son duel d’abord, en tête de tes duels',
    )

    // Tant que celui qui défie n'a pas fini sa partie, il le dit à chacun.
    const enRoute = await poster(banc, leo, '/api/campagne/duel', { adversaire: deTom })
    assert.equal(enRoute.status, 200, enRoute.corps.error)
    assert.equal(
      (await poster(banc, leo, '/api/campagne/duel', { adversaire: deTom })).corps.error,
      'Tu as déjà un duel en cours contre Tom : finis-le, il partira à ta dernière réponse',
    )
    assert.equal((await poster(banc, tom, '/api/campagne/duel', { adversaire: deLeo })).corps.error, 'Léo t’a déjà défié : son duel t’arrivera à sa dernière réponse')
    // Joué jusqu'au bout, il attend Tom : Léo le sait.
    await jouer(banc, leo, enRoute.corps.serie.id, 2)
    assert.equal((await poster(banc, leo, '/api/campagne/duel', { adversaire: deTom })).corps.error, 'Tu as déjà un duel en cours contre Tom : il attend d’être joué')
  } finally {
    await banc.close()
  }
})

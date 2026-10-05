// La base de la campagne grandit chaque matin : la routine de la réserve du
// quiz du jour lit la commande du jour — par catégorie, ce qu'il reste à
// écrire, les sous-thèmes et les difficultés qui manquent, et la consigne —,
// puis dépose ses questions, derrière le même jeton (`RESERVE_TOKEN`).
//
// Le serveur relit chaque question avec le juge de la base, écarte les
// doublons — la base, la réserve du quiz du jour, les quiz livrés —, tient
// un plafond par catégorie et par jour, et range le reste dans Turso : elles
// se jouent tout de suite, sans déploiement, et survivent au réveil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import {
  CIBLE_DES_DIFFICULTES,
  PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR,
  QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR,
  commandeDeLaCategorie,
  consigneDEcriture,
} from '../src/core/consigneCampagne'
import { SERVEUR } from '../src/racine'
import { CATEGORIES } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'

const JETON = 'jeton-de-la-reserve-pour-les-tests-0123456789'

/** Ce que fait la routine : son jeton en en-tête, et l'en-tête de toute écriture de l'application. */
function routine(banc: Banc, chemin: string, { corps, jeton = JETON }: { corps?: unknown; jeton?: string | null } = {}) {
  return fetch(`${banc.url}${chemin}`, {
    method: corps === undefined ? 'GET' : 'POST',
    headers: {
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
      ...(corps !== undefined && { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' }),
    },
    ...(corps !== undefined && { body: JSON.stringify(corps) }),
  }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Une entrée telle qu'une IA l'écrit d'après la consigne, sans identifiant. */
function entree(texte: string, { categorie = 'Nature', sousTheme = 'oiseaux', difficulte = 4 } = {}) {
  const mauvaises = ['Le merle', 'La mésange', 'Le moineau']
  return {
    texte,
    reponses: ['Le pic vert', ...mauvaises],
    bonne: 0,
    anecdote: 'Il tambourine sur les troncs pour marquer son territoire.',
    categorie,
    sousTheme,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: [...mauvaises, 'Le geai', 'La pie', 'Le rouge-gorge'],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  }
}

const oiseaux = (n: number, depuis = 0) => Array.from({ length: n }, (_, i) => entree(`Quel oiseau de nos forêts porte le numéro ${depuis + i} ?`))

async function avecBanc(opts: { jetonDeLaReserve?: string }, scenario: (banc: Banc) => Promise<void>) {
  // Trente questions d'Histoire, toutes du premier sous-thème : la commande les évite.
  const banc = await demarrer({ ...opts, baseDeLaCampagne: baseDEssai(30, { categories: ['Histoire'] }) })
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

// ── La commande, pure ───────────────────────────────────────────────────────

test('la commande d’une catégorie va aux sous-thèmes les moins fournis et aux difficultés qui manquent', () => {
  // Rien encore : cinq sous-thèmes différents, dans l'ordre du catalogue.
  const vide = commandeDeLaCategorie('Nature', [], 5)
  assert.equal(vide.reduce((n, q) => n + q.n, 0), 5)
  assert.deepEqual(
    vide.map(q => q.cle),
    SOUS_THEMES.Nature.slice(0, 5).map(s => s.cle),
  )
  // Une base pleine de faciles dans un seul sous-thème : ni lui, ni des faciles.
  const faciles = Array.from({ length: 40 }, () => ({ sousTheme: 'mammiferes', difficulte: 1 }))
  const commande = commandeDeLaCategorie('Nature', faciles, 5)
  assert.ok(commande.every(q => q.cle !== 'mammiferes'), JSON.stringify(commande))
  assert.ok(commande.every(q => q.difficulte! >= 3), 'les faciles ne manquent pas')
  // Sur la durée, la base tend vers la cible.
  const existantes: { sousTheme: string; difficulte: number }[] = []
  for (let jour = 0; jour < 40; jour++) {
    for (const q of commandeDeLaCategorie('Sport', existantes, 5)) for (let i = 0; i < q.n; i++) existantes.push({ sousTheme: q.cle, difficulte: q.difficulte! })
  }
  for (const d of [1, 2, 3, 4, 5]) {
    const part = existantes.filter(q => q.difficulte === d).length / existantes.length
    assert.ok(Math.abs(part - CIBLE_DES_DIFFICULTES[d]) < 0.02, `difficulté ${d} : ${part}`)
  }
  const parSousTheme = new Map<string, number>()
  for (const q of existantes) parSousTheme.set(q.sousTheme, (parSousTheme.get(q.sousTheme) ?? 0) + 1)
  assert.ok(Math.max(...parSousTheme.values()) - Math.min(...parSousTheme.values()) <= 1, 'les sous-thèmes au même pas')
})

test('la consigne de la routine dit la difficulté de chaque question, sans chemin de la machine du serveur', () => {
  const consigne = consigneDEcriture('Nature', [{ cle: 'oiseaux', n: 2, difficulte: 4 }, { cle: 'plantes', n: 1, difficulte: 5 }], { sorte: 'routine' }, [
    'Quel oiseau pond dans le nid des autres ?',
  ])
  assert.match(consigne, /3 QUESTIONS À ÉCRIRE, CATÉGORIE « Nature »/)
  assert.match(consigne, /^- oiseaux \(Oiseaux\) : 2 questions de difficulté 4$/m)
  assert.match(consigne, /^- plantes \(Plantes, arbres et champignons\) : 1 question de difficulté 5$/m)
  assert.match(consigne, /le fichier que te nomme ta mission/)
  assert.match(consigne, /^- Quel oiseau pond dans le nid des autres \?$/m)
  assert.doesNotMatch(consigne, /environ 10 % de 1/, 'la commande fixe la difficulté : pas de répartition à deviner')
  assert.ok(!consigne.includes(SERVEUR), 'la routine tourne dans son clone du dépôt, pas sur le serveur')
})

// ── La porte et le dépôt ─────────────────────────────────────────────────────

test('sans jeton posé, la porte de la base n’existe pas ; un mauvais jeton est refusé', () =>
  avecBanc({}, async banc => {
    const ferme = await routine(banc, '/api/campagne/base')
    assert.equal(ferme.status, 404)
    assert.equal(ferme.corps.error, 'Le dépôt automatique n’est pas ouvert sur ce serveur')
  }).then(() =>
    avecBanc({ jetonDeLaReserve: JETON }, async banc => {
      assert.equal((await routine(banc, '/api/campagne/base', { jeton: null })).status, 401)
      assert.equal((await routine(banc, '/api/campagne/base', { jeton: 'faux' })).status, 401)
      assert.equal((await routine(banc, '/api/campagne/base', { jeton: 'faux', corps: { categorie: 'Nature', entrees: oiseaux(1) } })).status, 401)
      // Sans l'en-tête de toute écriture, refusé comme n'importe quelle requête forgée.
      const forge = await fetch(`${banc.url}/api/campagne/base`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${JETON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorie: 'Nature', entrees: oiseaux(1) }),
      })
      assert.equal(forge.status, 403)
    }),
  ))

test('la commande du jour : cinq questions par catégorie, chacune sa consigne', () =>
  avecBanc({ jetonDeLaReserve: JETON }, async banc => {
    const { status, corps } = await routine(banc, '/api/campagne/base')
    assert.equal(status, 200)
    assert.equal(corps.aEcrire, CATEGORIES.length * QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR)
    assert.deepEqual(
      corps.categories.map((c: any) => c.categorie),
      [...CATEGORIES],
    )
    const histoire = corps.categories.find((c: any) => c.categorie === 'Histoire')
    assert.equal(histoire.aEcrire, QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR)
    // Ses trente questions sont toutes dans le premier sous-thème : la commande va ailleurs.
    assert.ok(!histoire.quotas.some((q: any) => q.cle === SOUS_THEMES.Histoire[0].cle), JSON.stringify(histoire.quotas))
    assert.ok(histoire.quotas.every((q: any) => q.difficulte >= 3), 'une base où chaque difficulté a sa part : les dures d’abord')
    assert.match(histoire.consigne, /QUESTIONS À ÉCRIRE, CATÉGORIE « Histoire »/)
  }))

test('le dépôt : relu par le juge de la base, les doublons écartés, le reste jouable tout de suite et gardé au réveil', () =>
  avecBanc({ jetonDeLaReserve: JETON }, async banc => {
    const admin = await connexionAnimateur(banc.url)
    // Une question de la réserve du quiz du jour (amorcée par les quiz livrés).
    const duJour = 'Combien de pattes a une araignée ?'
    const depot = await routine(banc, '/api/campagne/base', {
      corps: {
        categorie: 'Nature',
        entrees: [
          ...oiseaux(9),
          entree('Quel oiseau de nos forêts porte le numéro 0 ?'),
          entree('Quel oiseau des villes niche sous les toits ?', { categorie: 'Géographie', sousTheme: 'capitales' }),
          { ...entree('Quel oiseau migrateur revient au printemps ?'), confiance: 2 },
          entree(duJour),
          entree("Question d'essai numéro 3 : laquelle est la bonne ?"),
        ],
      },
    })
    assert.equal(depot.status, 200, depot.corps.error)
    assert.equal(depot.corps.ajoutees, 9)
    const motifs = depot.corps.ecartees.map((e: any) => e.motif)
    assert.equal(motifs.length, 5, JSON.stringify(motifs))
    assert.ok(motifs.includes('deux fois dans ce dépôt'))
    assert.ok(motifs.some((m: string) => m.startsWith('d’une autre catégorie (Géographie)')))
    assert.ok(motifs.some((m: string) => /confiance 2/.test(m)), 'le juge de la base : une question sûre seulement')
    assert.ok(motifs.some((m: string) => /réserve du quiz du jour|quiz livré/.test(m)))
    assert.ok(motifs.includes('déjà dans la base'))

    // Jouable tout de suite : la base d'essai n'a rien en Nature, une série
    // de Nature tire donc les questions déposées — il en faut dix.
    const encore = await routine(banc, '/api/campagne/base', { corps: { categorie: 'Nature', entrees: [entree('Quel oiseau de nos forêts porte le numéro 99 ?')] } })
    assert.equal(encore.corps.ajoutees, 1)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const serie = await ecrire(banc.url, '/api/campagne/serie', { categories: ['Nature'] }, alice).then(r => r.json() as any)
    assert.match(serie.question.texte, /^Quel oiseau de nos forêts porte le numéro \d+ \?$/)

    // Le plafond du jour : dix par catégorie, pas une de plus.
    const trop = await routine(banc, '/api/campagne/base', { corps: { categorie: 'Nature', entrees: oiseaux(2, 50) } })
    assert.equal(trop.corps.ajoutees, 0)
    assert.deepEqual(
      trop.corps.ecartees.map((e: any) => e.motif),
      Array(2).fill(`la catégorie a reçu ses ${PLAFOND_PAR_CATEGORIE_ET_PAR_JOUR} questions du jour`),
    )
    // La commande le sait : la Nature a son compte, les autres non.
    const commande = (await routine(banc, '/api/campagne/base')).corps
    const nature = commande.categories.find((c: any) => c.categorie === 'Nature')
    assert.equal(nature.aEcrire, 0)
    assert.equal(nature.consigne, null)
    assert.equal(commande.aEcrire, (CATEGORIES.length - 1) * QUESTIONS_PAR_CATEGORIE_ET_PAR_JOUR)

    // Le quiz du jour, lui, n'en reprend aucune.
    const liste = ['# Nature', '', 'Quel oiseau de nos forêts porte le numéro 3 ?', '* Le pic vert', 'Le merle', 'La mésange', 'Le moineau'].join('\n')
    const jour = await routine(banc, '/api/jour/reserve', { corps: { liste } })
    assert.equal(jour.corps.ajoutees, 0)
    assert.deepEqual(
      jour.corps.ecartees.map((e: any) => e.raison),
      ['déjà dans la campagne'],
    )

    // L'administration voit ce que la routine a déposé, et peut le retirer.
    const etat = (await lire(banc, admin, '/api/admin/campagne')).corps
    assert.equal(etat.ajouts.total, 10)
    assert.equal(etat.ajouts.aujourdhui, 10)
    assert.equal(etat.ajouts.derniers[0].texte, 'Quel oiseau de nos forêts porte le numéro 99 ?')
    assert.equal(etat.parDifficulte.find((c: any) => c.categorie === 'Nature').difficultes[3], 10)
    const retiree = etat.ajouts.derniers[0].id
    assert.equal((await ecrire(banc.url, '/api/admin/campagne/retirer', { questionId: retiree }, admin)).status, 200)
    // /healthz le dit, sans un intitulé.
    const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as any
    assert.equal(sante.campagne.ajoutees, 10)
    assert.equal(typeof sante.campagne.dernierApport, 'number')

    // Au réveil, tout est là : rangé dans la base permanente, la retirée comprise.
    await banc.redemarrer({ disqueEfface: true })
    const apres = (await lire(banc, await connexionAnimateur(banc.url), '/api/admin/campagne')).corps
    assert.equal(apres.ajouts.total, 10)
    assert.equal(apres.ajouts.derniers.find((a: any) => a.id === retiree).retiree, true)
    assert.equal(apres.parCategorie.find((c: any) => c.categorie === 'Nature').questions, 9, 'la retirée ne se joue plus')
  }))

test('un dépôt trop gros, ou d’une catégorie inconnue, est refusé en entier', () =>
  avecBanc({ jetonDeLaReserve: JETON }, async banc => {
    const gros = await routine(banc, '/api/campagne/base', { corps: { categorie: 'Nature', entrees: oiseaux(41) } })
    assert.equal(gros.status, 400)
    assert.match(gros.corps.error, /40 questions au plus par envoi/)
    const inconnue = await routine(banc, '/api/campagne/base', { corps: { categorie: 'Astrologie', entrees: oiseaux(1) } })
    assert.equal(inconnue.status, 400)
    assert.equal(inconnue.corps.error, 'Catégorie inconnue : Astrologie')
    assert.equal((await routine(banc, '/api/campagne/base', { corps: { categorie: 'Nature' } })).status, 400)
  }))

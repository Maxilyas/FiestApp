// La niche du compagnon (le choix du 18 octobre 2026,
// `retours/2026-10-16/compagnon/principe.md`) : il vit dans sa niche, en haut
// de chaque page du téléphone, et c'est lui qui grandit — qu'on le porte en
// avatar ou non : « porter un médaillon ne fait grandir personne ». Adopté, il
// s'y installe ; on l'y change d'un geste ; ce qu'on porte ne la fait plus
// bouger (le 19 octobre 2026 : sa gestion, `ma-niche.test.ts`). La toucher
// ouvre sa fiche, une bulle sous elle (le 20 octobre 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import {
  attendre,
  baseDEssai,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { avecLui, compagnon, compagnonDeLaNiche } from '../../shared/compagnons'
import { CATEGORIES } from '../../shared/categories'
import React from 'react'

ProfileStore.tirageEclat = () => false

// ── La règle, pure ────────────────────────────────────────────────────────

test('le compagnon de la niche : celui qu’on y a installé, sinon le plus grand — jamais ce qu’on porte', () => {
  assert.equal(compagnonDeLaNiche(null, []), null, 'sans compagnon, pas de niche')
  const possedes = [
    { compagnon: 'loup', rang: 1 },
    { compagnon: 'chat', rang: 3 },
    { compagnon: 'tortue', rang: 3 },
  ] as const
  assert.equal(compagnonDeLaNiche('loup', possedes), 'loup', 'installé, il y reste')
  assert.equal(compagnonDeLaNiche(null, possedes), 'chat', 'sinon le plus grand, le premier du catalogue à égalité')
  assert.equal(compagnonDeLaNiche('dragon', possedes), 'chat', 'un nom inconnu ne compte pas')
  assert.equal(compagnonDeLaNiche('loup', [{ compagnon: 'tortue', rang: 0 }]), 'tortue', 'ni un compagnon qu’il n’a pas')
  // Ce qui le fait grandir se dit à son genre.
  assert.equal(avecLui(compagnon('loup')!), 'avec lui')
  assert.equal(avecLui(compagnon('tortue')!), 'avec elle')
})

// ── La niche, au téléphone ────────────────────────────────────────────────

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

test('la page pose la niche de son compagnon, et rien sans compagnon : ni niche, ni place gardée', async () => {
  // Un téléphone sans navigateur : la classe de la page et ce qu'il retient.
  const classes = new Set<string>()
  const retenu = new Map<string, string>()
  Object.assign(globalThis, {
    document: { body: { classList: { toggle: (c: string, oui: boolean) => (oui ? classes.add(c) : classes.delete(c), oui) } } },
    localStorage: { getItem: (k: string) => retenu.get(k) ?? null, setItem: (k: string, v: string) => retenu.set(k, v), removeItem: (k: string) => retenu.delete(k) },
  })
  const niche = await import(client('niche.ts'))
  let appels = 0
  niche.abonnerNiche(() => appels++)

  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'chat', rang: 3 }, { compagnon: 'loup', rang: 2 }] })
  assert.deepEqual(niche.nicheActuelle(), { compagnon: 'loup', rang: 2 }, 'à sa plus haute forme')
  assert.ok(classes.has('avec-niche'), 'la page lui garde son coin')
  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 2 }] })
  assert.equal(appels, 1, 'la même niche ne refait rien')

  // Retenue pour le prochain démarrage : sa place est gardée avant que le profil ne soit relu.
  niche.porterNiche(null)
  assert.equal(niche.nicheActuelle(), null)
  assert.ok(!classes.has('avec-niche'), 'l’invité anonyme : la ligne va jusqu’au bord')
  niche.porterNiche({ niche: 'tortue', compagnons: [{ compagnon: 'tortue', rang: 0 }] })
  niche.porterNiche({ niche: 'loup' })
  assert.equal(niche.nicheActuelle(), null, 'un compagnon qu’il n’a pas : rien')
  retenu.set('quizz.niche', JSON.stringify({ compagnon: 'tortue', rang: 1 }))
  niche.poserNicheRetenue()
  assert.deepEqual(niche.nicheActuelle(), { compagnon: 'tortue', rang: 1 })
  for (const abime of ['{', JSON.stringify({ compagnon: 'loup', rang: 9 }), JSON.stringify({ rang: 1 })]) {
    retenu.set('quizz.niche', abime)
    niche.poserNicheRetenue()
    assert.equal(niche.nicheActuelle(), null, abime)
  }
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'localStorage')
})

/** La niche, ou sa fiche, rendues telles que la page les montre. */
async function niche(composant: 'Niche' | 'FicheDeLaNiche', props: object): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(client('components/Niche.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Une règle de la feuille de styles, par son sélecteur exact. */
function regle(selecteur: string): string {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const debut = css.indexOf(`\n${selecteur} {`)
  assert.ok(debut >= 0, `la règle ${selecteur}`)
  return css.slice(debut, css.indexOf('}', debut) + 1)
}

test('la niche : son décor peint, lui en buste tourné vers la page — sa fiche, une bulle : sa forme, sa jauge, « Le caresser », « Chez lui »', async () => {
  const { DESSINS } = await import(client('components/compagnons-peints.ts'))
  const adulte = await niche('Niche', { compagnon: 'loup', rang: 2 })
  assert.match(adulte, /<button type="button" class="niche niche-loup" aria-label="Le loup adulte, dans ta niche : sa fiche" aria-haspopup="dialog">/)
  assert.ok(adulte.includes(`background-image:url(${DESSINS['cp:loup-adulte'].disque[1]})`), 'le décor de son avatar : la pleine lune')
  assert.ok(adulte.includes(`src="${DESSINS['cp:loup-adulte'].perso[0]}"`), 'son dessin en grand : il est agrandi dans la niche')
  assert.match(adulte, /class="niche-bete miroir"/, 'le loup regarde la page')
  // La première forme n'a pas de décor peint : le ciel de son compagnon.
  assert.match(await niche('Niche', { compagnon: 'tortue', rang: 0 }), /class="niche-decor niche-ciel niche-ciel-tortue"/)
  assert.match(await niche('Niche', { compagnon: 'tortue', rang: 0 }), /class="niche-bete"/, 'la tortue la regarde déjà')
  // Une forme que le catalogue ne connaît pas : rien plutôt qu'un cadre vide.
  assert.equal(await niche('Niche', { compagnon: 'dragon', rang: 1 }), '')

  // Sa fiche, une bulle sous elle (le 20 octobre 2026, « un truc plus soft »), nommée par lui.
  const fiche = await niche('FicheDeLaNiche', { niche: { compagnon: 'loup', rang: 2 }, onFermer: () => {} })
  const titre = /role="dialog" aria-modal="true" aria-labelledby="([^"]+)"/.exec(fiche)?.[1]
  assert.ok(titre, 'un dialogue, nommé par son nom')
  assert.ok(fiche.includes(`<b id="${titre}" class="niche-fiche-nom">Le loup adulte</b>`))
  assert.match(fiche, /Troisième forme · épique/)
  assert.ok(fiche.includes(`src="${DESSINS['cp:loup-adulte'].perso[0]}"`), 'lui en grand, qu’on caresse en le touchant')
  assert.match(fiche, />Le caresser<\/button>/)
  assert.match(fiche, /<a class="chez-pastille" href="\/profil#compagnon"><svg[^>]*>.*?<\/svg>Chez lui<\/a>/)
  // Sa jauge et ses envies du jour se lisent à l'ouverture : leur place est gardée en attendant.
  assert.match(fiche, /<div class="niche-fiche-jauge" aria-live="polite"><span class="niche-fiche-petit">…<\/span><\/div>/)
  assert.match(fiche, /<p class="niche-fiche-jour"><span class="niche-fiche-petit">…<\/span><\/p>/)
  // Ce qui le fait grandir, et sans avantage : « Comment ça marche », sur sa page — la bulle ne le redit plus.
  const { CommentCaMarche } = await import(client('components/MonCompagnon.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const regles = renderToStaticMarkup(React.createElement(CommentCaMarche, { c: compagnon('loup'), complicite: 0, trouvees: 0 }))
  assert.match(regles, /Chaque bonne réponse le nourrit — en soirée, au quiz du jour, en campagne\./)
  assert.match(regles, /Ni ses formes ni ses trouvailles ne donnent d’avantage de jeu\./)
})

test('sa fiche sort de la niche : la niche passe au-dessus d’un voile léger, qui ne laisse aucun geste à la page et s’assombrit par sa couleur', () => {
  const voile = regle('.niche-fiche-voile')
  assert.match(voile, /touch-action: none;/)
  assert.match(voile, /animation: voile-tombe /, 'au pas de la bulle, par sa couleur')
  assert.doesNotMatch(voile, /opacity/)
  const niveau = (r: string) => Number(/z-index: (\d+);/.exec(r)?.[1])
  assert.ok(niveau(regle('.niche.ouverte')) > niveau(voile), 'la niche, au-dessus : on voit d’où sort la bulle')
  assert.ok(niveau(voile) > niveau(regle('.menu-barre')), 'le voile couvre la barre du menu')
  // Opaque dès sa première image : la bulle grandit, elle ne se fond pas.
  assert.doesNotMatch(regle('.niche-fiche'), /opacity/)
  assert.match(regle('.niche-fiche'), /background: [^;]*#1a1412;/, 'un sol plein, qu’aucun thème ne repeint')
})

/** Le rayon des compagnons, rendu pour ce profil. */
async function rayon(profil: object, installer?: (cle: string) => void): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(new URL('../../client/src/components/RayonDesCompagnons.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.RayonDesCompagnons, { profil, busy: false, acheter: async () => null, installer }))
}

test('la boutique dit qui vit dans sa niche, et installe les autres d’un toucher', async () => {
  const boutique = {
    confettis: { gagnes: 0, depenses: 0, solde: 0 },
    possedes: [],
    porte: null,
    jour: '2026-10-18',
    compagnons: [
      { compagnon: 'loup', rang: 1, justes: 162 },
      { compagnon: 'tortue', rang: 0, justes: 0 },
    ],
  }
  const html = await rayon({ legendaire: 'cp:tortue-bebe', niche: 'loup', boutique }, () => {})
  assert.equal(html.match(/Dans ta niche\s: c’est lui qui grandit/g)?.length, 1, 'le loup, et lui seul')
  assert.equal(html.match(/>L’installer dans ma niche<\/button>/g)?.length, 1, 'la tortue, adoptée : de quoi l’y installer')
  assert.match(html, /Il vit dans ta niche, en haut de chaque page/)
  // Une page qui ne sait pas l'enregistrer ne propose rien.
  assert.doesNotMatch(await rayon({ legendaire: null, niche: 'loup', boutique }), /L’installer dans ma niche/)
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
/** Douze questions de chacune des douze catégories : de quoi jouer une série. */
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, jour: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`,
      )
      .run(profileId, jour, justes),
  )
}

const lire = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
const lireLeger = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile
const acheter = (banc: Banc, cookie: string, compagnon: string) =>
  ecrire(banc.url, '/api/joueur/compagnons', { compagnon }, cookie).then(async r => ({
    status: r.status,
    corps: (await r.json()) as any,
  }))
const changer = (banc: Banc, cookie: string, patch: object) =>
  ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Les questions de sa série, lues en base : le téléphone ne voit jamais la bonne avant sa réponse. */
function bonnes(banc: Banc, serie: string): number[] {
  return enBase(banc, db => {
    const { questions } = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(questions) as { bonne: number }[]).map(q => q.bonne)
  })
}

test('adopté, il s’installe dans la niche ; on l’y change d’un geste — un compagnon à soi, et rien d’autre', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    assert.equal((await lire(banc, cookie)).niche, undefined, 'sans compagnon, pas de niche : rien à lire')
    confettis(banc, alice, '2026-09-20', 3000)

    const loup = await acheter(banc, cookie, 'loup')
    assert.equal(loup.status, 200, loup.corps.error)
    assert.equal(loup.corps.profile.niche, 'loup', 'adopté, il s’installe')
    // Il le porte en avatar, de lui-même : l'adoption ne le fait plus (`ma-niche.test.ts`).
    assert.equal((await changer(banc, cookie, { legendaire: 'cp:loup-louveteau' })).status, 200)
    // Le chat, adopté : il s'installe à son tour, le loup reste sur lui.
    const chat = await acheter(banc, cookie, 'chat')
    assert.equal(chat.corps.profile.niche, 'chat')
    assert.equal(chat.corps.profile.legendaire, 'cp:loup-louveteau')

    // Le loup y revient d'un geste ; ce qu'il n'a pas est refusé en clair.
    assert.equal((await changer(banc, cookie, { niche: 'loup' })).corps.profile.niche, 'loup')
    const tortue = await changer(banc, cookie, { niche: 'tortue' })
    assert.equal(tortue.status, 400)
    assert.equal(tortue.corps.error, 'La Tortue-île s’achète d’abord, à la boutique')
    assert.equal((await changer(banc, cookie, { niche: 'dragon' })).corps.error, 'Ce compagnon n’existe pas')
    assert.equal((await changer(banc, cookie, { niche: 42 })).corps.error, 'Ce compagnon n’existe pas')
    // Un essai refusé n'écrit rien du reste : tout passe ou rien (la loge).
    assert.equal((await changer(banc, cookie, { niche: 'tortue', legendaire: 'cp:chat-chaton' })).status, 400)
    assert.equal((await lire(banc, cookie)).legendaire, 'cp:loup-louveteau')

    // Porter le chat ne l'installe pas : le loup reste dans la niche.
    const porte = await changer(banc, cookie, { legendaire: 'cp:chat-chaton' })
    assert.equal(porte.corps.profile.legendaire, 'cp:chat-chaton')
    assert.equal(porte.corps.profile.niche, 'loup')
    // Les pages de jeu le lisent dans le profil léger.
    assert.equal((await lireLeger(banc, cookie)).niche, 'loup')

    // Rendue à la règle : le plus grand des siens, le premier du catalogue à égalité — pas le chat qu'il porte.
    assert.equal((await changer(banc, cookie, { niche: null })).corps.profile.niche, 'loup')
    assert.equal(enBase(banc, db => (db.prepare('SELECT niche FROM profiles WHERE id = ?').get(alice) as { niche: string | null }).niche), null)

    // Ce qu'il choisit s'écrit en base : un réveil le garde.
    assert.equal((await changer(banc, cookie, { niche: 'loup' })).status, 200)
    await banc.redemarrer({ disqueEfface: true })
    assert.equal((await lire(banc, cookie)).niche, 'loup')
  }))

// Une niche jamais choisie, d'avant le 19 octobre 2026 : figée au démarrage sur
// ce qu'il portait (`ma-niche.test.ts`) — changer d'avatar ne la déplace plus.

test('c’est le compagnon de sa niche qui grandit, qu’il le porte ou non — en campagne et au quiz du jour', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 2000)
    assert.equal((await acheter(banc, cookie, 'loup')).status, 200)
    assert.equal((await changer(banc, cookie, { legendaire: 'cp:loup-louveteau' })).status, 200)
    assert.equal((await acheter(banc, cookie, 'chat')).status, 200)
    // Il porte le loup ; le chat est dans sa niche.

    // Une série : deux justes, une fausse.
    const s = (await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as any
    assert.ok(s.id, s.error)
    const reponses = bonnes(banc, s.id)
    for (const [i, juste] of [true, true, false].entries()) {
      const r = await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: juste ? reponses[i] : (reponses[i] + 1) % 2 }, cookie)
      assert.equal(r.status, 200)
    }
    assert.deepEqual(
      enBase(banc, db => db.prepare('SELECT DISTINCT compagnon FROM campagne_reponses WHERE serie_id = ?').all(s.id)),
      [{ compagnon: 'chat' }],
      'chaque réponse retient le compagnon de sa niche, pas celui qu’il porte',
    )

    // Le quiz du jour, tout juste.
    let etat = (await (await ecrire(banc.url, '/api/jour/commencer', {}, cookie)).json()) as any
    const questions = enBase(banc, db =>
      JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
    ) as { bonne: number }[]
    while (etat.question) {
      const r = await ecrire(banc.url, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: questions[etat.question.index].bonne }, cookie)
      assert.equal(r.status, 200)
      etat = await (await ecrire(banc.url, '/api/jour/suivante', {}, cookie)).json()
    }
    assert.deepEqual(
      enBase(banc, db => db.prepare('SELECT DISTINCT compagnon FROM jour_reponses WHERE profile_id = ?').all(alice)),
      [{ compagnon: 'chat' }],
    )
    // Deux justes en campagne, dix au quiz du jour : au chat, rien au loup qu'il porte.
    assert.deepEqual((await lire(banc, cookie)).boutique.compagnons, [
      { compagnon: 'loup', rang: 0, justes: 0 },
      { compagnon: 'chat', rang: 0, justes: 12 },
    ])
  }))

test('en soirée aussi : la ligne de sa réponse retient le compagnon de sa niche, même sans le porter', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Le ciel est bleu ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    // Adoptée, la tortue vit dans sa niche ; Alice ne la porte pas.
    const tortue = await acheter(banc, aliceCookie, 'tortue')
    assert.equal(tortue.status, 200)
    assert.equal(tortue.corps.profile.legendaire, null)

    const host = await ecranCommun(banc.url, cookie)
    const aliceTel = await invite(banc.url, 'Alice', '', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
      attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    await vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la question')
    const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
    for (const [qui, choice] of [
      [aliceTel, 0],
      [bob, 1],
    ] as const) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, ack.error)
    }
    await revelee
    await patienter(200)
    const local = new Database(banc.dbPath)
    try {
      const lignes = local.prepare('SELECT player_id, compagnon FROM answer_log').all() as { player_id: string; compagnon: string | null }[]
      assert.deepEqual(
        lignes.map(l => `${l.player_id === aliceTel.playerId ? 'Alice' : 'Bob'} ${l.compagnon}`).sort(),
        ['Alice tortue', 'Bob null'],
        'la salle ne voit pas sa niche, mais sa bonne réponse la nourrit',
      )
    } finally {
      local.close()
    }
    // Ce que la salle voit de lui n'en dit rien.
    const instantane = await attendre<any>(host, 'party:snapshot', () => true, 'un instantané', 5000).catch(() => null)
    if (instantane) assert.ok(instantane.players.every((p: any) => !('niche' in p)), 'la niche ne part pas à la salle')
  }))

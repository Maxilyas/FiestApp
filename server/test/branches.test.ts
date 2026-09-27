// Les avatars du savoir : douze branches, une par catégorie de questions, six
// portraits dessinés dans chacune. Chaque bonne réponse d'une catégorie — en
// soirée comme au quiz du jour, celles qui font déjà les écussons — fait
// avancer sa branche ; chaque palier ouvre un portrait, qu'on porte comme un
// légendaire. Rien ne s'écrit : les portraits se lisent dans la carrière.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import React from 'react'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'
import { SEUILS_ECUSSON, ecussonsDe } from '../../shared/ecussons'
import {
  BRANCHES,
  PORTRAITS,
  SEUILS_BRANCHE,
  branche,
  ecussonDuSeuil,
  nomDansLaPhrase,
  ouvertsDansLaBranche,
  portrait,
  portraitsOuverts,
  portraitsOuvertsPar,
  prochainDansLaBranche,
  savoirDesEcussons,
} from '../../shared/branches'
import { cibleEclat } from '../../shared/legendaires'
import { gainVide, releveVide, totalGain } from '../../shared/profil'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

// L'Éclat se tire une chance sur quarante : ici, il ne tombe jamais.
ProfileStore.tirageEclat = () => false

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// ── 1. Le catalogue et la règle ───────────────────────────────────────────

test('douze branches, une par catégorie, six portraits chacune, du premier au sommet', () => {
  assert.deepEqual(
    BRANCHES.map(b => b.categorie),
    [...CATEGORIES],
    'une branche par catégorie, dans l’ordre de la liste fixe — celui des écussons',
  )
  for (const b of BRANCHES) {
    assert.equal(b.portraits.length, 6, b.nom)
    assert.deepEqual(
      b.portraits.map(p => p.seuil),
      [...SEUILS_BRANCHE],
    )
    for (const p of b.portraits) {
      assert.match(p.key, /^br:[a-z]+(-[a-z]+)*$/, p.key)
      assert.equal(portrait(p.key), p)
    }
  }
  assert.equal(new Set(PORTRAITS.map(p => p.key)).size, 72, 'soixante-douze clés, toutes différentes')
  // Un choix de produit, mesuré par `calibrage.ts` (RECOMPENSES.md, § 5.4) :
  // le premier dès la première soirée, le deuxième, le quatrième et le
  // sixième avec les écussons de bronze, d'argent et d'or.
  assert.deepEqual([...SEUILS_BRANCHE], [3, 20, 40, 75, 130, 200])
  assert.deepEqual([SEUILS_BRANCHE[1], SEUILS_BRANCHE[3], SEUILS_BRANCHE[5]], [...SEUILS_ECUSSON])
  assert.deepEqual([20, 75, 200, 40].map(ecussonDuSeuil), ['bronze', 'argent', 'or', null])
})

test('ses bonnes réponses ouvrent ses portraits : les écussons et les branches comptent au même endroit', () => {
  // Vingt-cinq en Nature le soir, trois en Histoire au quiz du jour.
  const savoir = savoirDesEcussons(ecussonsDe({ Nature: { justes: 25 } }, { Histoire: { justes: 3 } }))
  assert.deepEqual(portraitsOuverts(savoir), ['br:minotaure', 'br:ecureuil', 'br:blaireau'])
  const foret = branche('foret')!
  assert.equal(ouvertsDansLaBranche(foret, savoir), 2)
  assert.deepEqual(prochainDansLaBranche(foret, savoir), { portrait: portrait('br:lynx'), manque: 15 })
  assert.equal(prochainDansLaBranche(foret, { Nature: 200 }), null, 'la branche finie n’a plus rien à viser')
  // Ce qu'une soirée ouvre : avec ses réponses, pas sans elles.
  assert.deepEqual(portraitsOuvertsPar({ Nature: 18 }, { Nature: 41 }), ['br:blaireau', 'br:lynx'])
  assert.deepEqual(portraitsOuvertsPar({ Nature: 41 }, { Nature: 41 }), [])
  // Un nom dans une phrase : l'article en minuscule, un nom propre intact.
  assert.deepEqual(
    ['L’ours', 'La tortue de mer', 'Le Minotaure', 'Thor'].map(nomDansLaPhrase),
    ['l’ours', 'la tortue de mer', 'le Minotaure', 'Thor'],
  )
})

test('l’Éclat tombe sur le portrait qu’il porte, comme sur un légendaire — jamais sous un Divin', () => {
  assert.equal(cibleEclat('br:cerf', '🦊'), 'br:cerf')
  assert.equal(cibleEclat('lg:phenix', '🦊'), 'lg:phenix')
  assert.equal(cibleEclat('dv:seraphin', '🦊'), '🦊')
  assert.equal(cibleEclat(null, '🦊'), '🦊')
})

// ── 2. Les dessins ────────────────────────────────────────────────────────

test('sans le dessin de sa branche, un portrait porté rend l’emoji — et ne fait rien venir d’autre', async () => {
  // Aucune branche n'est encore chargée dans ce processus : l'emoji tient la
  // place, sans cercle de finition ni classe de portrait.
  const html = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'br:thor', finition: 'or' })
  assert.ok(html.includes('🦊'), html)
  assert.doesNotMatch(html, /av-portrait/)
  const m = await import(url('components/medaillons.ts'))
  assert.deepEqual(m.sortesDe(['br:thor', 'br:cerf', '🦊', 'lg:phenix']), ['legendaire', 'branche:mythes', 'branche:foret'])
  assert.deepEqual(m.sortesDe(['br:inconnu']), [], 'une clé inconnue ne demande rien')
})

test('chaque portrait a son dessin, dans le fichier de sa branche, et s’y tient', async () => {
  for (const b of BRANCHES) {
    const { DESSINS } = await import(url(`components/portraits/${b.key}.ts`))
    assert.deepEqual(Object.keys(DESSINS).sort(), b.portraits.map(p => p.key).sort(), `les six de ${b.nom}`)
    for (const [cle, d] of Object.entries<any>(DESSINS)) {
      const u = 'pt-essai-n-r1-'
      const svg = (d.defs?.(u) ?? '') + (d.decor?.(u) ?? '') + d.corps(u)
      assert.equal(d.fond.length, 3, `${cle} : un disque de trois teintes`)
      // Soixante-douze dessins dans le paquet d'une branche, vingt dans une salle.
      assert.ok(svg.length < 7000, `${cle} pèse ${svg.length} caractères`)
      assert.doesNotMatch(svg, /<(text|image|filter|animate|script|foreignObject)\b/, `${cle} : que des formes`)
      // Ses identifiants : le préfixe, puis des lettres — le tiret bas est au
      // cadre (`Portrait.tsx`). Chaque dégradé qu'il cite est à lui.
      const ids = [...svg.matchAll(/\bid="([^"]*)"/g)].map(x => x[1])
      for (const id of ids) assert.match(id, /^pt-essai-n-r1-[a-zA-Z]+$/, `${cle} : ${id}`)
      for (const [, ref] of svg.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.includes(ref), `${cle} : url(#${ref}) sans dégradé`)
      // Verrouillé, seul le corps se voit : il doit avoir de quoi faire une silhouette.
      assert.ok(d.corps(u).length > 300, `${cle} : un corps`)
    }
  }
})

test('porté, un portrait prend le cercle de sa finition ; éclaté, le ciel rare de sa branche ; à gagner, sa silhouette', async () => {
  await import(url('components/portraits/foret.ts'))
  const simple = await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf' })
  assert.match(simple, /aria-label="Le cerf"/)
  assert.match(simple, /<circle cx="50" cy="50" r="48"\/>/, 'découpé au bord du disque')
  assert.doesNotMatch(simple, /lg-cercle/)
  // En Mat, pas de cercle : l'emoji n'a pas de halo non plus.
  assert.doesNotMatch(await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf', finition: 'mat' }), /lg-cercle/)
  const or = await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf', finition: 'or' })
  assert.match(or, /class="lg-cercle lg-cercle-or"/)
  assert.match(or, /<circle cx="50" cy="50" r="45"\/>/, 'le cercle prend le bord')
  // Éclaté : la nuit violette de la forêt, pas l'automne qui noyait les roux.
  const eclate = await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf', eclat: true })
  assert.match(eclate, /aria-label="Le cerf, éclaté"/)
  assert.match(eclate, /stop-color="#b8a6ff"/)
  // À gagner : le corps en masque d'or, sans décor ni cercle, et pas d'Éclat.
  const verrou = await rendu('components/Portrait', 'Portrait', { cle: 'br:cerf', verrouille: true, eclat: true, finition: 'or' })
  assert.match(verrou, /aria-label="Le cerf — pas encore gagné"/)
  assert.match(verrou, /<mask /)
  assert.doesNotMatch(verrou, /lg-cercle|#ffe9a8|#b8a6ff/)
  // Deux états du même portrait sur une page ne partagent jamais un dégradé.
  const ids = (html: string) => new Set([...html.matchAll(/\bid="([^"]*)"/g)].map(x => x[1]))
  for (const id of ids(simple)) assert.ok(!ids(eclate).has(id), id)

  // Pris, il se dit au lecteur d'écran comme un légendaire — pas « Tu reviens à ton emoji ».
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ legendaire: 'br:ours' }), 'Tu portes l’ours.')
  assert.equal(annonceDuChoix({ legendaire: null }), 'Tu reviens à ton emoji.')

  // Dans un avatar : le portrait prend la place de l'emoji, éclaté avec ses paillettes.
  const avatar = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'br:cerf', finition: 'prisme', eclat: true })
  assert.match(avatar, /class="av av-portrait av-eclat"/)
  assert.match(avatar, /class="pt pt-foret pt-eclate"/)
  assert.doesNotMatch(avatar, /🦊/)
})

// ── 3. Sur le serveur ─────────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  // Samedi 26 septembre 2026, 10 h à Paris : l'horloge du quiz du jour.
  const horloge = { t: Date.UTC(2026, 8, 26, 8, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const profilDe = (banc: Banc, login: string) =>
  base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Une soirée rangée dans sa carrière, jouée à plusieurs : ses bonnes réponses par catégorie. */
function soireeRangee(banc: Banc, profileId: string, soireeId: string, justes: Record<string, number>, seul = false) {
  base(banc, db => {
    const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const categories = Object.fromEntries(Object.entries(justes).map(([c, n]) => [c, { questions: n + 5, justes: n }]))
    // Seul, une soirée ne compte pas (`soireeQuiCompte`) : rien pour les réponses.
    const gain = { ...gainVide(), reponses: seul ? 0 : 50 }
    const detail = JSON.stringify({ v: VERSION_BAREME, gain, releve: { ...releveVide(), categories } })
    db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      profileId,
      soireeId,
      espace,
      totalGain(gain),
      detail,
      Date.now(),
    )
  })
}

const porter = (banc: Banc, cookie: string, legendaire: string | null) =>
  ecrire(banc.url, '/api/joueur/moi', { legendaire }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

test('un portrait se porte s’il est ouvert, se refuse sinon, suit son porteur dans la salle — et part avec la soirée retirée', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = profilDe(banc, 'alice')
    // Vingt-cinq bonnes réponses en Nature, sur deux soirées ; deux en
    // Histoire le soir, une au quiz du jour ; et cent en Sport, jouées seul.
    soireeRangee(banc, alice, 'soiree-1', { Nature: 15, Histoire: 2 })
    soireeRangee(banc, alice, 'soiree-2', { Nature: 10 })
    soireeRangee(banc, alice, 'seule', { Sport: 100 }, true)
    base(banc, db => {
      db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES ('2026-09-01', ?, '[]', 1)`).run(
        JSON.stringify([{ categorie: 'Histoire' }, { categorie: 'Nature' }]),
      )
      db.prepare(
        `INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le) VALUES (?, '2026-09-01', 0, 0, 1000, 1, 100, 1)`,
      ).run(alice)
    })
    await banc.redemarrer()

    // Le blaireau (20 en Nature) : à elle. Le lynx (40) : pas encore.
    const blaireau = await porter(banc, cookie, 'br:blaireau')
    assert.equal(blaireau.status, 200, blaireau.corps.error)
    assert.equal(blaireau.corps.profile.legendaire, 'br:blaireau')
    const lynx = await porter(banc, cookie, 'br:lynx')
    assert.equal(lynx.status, 400)
    assert.equal(lynx.corps.error, 'Ce portrait se gagne à 40 bonnes réponses en Nature')
    // Une soirée jouée seule n'ouvre rien : cent réponses à son propre quiz.
    assert.equal((await porter(banc, cookie, 'br:nageuse')).status, 400)
    // Le Minotaure (3 en Histoire) : deux le soir, une au quiz du jour.
    const minotaure = await porter(banc, cookie, 'br:minotaure')
    assert.equal(minotaure.status, 200, minotaure.corps.error)

    // Dans la salle, c'est lui qu'on voit — et pour un emoji choisi, plus lui.
    const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const invitee = await invite(banc.url, 'Alice', '', { cookie })
    const vue = await instantane(host, s => s.players.some((p: any) => p.id === invitee.playerId), 'Alice dans la salle')
    assert.equal(vue.players.find((p: any) => p.id === invitee.playerId).legendaire, 'br:minotaure')
    const profil = await moi(banc, cookie)
    assert.equal(profil.legendaire, 'br:minotaure')

    // La soirée de ses deux réponses en Histoire est retirée de l'historique :
    // le Minotaure part avec elle, sans qu'on écrive rien d'autre.
    base(banc, db => db.prepare(`DELETE FROM profile_xp WHERE soiree_id = 'soiree-1'`).run())
    await banc.redemarrer()
    assert.equal((await moi(banc, cookie)).legendaire, null)
    assert.equal((await porter(banc, cookie, 'br:minotaure')).status, 400)
  }))

// ── 4. Ce que la soirée et le quiz du jour annoncent ─────────────────────

type Reponses = [Invite, number][][]

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

test('la fin de soirée annonce les portraits que ses bonnes réponses ont ouverts', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    // Trois questions de sport, et une sans catégorie : elle ne compte pour aucune branche.
    const sport = (text: string) => ({ ...qcm(text), category: 'Sport' })
    const quiz = await creerQuiz(banc.url, cookie, [sport('Un ?'), sport('Deux ?'), sport('Trois ?'), qcm('Quatre ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(host, quiz, Array.from({ length: 4 }, () => [[alice, 0], [bob, 1]] as [Invite, number][]))
    // La soirée se range d'elle-même après son quiz ; puis on la clôt.
    for (const limite = Date.now() + 8000; ; await patienter(100)) {
      const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
      if (current?.id) break
      if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger')
    }
    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin d’Alice', 15_000)
    const finBob = attendre<any>(bob.socket, 'soiree:fin', () => true, 'la fin de Bob', 15_000)
    ;(host as any).emit('host:closeParty', {})
    const fa = await finAlice
    assert.deepEqual(fa.profil?.portraits, ['br:nageuse'], 'trois bonnes réponses en Sport : la nageuse')
    assert.equal((await finBob).profil, undefined, 'un anonyme n’a rien à porter')
    // Elle se porte d'ici : la fin l'a dit, le serveur l'accorde.
    assert.equal((await porter(banc, aliceCookie, 'br:nageuse')).status, 200)
  }))

test('la partie du jour qui ouvre un portrait le dit à sa fin', () =>
  avecBanc(async (banc, horloge) => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Le tirage du jour, posé d'avance : quatre questions de nature, six sans catégorie.
    base(banc, db => {
      const questions = Array.from({ length: 10 }, (_, i) => ({
        reserveId: `essai-${i}`,
        texte: `Question ${i + 1} ?`,
        reponses: ['A', 'B', 'C', 'D'],
        bonne: 0,
        categorie: i < 4 ? 'Nature' : null,
        duree: 20,
        lectureMs: 0,
        anecdote: null,
      }))
      db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES ('2026-09-26', ?, '[]', 1)`).run(JSON.stringify(questions))
    })
    await banc.redemarrer()
    const poster = (chemin: string, corps: unknown = {}) =>
      ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    let etat = (await poster('/api/jour/commencer')).corps
    while (etat.question) {
      horloge.t += 500
      const r = await poster('/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
      assert.equal(r.status, 200, r.corps.error)
      etat = (await poster('/api/jour/suivante')).corps
    }
    assert.equal(etat.etat, 'finie')
    assert.deepEqual(etat.portraits, ['br:ecureuil'], 'quatre en Nature : l’écureuil, à trois')
    assert.equal((await porter(banc, cookie, 'br:ecureuil')).status, 200)
  }))

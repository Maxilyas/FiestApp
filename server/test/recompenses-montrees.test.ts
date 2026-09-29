// Ce que les récompenses montrent — et ce qu'elles ne doivent plus montrer.
//
// L'audit du 27 septembre 2026 (`retours/2026-09-27/`, axe 12) : la vitrine
// étanche là où elle écrit, qui fuyait là où elle relit ; un emoji de
// collection resté dans une soirée après une baisse de niveau, ou glissé
// par un `player:join` forgé ; un emoji d'Unicode 13 en carré vide sur la
// télé ; le sondage qui montrait l'emoji caché sous un légendaire.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connecter,
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
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { COLLECTION, DEFAULT_AVATAR, cleanAvatar, niveauRequis } from '../../shared/avatars'
import { estRecent } from '../../shared/emojis'
import { hautsFaitsGagnes, paliersAtteints } from '../../shared/hautsfaits'
import { carriereDe, gainVide, releveVide } from '../../shared/profil'
import { ecussonsDe } from '../../shared/ecussons'
import { recompensesDe } from '../../shared/proches'

// L'Éclat est un tirage : il ferait tomber un palier une fois sur quarante.
ProfileStore.tirageEclat = () => false

type Reponses = [Invite, number][][]

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

async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

const permanente = (banc: Banc) => new Database(banc.quizDbUrl.replace(/^file:/, ''))
const archivesDe = async (banc: Banc) =>
  (((await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any).archives as { id: string; heldAt: number }[])
const retirer = (banc: Banc, hote: string, id: string) =>
  fetch(`${banc.url}/api/soirees/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Cookie: hote, 'X-Requested-With': 'quizz' } })

// ── La vitrine relit ce qui reste ─────────────────────────────────────────

test('le bronze retiré avec sa soirée, l’argent reste : le titre et la vitrine tiennent, et se remettent', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const quiz = await creerQuiz(banc.url, hote, [qcm('Oui ?', ['Oui', 'Non'], 0)])
    const host = await ecranCommun(banc.url, hote)
    for (const soir of [1, 2]) {
      const a = await invite(banc.url, 'Alice', '', { cookie: alice })
      const b = await invite(banc.url, `Bob${soir}`, '🐻')
      await jouerQuiz(host, quiz, [[[a, 0], [b, 1]]])
      await clore(host)
      a.socket.close()
      b.socket.close()
    }
    const [s1, s2] = [...(await archivesDe(banc))].sort((x, y) => x.heldAt - y.heldAt).map(a => a.id)
    // Le Bavard tel qu'`accorderPaliers` le range : le bronze à la première
    // soirée, l'argent à la seconde.
    const db = permanente(banc)
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const palier = db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, '💬', ?, ?)`,
      )
      palier.run(id, 'hf:bavard:1', s1, espace, 'Le Bavard · Bronze', 1)
      palier.run(id, 'hf:bavard:2', s2, espace, 'Le Bavard · Argent', 2)
    } finally {
      db.close()
    }
    await banc.redemarrer()
    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    const porter = (corps: object) => ecrire(banc.url, '/api/joueur/moi', corps, alice, 'PUT')
    assert.equal((await porter({ titre: 'hf:bavard', vitrine: ['hf:bavard'] })).status, 200)

    // La première soirée retirée emporte le bronze ; l'argent reste.
    assert.equal((await retirer(banc, hote, s1)).status, 200)
    const apres = await moi()
    assert.ok(apres.vitrine.some((b: any) => b.key === 'hf:bavard:2'), 'l’argent est toujours sur l’étagère')
    assert.ok(hautsFaitsGagnes(recompensesDe(apres.hautsFaits)).includes('hf:bavard'), 'la page le propose')
    assert.equal(apres.titre, 'hf:bavard', 'le titre tient tant qu’un palier reste')
    assert.deepEqual(apres.vitrineChoisie, ['hf:bavard'], 'la vitrine choisie le garde')
    assert.equal((await porter({ titre: 'hf:bavard' })).status, 200, 'le serveur accepte ce que la page propose')
    host.close()
  } finally {
    await banc.close()
  }
})

// ── L'emoji de collection : relu en soirée, jugé nettoyé ──────────────────

test('le niveau redescend en pleine soirée : la salle et la carte ne montrent plus l’emoji qu’il n’ouvre plus', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    const host = await ecranCommun(banc.url, hote)
    // Première soirée : dix bonnes réponses, le podium — le niveau 2, et le paon avec lui.
    const quiz = await creerQuiz(banc.url, hote, Array.from({ length: 10 }, (_, i) => qcm(`Question ${i + 1}`, ['Oui', 'Non'], 0)))
    const a1 = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b1 = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(host, quiz, Array.from({ length: 10 }, () => [[a1, 0], [b1, 1]] as [Invite, number][]))
    await clore(host)
    a1.socket.close()
    b1.socket.close()
    const [s1] = (await archivesDe(banc)).map(a => a.id)
    assert.equal((await moi()).niveau, 2)
    assert.equal(niveauRequis('🦚'), 2)

    // Seconde soirée : Alice entre avec le paon, qu'elle vient d'ouvrir.
    const zoe = await invite(banc.url, 'Zoé', '🐸')
    const a2 = await invite(banc.url, 'Alice', '🦚', { cookie: alice })
    const avant = await instantane(zoe.socket, s => s.players.some((p: any) => p.name === 'Alice'), 'Alice dans la salle')
    assert.equal(avant.players.find((p: any) => p.name === 'Alice').avatar, '🦚')

    // La première soirée retirée : Alice redescend au niveau 1.
    assert.equal((await retirer(banc, hote, s1)).status, 200)
    assert.equal((await moi()).niveau, 1)

    // Quelqu'un arrive : la salle se rediffuse.
    await invite(banc.url, 'Yann', '🐙')
    const apres = await instantane(
      zoe.socket,
      s => s.players.some((p: any) => p.name === 'Yann') && s.players.some((p: any) => p.name === 'Alice' && p.niveau === 1),
      'Alice redescendue',
    )
    const aliceApres = apres.players.find((p: any) => p.name === 'Alice')
    // L'avatar de son profil, celui que sa page montre : plus le paon à côté de « Niv. 1 ».
    assert.equal(aliceApres.avatar, (await moi()).avatar)
    assert.equal(aliceApres.avatar, '🦊')
    const carte = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${a2.playerId}.json`)).json()) as any
    assert.ok(niveauRequis(carte.avatar) <= carte.profil.niveau, `sa carte non plus : ${carte.avatar}`)
    host.close()
  } finally {
    await banc.close()
  }
})

test('un player:join forgé ne fait pas porter un emoji de collection, ni un emoji d’Unicode 13', async () => {
  const banc = await demarrer()
  try {
    const COLLECTIONNES = new Set(COLLECTION.map(c => c.emoji))
    const entrer = async (avatar: string, name: string, cookie?: string) => {
      const tel = connecter(banc.url, cookie)
      assert.equal((await emitAck<any>(tel, 'party:watch', { slug: ADMIN.slug })).ok, true)
      const ack = await emitAck<any>(tel, 'player:join', { slug: ADMIN.slug, name, avatar })
      assert.equal(ack.ok, true, `${name} doit entrer : ${ack.error}`)
      return { tel, ack }
    }
    // Témoin : tapé tel quel, 🐲 est refusé à un anonyme.
    assert.ok(!COLLECTIONNES.has((await entrer('🐲', 'Témoin')).ack.avatar))
    // Un invisible glissé dans la paire : jugé brut, deux demi-caractères passaient, et le nettoyage recollait 🐲.
    const { tel, ack } = await entrer('\uD83D​\uDC32', 'Malo')
    const snap = await instantane<any>(tel, s => s.players.some((p: any) => p.id === ack.playerId), 'Malo dans la salle')
    assert.ok(!COLLECTIONNES.has(ack.avatar), `l’accusé lui rend ${ack.avatar}`)
    assert.ok(!COLLECTIONNES.has(snap.players.find((p: any) => p.id === ack.playerId).avatar), 'la salle non plus')
    // Un profil tout neuf, par le même détour (un trait d'union conditionnel).
    const novice = await inscrireProfil(banc.url, 'novice', 'Novice', '🦊')
    assert.ok(!COLLECTIONNES.has((await entrer('\uD83E­\uDE90', 'Novice', novice)).ack.avatar))

    // Unicode 13 et plus : un carré vide sur la télé (Windows 10).
    assert.ok(estRecent('🥲'))
    assert.equal(cleanAvatar('🥲'), DEFAULT_AVATAR)
    assert.equal(cleanAvatar('🦊'), '🦊')
    assert.ok(!estRecent((await entrer('🫠', 'Bob')).ack.avatar), 'l’invité n’entre pas en carré vide')
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const put = (await (await ecrire(banc.url, '/api/joueur/moi', { avatar: '🥲' }, alice, 'PUT')).json()) as any
    assert.ok(!estRecent(put.profile.avatar), `le profil porte ${put.profile.avatar}`)
  } finally {
    await banc.close()
  }
})

// ── Le sondage montre le légendaire porté ─────────────────────────────────

test('« Qui dans la salle ? » montre le légendaire qu’on porte, comme le reste de la soirée', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Le Phénix, gagné une fois : son légendaire s'ouvre.
    const db = permanente(banc)
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:phenix', 'ancienne', '', '🔥', 'Le Phénix', 1)`,
      ).run(id)
    } finally {
      db.close()
    }
    await banc.redemarrer()
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, alice, 'PUT')).status, 200)
    const quiz = await creerQuiz(banc.url, hote, [{ ...qcm('Qui dans la salle chante le plus faux ?', [], -1, 60), variante: 'sondage' }])
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b = await invite(banc.url, 'Bob', '🐻')
    const host = await ecranCommun(banc.url, hote)
    const q = attendre<any>(b.socket, 'session:view', p => p.view.phase === 'question', 'le sondage', 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    const vue = (await q).view
    const qui = vue.answers.indexOf('Alice')
    const revele = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'les votes', 15_000)
    for (const s of [a.socket, b.socket]) {
      const ack = await emitAck<any>(s, 'player:action', { sessionId, action: { type: 'answer', choice: qui, qIndex: 0, round: vue.round } })
      assert.equal(ack.ok, true, ack.error)
    }
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    const votes = (await revele).view.votes as any[]
    assert.equal(votes[0].name, 'Alice')
    assert.equal(votes[0].legendaire, 'lg:phenix', 'la télé la montre en Phénix, pas sous son emoji caché')
    host.close()
  } finally {
    await banc.close()
  }
})

// ── Les pages qui dessinent un avatar porté ───────────────────────────────

/** Une source du client, telle qu'on l'écrit. */
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

test('l’éclat d’un avatar porté se calcule partout par cibleEclat, et s’éteint partout où il l’a éteint', () => {
  // La page du compte calculait l'Éclat sur l'emoji caché sous un légendaire.
  // Et un Éclat qu'il a éteint doit s'éteindre sur chaque page qui le montre :
  // un `eclats.includes` direct l'y rallumerait (`brilleChez`).
  const racine = new URL('../../client/src/', import.meta.url)
  const fautifs: string[] = []
  let vus = 0
  for (const f of readdirSync(racine, { recursive: true, encoding: 'utf8' })) {
    if (!f.endsWith('.tsx')) continue
    const texte = readFileSync(new URL(f.replace(/\\/g, '/'), racine), 'utf8')
    for (const m of texte.matchAll(/<Avatar\b[^>]*?\/>/gs)) {
      const el = m[0]
      if (!/legendaire=/.test(el) || !/eclats\.includes\(|brilleChez\(/.test(el)) continue
      vus++
      if (!/cibleEclat\(/.test(el) || !/brilleChez\(/.test(el)) fautifs.push(`client/src/${f}:${texte.slice(0, m.index).split('\n').length}`)
    }
  }
  assert.ok(vus >= 3, `la garde trouve les avatars portés (${vus})`)
  assert.deepEqual(fautifs, [])
})

test('ce que la salle voit, la page le montre : laurier, légendaire, surnom et entrée', () => {
  // « Ce que la salle voit » et l'en-tête du téléphone oubliaient le laurier.
  assert.match(source('components/Apparence.tsx'), /<NomLaure nom=\{profil\.name\} laurier=\{profil\.laurier\} \/>/)
  assert.match(source('views/PlayerApp.tsx'), /<span className="me-nom">[^\n]*\n(?:\s*\{\/\*[^\n]*\*\/\}\n)?\s*<Laurier laurier=\{me\?\.laurier\} \/>/)
  // « Ma finition » montre le légendaire porté, pas l'emoji caché dessous.
  const apparence = source('components/Apparence.tsx')
  assert.match(apparence, /<Avatar avatar=\{profil\.avatar\} finition=\{f\} eclat=\{eclat\} legendaire=\{legendairePorte\} \/>/)
  assert.match(apparence, /a sa propre lumière/)
  // La marque « (2) » n'est pas un surnom.
  assert.match(source('components/CarteJoueur.tsx'), /p\.prenom !== partsDuNomAffiche\(carte\.nom\)\.prenom/)
  // Un légendaire verrouillé n'a rien qui éclate, ni version à choisir.
  assert.match(source('components/Carriere.tsx'), /\{gagne && eclats\.includes\(choisi\.key\) && <ChoixDeLEclat /)
  // L'entrée d'un anonyme ne reprend pas l'emoji de collection d'un profil.
  assert.match(source('components/Entree.tsx'), /choix && AVATARS\.includes\(choix\.avatar\) \? choix\.avatar : tirage\(\)/)
  // Au podium et sur la carte, le médaillon prend la place d'un emoji auréolé.
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.podium-avatar \.av-emoji > \.lg,\s*\.carte-avatar \.av-emoji > \.lg \{ font-size: 1\.3em; \}/)
})

test('une soirée jouée seul ne nourrit rien de la carrière : ni écusson, ni fiche, ni palier', () => {
  // Vingt bonnes réponses de sport et trois estimations au chiffre près,
  // seul devant son propre quiz : l'écusson de bronze sur la carte, Le Devin
  // en prime. L'arbitrage du 27 septembre 2026 les écarte, comme L'Habitué
  // l'écartait déjà [recompenses-vitrine-3].
  const releve = {
    ...releveVide(),
    questions: 23,
    reponses: 23,
    qcm: 20,
    justes: 20,
    estimations: 3,
    estimationsExactes: 3,
    avatar: '🦊',
    categories: { Sport: { questions: 20, justes: 20 } },
  }
  const seul = carriereDe([{ releve, gain: gainVide(), spaceId: 'banc' }], { eclats: 0, niveau: 1 })
  assert.deepEqual(seul.categories, {})
  assert.deepEqual([seul.soirees, seul.justes, seul.estimationsExactes, seul.avatars, seul.hotes], [0, 0, 0, 0, 0])
  assert.deepEqual(ecussonsDe(seul.categories).filter(e => e.palier > 0), [], 'pas d’écusson fait seul')
  assert.deepEqual(paliersAtteints(seul), [], 'aucun palier ne tombe seul')
  // Témoin : la même soirée, jouée à deux, compte.
  const aDeux = carriereDe([{ releve, gain: { ...gainVide(), reponses: 23 }, spaceId: 'banc' }], { eclats: 0, niveau: 1 })
  assert.equal(aDeux.categories.Sport.justes, 20)
  assert.equal(ecussonsDe(aDeux.categories).find(e => e.categorie === 'Sport')!.palier, 1)
  assert.ok(paliersAtteints(aDeux).includes('hf:devin:1'))
})

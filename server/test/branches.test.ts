// Les avatars du savoir : douze branches, une par catégorie de questions, six
// portraits dessinés dans chacune. Ils se gagnent sur les sentiers du savoir
// de la campagne (`shared/sentiers.ts`) : un portrait tous les deux paliers
// de son sentier, qu'on porte comme un légendaire. Les soirées et le quiz du
// jour n'en ouvrent plus (le choix du 5 octobre 2026) : chacun a gardé les
// siens, repris en paliers (`sentiers-reprise.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, statSync } from 'node:fs'
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
import {
  BRANCHES,
  PALIER_DU_PORTRAIT,
  PORTRAITS,
  branche,
  deLaBranche,
  nomDansLaPhrase,
  ouvertsDansLaBranche,
  portrait,
  portraitsOuverts,
  prochainDansLaBranche,
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
      b.portraits.map(p => [p.rang, p.palier]),
      PALIER_DU_PORTRAIT.map((palier, rang) => [rang, palier]),
    )
    for (const p of b.portraits) {
      assert.match(p.key, /^br:[a-z]+(-[a-z]+)*$/, p.key)
      assert.equal(portrait(p.key), p)
    }
  }
  assert.equal(new Set(PORTRAITS.map(p => p.key)).size, 72, 'soixante-douze clés, toutes différentes')
  // Un choix de produit (le 5 octobre 2026) : un portrait tous les deux
  // paliers, le sixième au sommet du sentier.
  assert.deepEqual([...PALIER_DU_PORTRAIT], [2, 4, 6, 8, 10, 12])
})

test('ses paliers ouvrent ses portraits : un tous les deux paliers de son sentier', () => {
  // Cinq paliers de la forêt, deux des mythologies.
  const paliers = { foret: 5, mythes: 2 }
  assert.deepEqual(portraitsOuverts(paliers), ['br:minotaure', 'br:ecureuil', 'br:blaireau'])
  const foret = branche('foret')!
  assert.equal(ouvertsDansLaBranche(foret, paliers), 2)
  assert.deepEqual(prochainDansLaBranche(foret, paliers), { portrait: portrait('br:lynx'), encore: 1 })
  assert.equal(prochainDansLaBranche(foret, { foret: 12 }), null, 'le sommet atteint, plus rien à viser')
  assert.equal(prochainDansLaBranche(foret, { foret: 13 }), null, 'ni après le palier de maître')
  assert.deepEqual(portraitsOuverts({}), [], 'aucun palier, aucun portrait')
  // Un nom dans une phrase : l'article en minuscule, un nom propre intact.
  assert.deepEqual(
    ['L’ours', 'La tortue de mer', 'Le Minotaure', 'Thor'].map(nomDansLaPhrase),
    ['l’ours', 'la tortue de mer', 'le Minotaure', 'Thor'],
  )
  // « Le sentier de… », « Maître de… » : l'article se contracte.
  assert.deepEqual(
    ['foret', 'stade', 'oceans', 'espace', 'monde'].map(k => deLaBranche(branche(k)!)),
    ['de la forêt', 'du stade', 'des océans', 'de l’espace', 'du tour du monde'],
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

/** Là où le build prend les fichiers des portraits peints, qu'il sert sous `/portraits/`. */
const PUBLICS = new URL('../../client/public/portraits/', import.meta.url)

/**
 * Ce qu'un fichier peint pèse au plus, par taille : vingt porteurs dans une
 * salle, et chacun télécharge le sien — la petite taille, 18 Ko en moyenne.
 * Les plus chargés (la sirène à l'aquarelle, les runes du mage, les points
 * du pop art) montent à 115 Ko en grand ; au-delà, c'est un fichier qui
 * n'est pas passé par la chaîne (un PNG, une image en 2K).
 */
const POIDS_MAX: Record<string, number> = { '512': 130_000, '256': 45_000 }

test('chaque portrait a son dessin, dans le fichier de sa branche, et s’y tient', async () => {
  for (const b of BRANCHES) {
    const { DESSINS } = await import(url(`components/portraits/${b.key}.ts`))
    assert.deepEqual(Object.keys(DESSINS).sort(), b.portraits.map(p => p.key).sort(), `les six de ${b.nom}`)
    for (const [cle, d] of Object.entries<any>(DESSINS)) {
      assert.equal(d.fond.length, 3, `${cle} : un disque de trois teintes`)
      // Peint : ses fichiers, sous leur empreinte, grand puis petit. Le
      // visage n'a pas de décor — le disque teinté de sa branche le reçoit.
      const palier = b.portraits.findIndex(p => p.key === cle)
      assert.equal(!!d.image.disque, palier > 0, `${cle} : un décor peint à partir du deuxième palier`)
      for (const variante of ['disque', 'perso'] as const) {
        const paire: string[] | undefined = d.image[variante]
        if (!paire) continue
        assert.equal(paire.length, 2, `${cle} : ${variante}, deux tailles`)
        paire.forEach((f, k) => {
          const taille = ['512', '256'][k]
          assert.match(f, new RegExp(`^/portraits/${cle.slice(3)}-${variante}-${taille}\\.[0-9a-f]{10}\\.webp$`), `${cle} : ${f}`)
          const poids = statSync(new URL(f.slice('/portraits/'.length), PUBLICS)).size
          assert.ok(poids <= POIDS_MAX[taille], `${f} pèse ${poids} octets`)
        })
      }
    }
  }
})

test('les fichiers des portraits peints sont tous cités par leur branche : un portrait repeint emporte l’ancien', async () => {
  const cites = new Set<string>()
  for (const b of BRANCHES) {
    const { DESSINS } = await import(url(`components/portraits/${b.key}.ts`))
    for (const d of Object.values<any>(DESSINS)) {
      for (const f of [...(d.image?.disque ?? []), ...(d.image?.perso ?? [])]) cites.add(f.slice('/portraits/'.length))
    }
  }
  const presents = existsSync(PUBLICS) ? readdirSync(PUBLICS) : []
  assert.deepEqual(presents.filter(f => !cites.has(f)), [], 'des fichiers que plus personne ne cite')
  for (const f of cites) assert.ok(presents.includes(f), `${f} est cité mais absent`)
})

test('peint, un portrait monte en puissance : le visage, l’anneau d’argent, le débord, l’anneau d’or et son aura', async () => {
  await import(url('components/portraits/mythes.ts'))
  const r = (props: object) => rendu('components/Portrait', 'Portrait', props)
  const ids = (html: string) => new Set([...html.matchAll(/\bid="([^"]*)"/g)].map(x => x[1]))

  // Le visage : le personnage détouré sur le disque teinté de sa branche, un
  // filet blanc. Petit par défaut — une liste en montre vingt —, grand pour
  // ce qu'on regarde.
  const visage = await r({ cle: 'br:minotaure' })
  assert.match(visage, /class="pt pt-mythes pt-palier-1"/)
  assert.match(visage, /<circle cx="50" cy="50" r="48"\/>/)
  assert.match(visage, /stop-color="#5577d6"/)
  assert.match(visage, /href="\/portraits\/minotaure-perso-256\.[0-9a-f]{10}\.webp"/)
  assert.doesNotMatch(visage, /-disque-|_anneau|pt-aura|pt-debord/)
  assert.match(await r({ cle: 'br:minotaure', grand: true }), /minotaure-perso-512\./)

  // La lumière : son décor peint, sous l'anneau d'argent, qui prend le bord.
  const lumiere = await r({ cle: 'br:anubis' })
  assert.match(lumiere, /anubis-disque-256\./)
  assert.match(lumiere, /stop-color="#c3ccd8"/)
  assert.match(lumiere, /r="46.4"/)
  assert.doesNotMatch(lumiere, /pt-debord|pt-aura/)

  // Le débord : le trident sort du disque, par-dessus l'anneau.
  const debord = await r({ cle: 'br:poseidon' })
  assert.match(debord, /<g class="pt-debord" mask="url\(#[^)]*_dehors\)"><image href="\/portraits\/poseidon-perso-256\./)
  assert.match(debord, /stop-color="#c3ccd8"/)

  // La forme ultime : l'or, l'aura qui respire, cinq étoiles, ce qui déborde.
  const ultime = await r({ cle: 'br:athena' })
  assert.match(ultime, /class="pt pt-mythes pt-palier-6"/)
  assert.match(ultime, /stop-color="#e3b04b"/)
  assert.match(ultime, /class="pt-aura"/)
  assert.equal((ultime.match(/class="pt-etoile"/g) ?? []).length, 5)
  assert.match(ultime, /pt-debord/)

  // Portée, la finition prend la place de l'anneau ; ce qui sort passe par-dessus son cercle.
  const portee = await r({ cle: 'br:athena', finition: 'or' })
  assert.match(portee, /lg-cercle lg-cercle-or/)
  assert.match(portee, /<circle cx="50" cy="50" r="45"\/>/)
  assert.doesNotMatch(portee, /_anneau/)
  assert.match(portee, /pt-debord/)
  // En Mat, pas de cercle : l'anneau du palier reste.
  assert.match(await r({ cle: 'br:athena', finition: 'mat' }), /_anneau/)

  // Éclatée : le décor passe sous le ciel rare des mythologies — sa lumière
  // devient ses couleurs —, le personnage par-dessus garde les siennes.
  const eclatee = await r({ cle: 'br:gorgone', eclat: true })
  assert.match(eclatee, /aria-label="La Gorgone, éclaté"/)
  assert.match(eclatee, /<image href="\/portraits\/gorgone-disque-256\.[0-9a-f]{10}\.webp"[^>]*filter="url\(#[^)]*_rare\)"\/><image href="\/portraits\/gorgone-perso-256\./)
  assert.match(eclatee, /feFuncR type="table" tableValues="0.200 0.659 1.000"/)

  // À gagner : la silhouette d'or, qui déborde déjà — ni décor, ni aura, ni
  // étoiles, ni cercle, ni Éclat ; l'anneau à peine.
  const verrou = await r({ cle: 'br:athena', verrouille: true, finition: 'or', eclat: true })
  assert.match(verrou, /aria-label="Athéna — pas encore gagné"/)
  assert.match(verrou, /<mask id="[^"]*_forme"[^>]*><g filter="url\(#[^)]*_blanc\)"><image href="\/portraits\/athena-perso-256\./)
  assert.match(verrou, /pt-debord/)
  assert.doesNotMatch(verrou, /pt-aura|pt-etoile|lg-cercle|athena-disque|_rare/)

  // Deux états du même portrait sur une page ne partagent jamais un identifiant.
  for (const id of ids(ultime)) assert.ok(!ids(verrou).has(id), id)
})

test('porté, un portrait se dit comme un légendaire, et prend la place de l’emoji, éclaté avec ses paillettes', async () => {
  await import(url('components/portraits/foret.ts'))
  // Pris, il se dit au lecteur d'écran comme un légendaire — pas « Tu reviens à ton emoji ».
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ legendaire: 'br:ours' }), 'Tu portes l’ours.')
  assert.equal(annonceDuChoix({ legendaire: null }), 'Tu reviens à ton emoji.')

  // Dans un avatar : le portrait prend la place de l'emoji, éclaté avec ses paillettes.
  const avatar = await rendu('components/Avatar', 'Avatar', { avatar: '🦊', legendaire: 'br:cerf', finition: 'prisme', eclat: true })
  assert.match(avatar, /class="av av-portrait av-eclat"/)
  assert.match(avatar, /class="pt pt-foret pt-eclate pt-palier-6"/)
  assert.doesNotMatch(avatar, /🦊/)
  // La nuit violette de la forêt, pas l'automne qui noyait les roux.
  assert.match(avatar, /stop-color="#b8a6ff"/)
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

/** Des paliers validés sur un sentier, posés comme la reprise les écrit (`sentier_acquis`). */
function paliersAcquis(banc: Banc, profileId: string, branche: string, paliers: number) {
  base(banc, db =>
    db
      .prepare(
        `INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)
         ON CONFLICT(profile_id, branche) DO UPDATE SET paliers = excluded.paliers`,
      )
      .run(profileId, branche, paliers, Date.now()),
  )
}

const porter = (banc: Banc, cookie: string, legendaire: string | null) =>
  ecrire(banc.url, '/api/joueur/moi', { legendaire }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

test('un portrait se porte si son palier est validé, se refuse sinon, suit son porteur dans la salle — et reste à lui', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = profilDe(banc, 'alice')
    // Cinq paliers de la forêt, deux des mythologies. Et cent bonnes
    // réponses en Sport, en soirée : elles n'ouvrent plus rien.
    paliersAcquis(banc, alice, 'foret', 5)
    paliersAcquis(banc, alice, 'mythes', 2)
    soireeRangee(banc, alice, 'soiree-1', { Sport: 100, Histoire: 5 })

    // Le blaireau (palier 4) : à elle. Le lynx (palier 6) : pas encore.
    const blaireau = await porter(banc, cookie, 'br:blaireau')
    assert.equal(blaireau.status, 200, blaireau.corps.error)
    assert.equal(blaireau.corps.profile.legendaire, 'br:blaireau')
    const lynx = await porter(banc, cookie, 'br:lynx')
    assert.equal(lynx.status, 400)
    assert.equal(lynx.corps.error, 'Ce portrait se gagne au palier 6 du sentier de la forêt')
    // Cent bonnes réponses en Sport, en soirée : plus un portrait.
    assert.equal((await porter(banc, cookie, 'br:nageuse')).status, 400)
    // Le Minotaure (palier 2 des mythologies).
    const minotaure = await porter(banc, cookie, 'br:minotaure')
    assert.equal(minotaure.status, 200, minotaure.corps.error)

    // Sa page dit ses paliers : la grille des avatars les lit.
    const detail = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any
    assert.deepEqual(detail.profile.sentiers, { foret: 5, mythes: 2 })

    // Dans la salle, c'est lui qu'on voit.
    const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const invitee = await invite(banc.url, 'Alice', '', { cookie })
    const vue = await instantane(host, s => s.players.some((p: any) => p.id === invitee.playerId), 'Alice dans la salle')
    assert.equal(vue.players.find((p: any) => p.id === invitee.playerId).legendaire, 'br:minotaure')
    assert.equal((await moi(banc, cookie)).legendaire, 'br:minotaure')

    // Une soirée retirée de l'historique ne reprend rien : un palier ne se perd pas.
    base(banc, db => db.prepare(`DELETE FROM profile_xp WHERE soiree_id = 'soiree-1'`).run())
    await banc.redemarrer()
    assert.equal((await moi(banc, cookie)).legendaire, 'br:minotaure')
  }))

// ── 4. Les soirées et le quiz du jour n'en ouvrent plus ──────────────────

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

test('la fin de soirée n’annonce plus de portrait : ses bonnes réponses n’en ouvrent plus', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    // Trois questions de sport : elles ouvraient la nageuse, jusqu'aux sentiers.
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
    ;(host as any).emit('host:closeParty', {})
    const fa = await finAlice
    assert.ok(fa.profil, 'sa fin de soirée, avec ce qu’elle rapporte')
    assert.equal(fa.profil.portraits, undefined, 'plus de portrait dans la fin de soirée')
    assert.equal((await porter(banc, aliceCookie, 'br:nageuse')).status, 400, 'la nageuse se gagne sur le sentier du stade')
  }))

test('la partie du jour n’ouvre plus de portrait', () =>
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
    assert.equal(etat.portraits, undefined, 'quatre en Nature : l’écureuil se gagne maintenant sur son sentier')
    assert.equal((await porter(banc, cookie, 'br:ecureuil')).status, 400)
  }))

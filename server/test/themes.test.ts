// Les thèmes et leurs confettis : une bonne réponse, un confetti — en soirée
// qui compte comme au quiz du jour —, dépensés dans la boutique de sa page.
// On ne porte que ce qu'on a ; un thème acheté se garde, même quand une
// soirée retirée fait passer le solde sous zéro ; et le thème ne suit que le
// téléphone de son profil (`shared/themes.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import {
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  estimation,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  ADMIN,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import {
  ceQueDonnentLesConfettis,
  confettisDeSoiree,
  enBoutique,
  nConfettis,
  phraseDesConfettis,
  prixDe,
  PRIX_DES_THEMES,
  theme,
  THEMES,
} from '../../shared/themes'
import { gainVide, releveVide } from '../../shared/profil'

// L'Éclat se tire une chance sur quarante, et le premier fait tomber un
// palier : ici, le hasard ne décide de rien.
ProfileStore.tirageEclat = () => false

// ── Le catalogue, pur ─────────────────────────────────────────────────────

test('trente thèmes, rangés à l’échelle de rareté : la Licorne est Rare, le Néon Épique', () => {
  assert.equal(THEMES.length, 30)
  assert.equal(new Set(THEMES.map(t => t.key)).size, 30, 'une clé par thème')
  const de = (rarete: string) => THEMES.filter(t => t.rarete === rarete).map(t => t.key)
  assert.deepEqual(de('offert'), ['velours', 'ivoire'], 'deux offerts à tous')
  assert.deepEqual(
    ['commune', 'peucommune', 'rare', 'epique', 'legendaire'].map(r => de(r).length),
    [5, 7, 8, 5, 3],
  )
  assert.equal(theme('licorne')?.rarete, 'rare')
  assert.equal(theme('neon')?.rarete, 'epique')
  assert.deepEqual(PRIX_DES_THEMES, { offert: 0, commune: 150, peucommune: 250, rare: 400, epique: 650, legendaire: 1000 })
  // La boutique se lit dans l'ordre du catalogue : jamais un thème moins
  // cher après un plus cher.
  for (let i = 1; i < THEMES.length; i++) assert.ok(prixDe(THEMES[i]) >= prixDe(THEMES[i - 1]), THEMES[i].key)
  assert.equal(theme('inconnu'), undefined)
  assert.equal(theme(42), undefined)
})

test('un thème de saison n’est en boutique que pendant sa saison — le Nouvel An enjambe l’année', () => {
  const en = (cle: string, jour: string) => enBoutique(theme(cle)!, jour)
  assert.equal(en('cahier', '2026-03-14'), true, 'hors saison : toute l’année')
  assert.deepEqual(
    ['2026-10-24', '2026-10-25', '2026-11-01', '2026-11-02'].map(j => en('halloween', j)),
    [false, true, true, false],
    'Halloween : du 25 octobre au 1er novembre, comme la Citrouille',
  )
  assert.deepEqual(
    ['2026-12-19', '2026-12-20', '2026-12-26', '2026-12-27'].map(j => en('neige', j)),
    [false, true, true, false],
    'Neige : la saison de Noël',
  )
  assert.deepEqual(
    ['2026-12-29', '2026-12-30', '2027-01-02', '2027-01-03'].map(j => en('feudartifice', j)),
    [false, true, true, false],
    'le Feu d’artifice, du 30 décembre au 2 janvier',
  )
  assert.deepEqual(
    ['2026-01-31', '2026-02-01', '2028-02-29', '2026-03-01'].map(j => en('carnaval', j)),
    [false, true, true, false],
    'le Carnaval, tout février — bissextile comprise',
  )
  assert.deepEqual(['2026-06-30', '2026-07-01', '2026-08-31', '2026-09-01'].map(j => en('plage', j)), [false, true, true, false])
  assert.deepEqual(['2026-03-31', '2026-04-01', '2026-04-30', '2026-05-01'].map(j => en('cerisiers', j)), [false, true, true, false])
})

test('une bonne réponse, un confetti : les justes et les estimations proches — rien d’une soirée jouée seul', () => {
  const releve = { ...releveVide(), justes: 7, estimationsProches: 2, reponses: 12 }
  assert.equal(confettisDeSoiree({ ...gainVide(), reponses: 12 }, releve), 9)
  // Ni la rapidité ni le multiplicateur n'y changent rien : ils sont dans
  // le gain, pas dans le relevé.
  assert.equal(confettisDeSoiree({ ...gainVide(), reponses: 12, reflexe: 300, quiz: 50 }, releve), 9)
  assert.equal(confettisDeSoiree(gainVide(), releve), 0, 'seul devant son quiz, on connaît les réponses')
})

test('ce que donnent les confettis : les thèmes à sa portée, et le prochain qu’il vise', () => {
  const offerts = ['velours', 'ivoire']
  assert.deepEqual(ceQueDonnentLesConfettis(offerts, 0, '2026-09-29'), { abordables: 0, vise: { theme: 'cahier', manque: 150 } })
  assert.deepEqual(ceQueDonnentLesConfettis(offerts, -40, '2026-09-29'), { abordables: 0, vise: { theme: 'cahier', manque: 190 } })
  // 820 paient les Communes, les Peu communes hors saison, les Rares hors
  // saison et les Épiques hors saison ; le prochain est un Légendaire.
  const hors = (t: (typeof THEMES)[number]) => t.rarete !== 'offert' && prixDe(t) <= 820 && enBoutique(t, '2026-09-29')
  assert.deepEqual(ceQueDonnentLesConfettis(offerts, 820, '2026-09-29'), {
    abordables: THEMES.filter(hors).length,
    vise: { theme: 'aurore', manque: 180 },
  })
  // Ce qu'il a déjà ne se vise plus.
  assert.deepEqual(ceQueDonnentLesConfettis([...offerts, 'cahier'], 100, '2026-09-29').vise, { theme: 'carnet', manque: 50 })
  // Toute la boutique à sa portée : plus rien à viser.
  assert.deepEqual(ceQueDonnentLesConfettis(offerts, 5000, '2026-09-29').vise, null)

  // Et ce que la fin de soirée en dit.
  assert.equal(
    phraseDesConfettis({ solde: 3, abordables: 0, vise: { theme: 'cahier', manque: 147 } }),
    'Une bonne réponse, un confetti. Tu en as 3 : plus que 147 pour le thème Cahier d’écolier.',
  )
  assert.equal(
    phraseDesConfettis({ solde: 820, abordables: 1, vise: { theme: 'aurore', manque: 180 } }),
    'Tu en as 820 : 1 thème à ta portée, et plus que 180 pour le thème Aurore boréale.',
  )
  assert.equal(phraseDesConfettis({ solde: 5000, abordables: 26, vise: null }), 'Tu en as 5000 : toute la boutique est à ta portée.')
  assert.equal(phraseDesConfettis({ solde: 40, abordables: 0, vise: null }), 'Une bonne réponse, un confetti. Tu en as 40.')
  assert.deepEqual([0, 1, 2, -1, -3].map(nConfettis), ['0 confetti', '1 confetti', '2 confettis', '-1 confetti', '-3 confettis'])
})

test('chaque thème a son aperçu dans la boutique, et aucun aperçu n’est orphelin', () => {
  // Photographiés dans l'application par `scripts/apercus-themes.ts` : un
  // thème ajouté sans le sien laisserait une case vide dans la boutique.
  const dossier = new URL('../../client/src/themes/apercus/', import.meta.url)
  const apercus = readdirSync(dossier).filter(f => f.endsWith('.webp'))
  assert.deepEqual(apercus.map(f => f.replace(/\.webp$/, '')).sort(), THEMES.map(t => t.key).sort())
  for (const f of apercus) {
    const octets = readFileSync(new URL(f, dossier))
    assert.equal(octets.subarray(8, 12).toString('ascii'), 'WEBP', `${f} est une image WebP`)
    assert.ok(octets.length < 30_000, `${f} reste une vignette (${octets.length} octets)`)
  }
})

test('le thème suit la page, pas la personne : seules les pages d’un joueur le portent', () => {
  // L'animateur qui a acheté la Licorne anime en Velours ou en Ivoire :
  // l'écran commun, l'éditeur, son compte et les pages publiques de la
  // soirée n'en savent rien — la salle ne verrait sinon que ses goûts.
  const client = new URL('../../client/src/', import.meta.url)
  const lire = (fichier: string) => readFileSync(new URL(fichier, client), 'utf8')
  for (const vue of readdirSync(new URL('views/', client)).filter(f => f.endsWith('.tsx'))) {
    const porte = /themeJoueur/.test(lire(`views/${vue}`))
    assert.equal(porte, ['PlayerApp.tsx', 'ProfilApp.tsx', 'JourApp.tsx'].includes(vue), `${vue} et le thème d’un profil`)
  }
  // Au démarrage, le thème retenu ne se pose que sur ces trois pages-là.
  assert.match(lire('main.tsx'), /else if \(App === PlayerApp \|\| App === ProfilApp \|\| App === JourApp\) poserThemeRetenu\(\)/)
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Le 29 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 29, 8, 0)

async function avecBanc(scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
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

const idDe = (banc: Banc, login: string) =>
  enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Une soirée rangée à son historique, avec ses bonnes réponses : jouée à plusieurs, ou seul. */
function soireeRangee(banc: Banc, profileId: string, soireeId: string, justes: number, aPlusieurs = true) {
  enBase(banc, db =>
    db
      .prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, '', 0, ?, ?)`)
      .run(
        profileId,
        soireeId,
        JSON.stringify({
          v: VERSION_BAREME,
          gain: { ...gainVide(), reponses: aPlusieurs ? justes : 0 },
          releve: { ...releveVide(), reponses: justes, qcm: justes, justes },
        }),
        Date.now(),
      ),
  )
}

/** Une partie du quiz du jour, finie, avec ses bonnes réponses. */
function partieDuJour(banc: Banc, profileId: string, jour: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`,
      )
      .run(profileId, jour, justes),
  )
}

const lire = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
const acheter = (banc: Banc, cookie: string | undefined, cle: string) =>
  ecrire(banc.url, '/api/joueur/themes', { theme: cle }, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const porter = (banc: Banc, cookie: string, cle: string | null) =>
  ecrire(banc.url, '/api/joueur/moi', { theme: cle }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('on achète en confettis et l’on porte ce qu’on a ; un achat se garde, même sous zéro', () =>
  avecBanc(async banc => {
    assert.equal((await acheter(banc, undefined, 'cahier')).status, 401, 'sans profil, pas de boutique')
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')

    // Un profil neuf : rien gagné, les deux offerts, Velours sur le dos.
    let moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique, {
      confettis: { gagnes: 0, depenses: 0, solde: 0 },
      possedes: ['velours', 'ivoire'],
      porte: null,
      jour: '2026-09-29',
    })
    assert.equal(moi.theme, null)

    // Les offerts se portent ; Velours s'écrit null ; le reste s'achète d'abord.
    assert.equal((await porter(banc, cookie, 'ivoire')).corps.profile.theme, 'ivoire')
    assert.equal((await porter(banc, cookie, 'velours')).corps.profile.theme, null)
    const pasAElle = await porter(banc, cookie, 'aurore')
    assert.equal(pasAElle.status, 400)
    assert.equal(pasAElle.corps.error, 'Le thème Aurore boréale s’achète d’abord, en confettis')
    assert.match((await porter(banc, cookie, 'licorne-noire')).corps.error, /n’existe pas/)
    assert.match((await acheter(banc, cookie, 'licorne-noire')).corps.error, /n’existe pas/)
    const fauche = await acheter(banc, cookie, 'cahier')
    assert.equal(fauche.status, 400)
    assert.equal(fauche.corps.error, 'Il te manque 150 confettis pour le thème Cahier d’écolier')

    // Une soirée à plusieurs (200 bonnes réponses), une soirée seule (qui ne
    // compte pas) et deux quiz du jour (60 et 40) : 300 confettis.
    soireeRangee(banc, alice, 'soiree-a-deux', 200)
    soireeRangee(banc, alice, 'soiree-seule', 50, false)
    partieDuJour(banc, alice, '2026-09-27', 60)
    partieDuJour(banc, alice, '2026-09-28', 40)
    assert.deepEqual((await lire(banc, cookie)).boutique.confettis, { gagnes: 300, depenses: 0, solde: 300 })

    // Halloween n'est pas de saison le 29 septembre.
    assert.equal((await acheter(banc, cookie, 'halloween')).corps.error, 'Le thème Halloween revient en boutique du 25 octobre au 1er novembre')

    // Le Cahier d'écolier, 150 : acheté, et porté aussitôt.
    const achat = await acheter(banc, cookie, 'cahier')
    assert.equal(achat.status, 200)
    assert.equal(achat.corps.profile.theme, 'cahier')
    assert.deepEqual(achat.corps.boutique.confettis, { gagnes: 300, depenses: 150, solde: 150 })
    assert.deepEqual(achat.corps.boutique.possedes, ['velours', 'ivoire', 'cahier'])
    assert.equal(achat.corps.boutique.porte, 'cahier')
    assert.equal((await acheter(banc, cookie, 'cahier')).corps.error, 'Ce thème est déjà à toi')
    assert.equal((await acheter(banc, cookie, 'ivoire')).corps.error, 'Ce thème est déjà à toi')

    // Deux achats partis ensemble pour 150 confettis : un seul passe.
    const ensemble = await Promise.all([acheter(banc, cookie, 'carnet'), acheter(banc, cookie, 'guinguette')])
    assert.deepEqual(ensemble.map(r => r.status).sort(), [200, 400])
    assert.match(ensemble.find(r => r.status === 400)!.corps.error, /^Il te manque 150 confettis pour le thème /)
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.confettis, { gagnes: 300, depenses: 300, solde: 0 })
    assert.equal(moi.boutique.possedes.length, 4)

    // La soirée à deux retirée de l'historique emporte ses 200 confettis :
    // le solde passe sous zéro, rien ne se reprend.
    enBase(banc, db => db.prepare(`DELETE FROM profile_xp WHERE soiree_id = 'soiree-a-deux'`).run())
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.confettis, { gagnes: 100, depenses: 300, solde: -200 })
    assert.equal(moi.boutique.possedes.length, 4, 'ses thèmes lui restent')
    assert.equal(moi.theme, moi.boutique.porte, 'et il porte toujours le dernier acheté')
    assert.equal((await porter(banc, cookie, 'cahier')).status, 200, 'un thème à lui se porte, solde négatif ou non')
    assert.equal((await acheter(banc, cookie, 'stade')).corps.error, 'Il te manque 350 confettis pour le thème Stade')

    // Son téléphone le reçoit à la poignée de main d'une soirée — et le
    // même téléphone, sans profil, n'en a pas.
    const tel = connecter(banc.url, cookie)
    const watched = await emitAck<any>(tel, 'party:watch', { slug: ADMIN.slug })
    assert.equal(watched.profile.theme, 'cahier')
    const anonyme = connecter(banc.url)
    assert.equal((await emitAck<any>(anonyme, 'party:watch', { slug: ADMIN.slug })).profile, undefined)
  }))

test('un thème de saison s’achète pendant sa saison, et se garde après', () =>
  avecBanc(async (banc, horloge) => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    partieDuJour(banc, idDe(banc, 'alice'), '2026-09-28', 500)
    // Le 26 octobre, 10 h à Paris : Halloween est en boutique.
    horloge.t = Date.UTC(2026, 9, 26, 9, 0)
    const achat = await acheter(banc, cookie, 'halloween')
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(achat.corps.boutique.jour, '2026-10-26')
    // Le 2 novembre, la saison est passée : il ne s'achète plus, mais il est à elle.
    horloge.t = Date.UTC(2026, 10, 2, 9, 0)
    assert.equal((await porter(banc, cookie, null)).corps.profile.theme, null)
    assert.equal((await porter(banc, cookie, 'halloween')).corps.profile.theme, 'halloween')
    assert.ok((await lire(banc, cookie)).boutique.possedes.includes('halloween'))
  }))

// ── Une vraie soirée ──────────────────────────────────────────────────────

type Reponse = { choice: number } | { value: number }

/** Joue un quiz de bout en bout depuis l'écran commun, jusqu'à son podium, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, Reponse][][]): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, reponse] of questions[q]) {
      const action = 'choice' in reponse ? { type: 'answer', ...reponse } : { type: 'guess', ...reponse }
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action })
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

/** « Clore la soirée ». */
async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', { title: 'La soirée des confettis' })
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

test('une soirée à deux rapporte ses bonnes réponses en confettis, dès le podium du quiz ; sa fin le dit', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [
      qcm('Le ciel est bleu ?'),
      qcm('L’eau mouille ?'),
      qcm('La Lune est un fromage ?', ['Oui', 'Non'], 1),
      estimation('Combien de marches à la tour Eiffel ?', 1665),
    ])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')

    // Alice : deux justes, une fausse, l'estimation la plus proche — trois
    // confettis. Bob se trompe partout.
    await jouerQuiz(host, quiz, [
      [
        [alice, { choice: 0 }],
        [bob, { choice: 1 }],
      ],
      [
        [alice, { choice: 0 }],
        [bob, { choice: 1 }],
      ],
      [
        [alice, { choice: 0 }],
        [bob, { choice: 0 }],
      ],
      [
        [alice, { value: 1600 }],
        [bob, { value: 300 }],
      ],
    ])
    // Crédités dès le podium du quiz, comme l'expérience : la page les montre en pleine soirée.
    let confettis: any
    for (const limite = Date.now() + 8000; ; await patienter(100)) {
      confettis = (await lire(banc, aliceCookie)).boutique.confettis
      if (confettis.gagnes > 0 || Date.now() > limite) break
    }
    assert.deepEqual(confettis, { gagnes: 3, depenses: 0, solde: 3 })

    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    const finBob = attendre<any>(bob.socket, 'soiree:fin', () => true, 'la fin de soirée de Bob', 15_000)
    await clore(host)
    assert.deepEqual((await finAlice).profil.confettis, {
      gagnes: 3,
      solde: 3,
      abordables: 0,
      vise: { theme: 'cahier', manque: 147 },
    })
    assert.equal((await finBob).profil, undefined, 'un invité anonyme n’a ni profil ni confettis')
  }))

test('seul devant son quiz, la soirée ne rapporte aucun confetti, et sa fin n’en parle pas', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Le ciel est bleu ?'), qcm('L’eau mouille ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '', { cookie: aliceCookie })
    await jouerQuiz(host, quiz, [[[alice, { choice: 0 }]], [[alice, { choice: 0 }]]])
    const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    await clore(host)
    const profil = (await fin).profil
    assert.ok(profil, 'Alice a un profil')
    assert.equal(profil.confettis, undefined)
    assert.deepEqual((await lire(banc, aliceCookie)).boutique.confettis, { gagnes: 0, depenses: 0, solde: 0 })
  }))

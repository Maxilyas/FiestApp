// Les découvertes du 1er novembre 2026 (le propriétaire : « chaque mode de jeu
// doit être représenté et permet d'explorer l'application via les missions du
// jour ») : l'épreuve d'un sentier dans une catégorie — validée ou non, à
// n'importe quel palier —, une épreuve du Cabinet de curiosités, « plus
// rare », et un duel lancé à quelqu'un sur un thème précis. Le tirage, ce
// qu'elles lisent de la journée, ce que la page en dit ; puis chacune faite
// pour de vrai, par les routes de son mode.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { aLaMain, bancDuCabinet, baseDuCabinet, fermerLesMagasins, jouerUnQuiz, lire as lireAuCabinet, ok, poster as posterAuCabinet } from './cabinet-banc'
import { CATEGORIES } from '../../shared/categories'
import { BRANCHES } from '../../shared/branches'
import { sujetParCle, estRemplace } from '../../shared/sujets'
import {
  activiteDesJours,
  AUCUNE_ACTIVITE,
  avancement,
  DECOUVERTES,
  FAMILLES_DES_DEFIS,
  lireLaMission,
  POIDS_DU_CABINET,
  tirerLesMissions,
  vueDeLaMission,
  type ContexteDuTirage,
  type Mission,
  type SorteDeMission,
} from '../../shared/missions'
import { VERSION_DE_LA_TRAVERSEE, etatDeLaTraversee, tracerLaCarte, type DepartDeLaTraversee, type ThemeAuChoix } from '../../shared/cabinet/traversee'
import type { PageDeLaTraversee, VueDeLaPartie, VueDeLaTraversee } from '../../shared/cabinet/vues'
import { Missions, THEMES_DES_DEFIS, type DepsDesMissions } from '../src/core/missions'
import type { LigneDeMission } from '../src/auth/profiles'

after(fermerLesMagasins)

/** Tout se propose : le Cabinet ouvert, quelqu'un à défier, les thèmes du catalogue. */
const TOUT: ContexteDuTirage = {
  quizDuJourJoue: false,
  joursDuJour: 0,
  decouvertesJouees: new Set(),
  defiFini: false,
  aRevoir: 0,
  hier: [],
  cabinet: true,
  adversaires: true,
  themes: THEMES_DES_DEFIS,
}

const tirages = (c: Partial<ContexteDuTirage>, n = 600) => Array.from({ length: n }, (_, i) => tirerLesMissions(`p${i}|2026-11-02`, { ...TOUT, ...c }))
const decouvertes = (c: Partial<ContexteDuTirage>, n = 600) => tirages(c, n).map(m => m[2])

// ── Le tirage, pur ─────────────────────────────────────────────────────────

test('les thèmes d’un duel à lancer : les thèmes et les univers du catalogue, ni une époque redécoupée, ni une fête', () => {
  assert.ok(THEMES_DES_DEFIS.length >= 20, `${THEMES_DES_DEFIS.length} thèmes`)
  for (const t of THEMES_DES_DEFIS) {
    const sujet = sujetParCle(t.cle)
    assert.ok(sujet, t.cle)
    assert.equal(t.nom, sujet.nom)
    assert.ok(FAMILLES_DES_DEFIS.includes(sujet.famille), `${t.cle} : ${sujet.famille}`)
    assert.ok(!estRemplace(t.cle), t.cle)
  }
  assert.ok(THEMES_DES_DEFIS.some(t => t.cle === 'animaux') && THEMES_DES_DEFIS.some(t => t.cle === 'harry-potter'))
})

test('la découverte vise ce qui se joue : le sentier d’une catégorie, le Cabinet là où il s’ouvre, un thème à qui a quelqu’un à défier', () => {
  const toutes = decouvertes({})
  // Chaque découverte se tire — la révision attend son carnet.
  const tirees = new Set(toutes.map(m => m.sorte))
  assert.deepEqual(
    DECOUVERTES.filter(s => !tirees.has(s)),
    ['revision'],
  )
  for (const m of toutes) {
    if (m.sorte === 'sentier') assert.ok((CATEGORIES as readonly string[]).includes(m.categorie!), JSON.stringify(m))
    if (m.sorte === 'defier') {
      assert.ok(THEMES_DES_DEFIS.some(t => t.cle === m.sujet && t.nom === m.nomDuSujet), JSON.stringify(m))
      assert.equal(m.cible, 1)
    }
    if (m.sorte === 'cabinet') assert.deepEqual(m, { sorte: 'cabinet', cible: 1 })
    // Ce qu'elle porte se relit tel quel : rien ne se perd entre le tirage et la base.
    assert.deepEqual(lireLaMission(JSON.parse(JSON.stringify(m))), m)
  }
  // Chaque catégorie a son sentier, et chacune sort.
  assert.equal(new Set(toutes.filter(m => m.sorte === 'sentier').map(m => m.categorie)).size, CATEGORIES.length)
  // Le Cabinet fermé ici, en maintenance ou bientôt disponible : jamais. Personne à défier, ou aucun thème : jamais de duel à lancer.
  assert.ok(decouvertes({ cabinet: false }).every(m => m.sorte !== 'cabinet'))
  assert.ok(decouvertes({ adversaires: false }).every(m => m.sorte !== 'defier'))
  assert.ok(decouvertes({ themes: [] }).every(m => m.sorte !== 'defier'))
  // Le savoir et l'habitude d'un jour restent ceux d'avant : seule la découverte change.
  const avant = { ...TOUT, cabinet: false, adversaires: false, themes: [] }
  for (const [i, m] of tirages({}).entries()) assert.deepEqual(m.slice(0, 2), tirerLesMissions(`p${i}|2026-11-02`, avant).slice(0, 2))
})

test('le Cabinet sort moitié moins souvent qu’une autre découverte, et comme elles plus souvent à qui ne le joue pas', () => {
  const comptes = (c: Partial<ContexteDuTirage>) => {
    const n = new Map<SorteDeMission, number>()
    for (const m of decouvertes(c, 6000)) n.set(m.sorte, (n.get(m.sorte) ?? 0) + 1)
    return n
  }
  // Rien de joué ces sept jours : chaque découverte pèse trois, le Cabinet la moitié.
  const n = comptes({})
  const autres = [...n].filter(([s]) => s !== 'cabinet').map(([, k]) => k)
  const moyenne = autres.reduce((a, b) => a + b, 0) / autres.length
  const part = (n.get('cabinet') ?? 0) / moyenne
  assert.ok(Math.abs(part - POIDS_DU_CABINET) < 0.12, `le Cabinet ${n.get('cabinet')} fois, ${part.toFixed(2)} d’une autre (${Math.round(moyenne)})`)
  // Le Cabinet joué cette semaine, le reste non : il ne sort presque plus.
  const habitue = comptes({ decouvertesJouees: new Set<SorteDeMission>(['cabinet']) })
  assert.ok((habitue.get('cabinet') ?? 0) < (n.get('cabinet') ?? 0) / 2, `${habitue.get('cabinet')} contre ${n.get('cabinet')}`)
  // Hier, le Cabinet : pas aujourd'hui.
  assert.ok(decouvertes({ hier: [{ sorte: 'jour', cible: 1 }, { sorte: 'justes', cible: 10 }, { sorte: 'cabinet', cible: 1 }] }).every(m => m.sorte !== 'cabinet'))
})

// ── Ce qu'elles lisent de la journée ───────────────────────────────────────

test('ce que les nouvelles découvertes lisent de sa journée : l’épreuve par son sentier, le duel qu’il a lancé, le Cabinet par ses réponses', () => {
  const jour = '2026-11-02'
  const midi = Date.UTC(2026, 10, 2, 11)
  const lendemain = Date.UTC(2026, 10, 3, 11)
  const a = activiteDesJours({
    jour: [],
    jourParCategorie: [],
    soirees: [],
    series: [
      // Les mythologies (l'Histoire), ratée ; les océans (la Géographie), validée ; la forêt, libérée — sans issue, pas jouée.
      { id: 'e1', mode: 'sentier', issue: 'ratee', finieLe: midi, branche: 'mythes' },
      { id: 'e2', mode: 'sentier', issue: 'validee', finieLe: midi, branche: 'oceans' },
      { id: 'e3', mode: 'sentier', issue: null, finieLe: midi, branche: 'foret' },
      // Une épreuve en cours ne compte pas encore.
      { id: 'e4', mode: 'sentier', issue: null, finieLe: null, branche: 'stade' },
      // Lancés par lui : sur les animaux, puis sur l'Histoire ; relevé : sur les animaux aussi, c'est l'autre qui l'a défié.
      { id: 'd1', mode: 'duel', issue: null, finieLe: midi, sujet: 'animaux', lance: true },
      { id: 'd2', mode: 'duel', issue: null, finieLe: midi, sujet: null, lance: true },
      { id: 'd3', mode: 'duel', issue: null, finieLe: midi, sujet: 'animaux', lance: false },
      // Le dé, contre Automate : un duel, pas un défi lancé.
      { id: 'r1', mode: 'rencontre', issue: null, finieLe: midi, sujet: 'animaux' },
    ],
    reponses: [
      // Deux épreuves du Cabinet, l'une en deux réponses ; une troisième le lendemain.
      { serie: 'c1', mode: 'cabinet', juste: true, le: midi, categorie: null },
      { serie: 'c1', mode: 'cabinet', juste: false, le: midi + 1, categorie: null },
      { serie: 'c2', mode: 'cabinet', juste: false, le: midi + 2, categorie: null },
      { serie: 'c3', mode: 'cabinet', juste: true, le: lendemain, categorie: null },
    ],
  })
  const ici = a.get(jour)!
  const m = (sorte: SorteDeMission, extra: Partial<Mission> = {}): Mission => ({ sorte, cible: 1, ...extra })
  assert.equal(avancement(m('sentier', { categorie: 'Histoire' }), ici), 1, 'ratée, elle compte')
  assert.equal(avancement(m('sentier', { categorie: 'Géographie' }), ici), 1)
  assert.equal(avancement(m('sentier', { categorie: 'Nature' }), ici), 0, 'libérée, sans issue : pas jouée')
  assert.equal(avancement(m('sentier', { categorie: 'Sport' }), ici), 0, 'en cours : pas encore')
  assert.equal(avancement({ sorte: 'sentier', cible: 3 }, ici), 2, 'tirée avant les catégories : n’importe quel sentier')
  assert.equal(avancement(m('defier', { sujet: 'animaux', nomDuSujet: 'Les animaux' }), ici), 1, 'le sien, pas celui qu’il a relevé')
  assert.equal(avancement(m('defier', { sujet: 'harry-potter', nomDuSujet: 'Harry Potter' }), ici), 0)
  assert.equal(avancement({ sorte: 'defier', cible: 5 }, ici), 2, 'relue sans sujet : n’importe quel duel lancé')
  assert.equal(avancement(m('duel', { cible: 9 }), ici), 4, 'les duels de toujours comptent tous, le dé compris')
  assert.equal(avancement({ sorte: 'cabinet', cible: 5 }, ici), 2, 'deux épreuves, chacune une fois')
  assert.equal(avancement(m('cabinet'), a.get('2026-11-03')!), 1)
  assert.equal(avancement(m('cabinet'), AUCUNE_ACTIVITE), 0)
  // Ses bonnes réponses du Cabinet comptent toujours pour le savoir.
  assert.equal(ici.justes, 1)
})

test('une mission relue : l’épreuve d’avant sans catégorie, le duel et son thème, et ce qui ne se lit plus', () => {
  assert.deepEqual(lireLaMission({ sorte: 'sentier', cible: 1 }), { sorte: 'sentier', cible: 1 })
  assert.deepEqual(lireLaMission({ sorte: 'sentier', cible: 1, categorie: 'Histoire' }), { sorte: 'sentier', cible: 1, categorie: 'Histoire' })
  // Une catégorie qui n'existe plus : n'importe quel sentier, elle reste faisable.
  assert.deepEqual(lireLaMission({ sorte: 'sentier', cible: 1, categorie: 'Astrologie' }), { sorte: 'sentier', cible: 1 })
  assert.deepEqual(lireLaMission({ sorte: 'cabinet', cible: 1, categorie: 'Histoire' }), { sorte: 'cabinet', cible: 1 })
  assert.deepEqual(lireLaMission({ sorte: 'defier', cible: 1, sujet: 'animaux', nomDuSujet: 'Les animaux' }), { sorte: 'defier', cible: 1, sujet: 'animaux', nomDuSujet: 'Les animaux' })
  // Un sujet illisible tombe avec son nom : n'importe quel thème.
  assert.deepEqual(lireLaMission({ sorte: 'defier', cible: 1, sujet: 'DROP TABLE', nomDuSujet: 'Les animaux' }), { sorte: 'defier', cible: 1 })
  assert.deepEqual(lireLaMission({ sorte: 'defier', cible: 1, sujet: 'animaux', nomDuSujet: 'x'.repeat(81) }), { sorte: 'defier', cible: 1, sujet: 'animaux' })
  // La catégorie d'une mission de savoir reste exigée.
  assert.equal(lireLaMission({ sorte: 'categorie', cible: 5, categorie: 'Astrologie' }), null)
})

test('ce que la page en dit : chaque nouvelle mission, son titre, son aide, et où la faire d’un toucher', () => {
  const vue = (m: Mission) => vueDeLaMission(2, m, AUCUNE_ACTIVITE, false)
  const sentier = vue({ sorte: 'sentier', cible: 1, categorie: 'Histoire' })
  assert.deepEqual([sentier.famille, sentier.titre, sentier.lien], ['decouverte', 'Tente une épreuve en Histoire', { href: '/campagne#sentier-mythes', libelle: 'Le sentier' }])
  assert.match(sentier.aide, /« Les mythologies »/)
  // Chaque catégorie mène à son sentier.
  for (const b of BRANCHES) assert.equal(vue({ sorte: 'sentier', cible: 1, categorie: b.categorie }).lien.href, `/campagne#sentier-${b.key}`)
  assert.deepEqual(vue({ sorte: 'sentier', cible: 1 }).lien, { href: '/campagne#sentiers', libelle: 'Les sentiers' })
  const cabinet = vue({ sorte: 'cabinet', cible: 1 })
  assert.deepEqual([cabinet.famille, cabinet.titre, cabinet.lien], ['decouverte', 'Joue une épreuve au Cabinet de curiosités', { href: '/cabinet', libelle: 'Le Cabinet' }])
  const defier = vue({ sorte: 'defier', cible: 1, sujet: 'animaux', nomDuSujet: 'Les animaux' })
  assert.deepEqual(
    [defier.famille, defier.titre, defier.lien],
    ['decouverte', 'Défie quelqu’un sur « Les animaux »', { href: '/duels#defier', libelle: 'Défier', sujet: 'animaux' }],
  )
  assert.deepEqual([vue({ sorte: 'defier', cible: 1 }).titre, vue({ sorte: 'defier', cible: 1 }).lien], ['Défie quelqu’un en duel', { href: '/duels#defier', libelle: 'Défier' }])
})

test('le tirage du serveur : le Cabinet tant qu’il se joue ici, un duel à lancer à qui a quelqu’un à défier', async () => {
  // Ses missions tirées à sa première lecture du jour, sur ce que ses magasins disent : deux cents profils, le même jour.
  const tireesPour = async (cabinet: boolean, adversaires: boolean) => {
    const tirees: Mission[] = []
    const missions = new Missions({
      profiles: {
        lignesDesMissions: async () => [],
        tirerLesMissions: async (_: string, jour: string, ms: readonly Mission[]): Promise<LigneDeMission[]> => {
          tirees.push(ms[2])
          return [...ms.map((mission, rang) => ({ jour, rang, mission, faiteLe: null })), { jour, rang: 3, mission: null, faiteLe: null }]
        },
        accomplirDesMissions: async () => [],
        joursAuxTrois: async () => [],
        semainesDesCoffres: async () => new Set<string>(),
        coffresOfferts: async () => [],
        soireesDepuis: async () => [],
        aQuiDefier: async () => adversaires,
      } as unknown as DepsDesMissions['profiles'],
      jour: { activiteDepuis: async () => ({ jour: [], jourParCategorie: [] }), coffresDuMois: async () => [] },
      campagne: { activiteDepuis: async () => ({ series: [], reponses: [] }), aRevoirDe: async () => 0 },
      cabinetOuvert: () => cabinet,
      maintenant: () => Date.UTC(2026, 10, 2, 9),
    })
    for (let i = 0; i < 200; i++) await missions.duJour(`profil-${i}`)
    return tirees.map(m => m.sorte)
  }
  const ferme = await tireesPour(false, false)
  assert.ok(!ferme.includes('cabinet') && !ferme.includes('defier'), ferme.join(' '))
  const ouvert = await tireesPour(true, true)
  assert.ok(ouvert.includes('cabinet') && ouvert.includes('defier'), ouvert.join(' '))
})

// ── Pour de vrai, par les routes ───────────────────────────────────────────

/** Le jeudi 15 octobre 2026, à 10 h à Paris. */
const JEUDI = Date.UTC(2026, 9, 15, 8)

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fichier: string, fn: (db: Database.Database) => T): T {
  const db = new Database(fichier)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Ses missions du jour, posées d'avance — le tirage dépend de son identifiant — : le quiz du jour, cent bonnes réponses, et la découverte qu'on éprouve. */
function poserLesMissions(fichier: string, profileId: string, jour: string, decouverte: Mission, quand: number) {
  const missions: Mission[] = [{ sorte: 'jour', cible: 1 }, { sorte: 'justes', cible: 100 }, decouverte]
  base(fichier, db => {
    const inserer = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le) VALUES (?, ?, ?, ?, ?)')
    missions.forEach((m, rang) => inserer.run(profileId, jour, rang, JSON.stringify(m), quand))
    inserer.run(profileId, jour, 3, '{}', quand)
  })
}

/** La découverte du jour, telle que l'accueil la lit : son titre, où il en est, faite ou non, et si cette lecture vient de la retenir. */
async function laDecouverte(banc: Banc, cookie: string) {
  const m = (await lire(banc, cookie, '/api/joueur/missions')).corps
  const d = m.missions.find((x: any) => x.rang === 2)
  return { titre: d.titre as string, avance: d.avance as number, faite: d.faite as boolean, lien: d.lien, nouvelle: (m.nouvelles as number[]).includes(2) }
}

const idDe = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi?leger')).corps.profile.id as string

test('l’épreuve d’un sentier, dans sa catégorie : ratée, elle compte — celle d’un autre sentier, non', async () => {
  const banc = await demarrer({ horlogeDuJour: () => JEUDI, baseDeLaCampagne: baseDEssai(32, { categories: ['Histoire', 'Nature'] }) })
  const fichier = banc.quizDbUrl.replace(/^file:/, '')
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    poserLesMissions(fichier, await idDe(banc, lea), '2026-10-15', { sorte: 'sentier', cible: 1, categorie: 'Histoire' }, JEUDI)
    const avant = await laDecouverte(banc, lea)
    assert.deepEqual(avant, { titre: 'Tente une épreuve en Histoire', avance: 0, faite: false, lien: { href: '/campagne#sentier-mythes', libelle: 'Le sentier' }, nouvelle: false })
    /** Une épreuve jouée jusqu'au bout, toutes ses réponses fausses : ratée à la faute de trop. */
    const rater = async (branche: string) => {
      let e = (await poster(banc, lea, '/api/campagne/sentiers/epreuve', { branche, palier: 1 })).corps
      assert.ok(e.id, e.error)
      while (!e.finie && e.question) {
        const q = e.question
        const r = await poster(banc, lea, `/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix: q.reponses.findIndex((x: string) => !x.startsWith('Bonne')) })
        assert.equal(r.status, 200, r.corps.error)
        e = r.corps.epreuve
      }
      assert.equal(e.issue, 'ratee')
    }
    // La forêt (la Nature) : pas son sentier.
    await rater('foret')
    assert.equal((await laDecouverte(banc, lea)).faite, false)
    // Les mythologies (l'Histoire), ratée : la mission est faite, et la fin de l'épreuve l'annonce.
    await rater('mythes')
    const apres = await laDecouverte(banc, lea)
    assert.deepEqual([apres.avance, apres.faite, apres.nouvelle], [1, true, true])
  } finally {
    await banc.close()
  }
})

test('un duel lancé sur son thème, contre quelqu’un : la mission est faite à sa dernière réponse — pas sur un autre thème, ni pour qui le relève', async () => {
  // Les questions de la Nature, dans la base d'essai, sont des animaux (`animaux`, `shared/sujets.ts`).
  const banc = await demarrer({ horlogeDuJour: () => JEUDI, baseDeLaCampagne: baseDEssai(32, { categories: ['Histoire', 'Nature'] }) })
  const fichier = banc.quizDbUrl.replace(/^file:/, '')
  try {
    const [lea, tom, zoe] = [await inscrireProfil(banc.url, 'lea', 'Léa'), await inscrireProfil(banc.url, 'tom', 'Tom'), await inscrireProfil(banc.url, 'zoe', 'Zoé')]
    const animaux: Mission = { sorte: 'defier', cible: 1, sujet: 'animaux', nomDuSujet: 'Les animaux' }
    poserLesMissions(fichier, await idDe(banc, lea), '2026-10-15', animaux, JEUDI)
    poserLesMissions(fichier, await idDe(banc, tom), '2026-10-15', animaux, JEUDI)
    const avant = await laDecouverte(banc, lea)
    assert.deepEqual([avant.titre, avant.lien], ['Défie quelqu’un sur « Les animaux »', { href: '/duels#defier', libelle: 'Défier', sujet: 'animaux' }])
    /** Une tentative jouée jusqu'au bout, toutes ses réponses fausses : trois vies, trois questions. */
    const jouer = async (cookie: string, serie: { id: string }) => {
      const questions = base(fichier, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id) as { questions: string }).questions)) as {
        bonne: number
        reponses: string[]
      }[]
      let fin: any = null
      for (let i = 0; !fin?.finie; i++) {
        const r = await poster(banc, cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: (questions[i].bonne + 1) % questions[i].reponses.length })
        assert.equal(r.status, 200, r.corps.error)
        fin = r.corps
      }
    }
    // Contre Zoé, sur l'Histoire : un duel lancé, pas sur son thème.
    const histoire = await poster(banc, lea, '/api/campagne/duel', { categories: ['Histoire'], adversaire: await idDe(banc, zoe) })
    assert.equal(histoire.status, 200, histoire.corps.error)
    await jouer(lea, histoire.corps.serie)
    assert.equal((await laDecouverte(banc, lea)).faite, false)
    // Contre Tom, sur les animaux : commencé, rien encore ; fini, la mission est faite.
    const lance = await poster(banc, lea, '/api/campagne/duel', { sujet: 'animaux', adversaire: await idDe(banc, tom) })
    assert.equal(lance.status, 200, lance.corps.error)
    assert.equal((await laDecouverte(banc, lea)).faite, false, 'sa tentative pas finie : le duel n’est pas encore parti')
    await jouer(lea, lance.corps.serie)
    const faite = await laDecouverte(banc, lea)
    assert.deepEqual([faite.avance, faite.faite, faite.nouvelle], [1, true, true])
    // Tom le relève, sur les mêmes animaux : c'est Léa qui l'a défié — sa mission à lui attend le sien.
    const releve = await poster(banc, tom, `/api/campagne/duel/${lance.corps.code}`)
    assert.equal(releve.status, 200, releve.corps.error)
    await jouer(tom, releve.corps)
    const deTom = await laDecouverte(banc, tom)
    assert.deepEqual([deTom.avance, deTom.faite], [0, false])
  } finally {
    await banc.close()
  }
})

test('une épreuve du Cabinet : entrée sans répondre, rien ; à sa première réponse, la mission est faite', async () => {
  const b = await bancDuCabinet({ baseDeLaCampagne: baseDuCabinet(16) })
  try {
    const cookie = await inscrireProfil(b.banc.url, 'curieuse', 'Inès')
    const profil = await idDe(b.banc, cookie)
    poserLesMissions(b.fichier, profil, '2026-10-24', { sorte: 'cabinet', cible: 1 }, b.horloge.t)
    const avant = await laDecouverte(b.banc, cookie)
    assert.deepEqual([avant.titre, avant.avance, avant.lien], ['Joue une épreuve au Cabinet de curiosités', 0, { href: '/cabinet', libelle: 'Le Cabinet' }])
    // Une traversée écrite à la main, ses cartes choisies, sa première étape un Quiz sur l'Histoire (`cabinet-quiz.test.ts`).
    let x = 7
    const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
    const actes = tracerLaCarte(hasard, ['lg:renard', 'lg:sphinx', 'lg:dragon'], { epingle: ['Rome'], frise: ['Rome'] })
    const premiere = actes[0].etapes.find(e => e.id === 'a0r1c0')!
    const choix: ThemeAuChoix[] = [{ theme: 'Histoire' }, { theme: 'Sport' }, { theme: 'Nature' }]
    const { theme: _t, sujet: _s, emoji: _e, ...sansTheme } = premiere
    const depart: DepartDeLaTraversee = {
      v: VERSION_DE_LA_TRAVERSEE,
      jour: '2026-10-24',
      actes: [{ ...actes[0], etapes: actes[0].etapes.map(e => (e.id === premiere.id ? { ...sansTheme, sorte: 'epreuve' as const, jeu: 'quiz' as const, choix } : e)) }, actes[1], actes[2]],
    }
    assert.equal(etatDeLaTraversee(depart, [{ geste: { quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }, faitLe: 0 }]).ou.sorte, 'carte')
    const id = `traversee-des-missions-${profil}`
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`
    aLaMain(
      b.fichier,
      [
        `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(depart))}, 1)`,
        `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, 1, ${q(JSON.stringify({ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }))}, 2, 'u0')`,
      ].join(';\n'),
    )
    const t = ok(await lireAuCabinet<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee'), 'la page').traversee!
    const entree = ok(
      await posterAuCabinet<PageDeLaTraversee & { error?: string }>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'aller', etape: premiere.id, theme: 0 } }),
      'l’entrée',
    ).traversee as VueDeLaTraversee
    const partie = entree.partie as VueDeLaPartie
    assert.equal(partie.jeu, 'quiz')
    // Entrée, pas encore répondu : l'épreuve n'est pas jouée.
    assert.equal((await laDecouverte(b.banc, cookie)).faite, false)
    // Sa première manche répondue — ratée, peu importe : la mission est faite.
    await jouerUnQuiz(b, cookie, partie, 0, false)
    const apres = await laDecouverte(b.banc, cookie)
    assert.deepEqual([apres.avance, apres.faite, apres.nouvelle], [1, true, true])
  } finally {
    await b.banc.close()
  }
})

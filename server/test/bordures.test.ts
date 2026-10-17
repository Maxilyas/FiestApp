// Les bordures de ligue (le souhait du propriétaire du 12 octobre 2026, sur
// la maquette des alliages : « Go pour implémenter ça ») : chaque ligue
// atteinte en duel ouvre sa bordure crantée autour de l'avatar, chaque duel
// gagné dans la ligue en sertit un cran, douze la sertissent. La ligue donne
// la forme et la pierre, la finition le métal. Rien ne se tient à côté : les
// crans se relisent dans le journal des duels, seul le choix s'enregistre.
//
// Ce qui sort d'un médaillon passe par-dessus elle (« je veux garder ce truc
// pour les avatars ») ; la lumière des finitions 15, 20 et 25 garde son
// atmosphère et lui laisse ses anneaux ; un Divin n'en prend aucune.
// Chaque test échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { ADMIN, baseDEssai, connexionAnimateur, demarrer, ecranCommun, ecrire, inscrireProfil, instantane, invite, type Banc, type Invite } from './banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES, semaineDe } from '../../shared/campagne'
import { jourDe } from '../../shared/jour'
import { AUCUNE_BORDURE, CRANS_D_UNE_BORDURE, bordurePortee, choixDeBordure, coteDuScore, releverLesDuels, type BordureDeLigue, type DuelJoue } from '../../shared/duels'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// Un mardi : la semaine a de quoi se jouer.
const DEBUT = Date.UTC(2026, 9, 6, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })
const semaine = (t: number) => semaineDe(jourDe(t))

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Un duel classé fini, tel que le journal le relit : ses bonnes réponses, celles d'en face — contre quelqu'un, classé
 * à la cote de ce score. Au dé, à chances égales depuis le 16 octobre 2026, un gros score battu ne rapporte pas plus
 * qu'un petit (`duels-de.test.ts`).
 */
const duel = (i: number, justes: number, sesJustes: number): DuelJoue => ({
  serie: `s${String(i).padStart(3, '0')}`,
  justes,
  sesJustes,
  finiLe: DEBUT + i * 60_000,
  coteAdverse: coteDuScore(sesJustes),
})

/** Dix victoires contre des joueurs à 1400 — quinze bonnes réponses : quatre en bronze, quatre en argent, deux en or — une cote de 1 241. */
const DIX_VICTOIRES = [...Array(10)].map((_, i) => duel(i, 16, 15))

/**
 * Quatorze victoires au dé, écrites au journal de qui les a jouées, finies ces dernières heures : à chances égales,
 * dix-sept points chacune sous l'Or, treize dès l'Or — six en bronze, six en argent, deux en or, une cote de 1 230.
 */
const VICTOIRES_AU_DE = 14
const victoiresAuJournal = (banc: Banc, profileId: string) => {
  for (let i = 0; i < VICTOIRES_AU_DE; i++) duelAuJournal(banc, profileId, 16, 15, DEBUT - (VICTOIRES_AU_DE - i) * 3_600_000)
}
const BORDURES_DU_DE: BordureDeLigue[] = [
  { ligue: 'bronze', crans: 6 },
  { ligue: 'argent', crans: 6 },
  { ligue: 'or', crans: 2 },
]

// ── 1. Les crans se relisent dans le journal ──────────────────────────────

test('un duel gagné sertit un cran de la ligue où il s’est joué ; rien ne se reprend en redescendant', () => {
  // Aucun duel : aucune bordure — l'absence, pas une bordure de bronze.
  assert.deepEqual(releverLesDuels([], semaine).bordures, [])
  // Chaque victoire compte dans la ligue de sa cote avant le duel ; atteindre l'or ouvre sa bordure.
  const dix = releverLesDuels(DIX_VICTOIRES, semaine)
  assert.equal(dix.cote, 1241)
  assert.deepEqual(dix.bordures, [
    { ligue: 'bronze', crans: 4 },
    { ligue: 'argent', crans: 4 },
    { ligue: 'or', crans: 2 },
  ])
  // Une défaite, une égalité ne sertissent rien — mais le premier duel ouvre la bordure de sa ligue.
  assert.deepEqual(releverLesDuels([duel(0, 3, 14), duel(1, 8, 8)], semaine).bordures, [{ ligue: 'bronze', crans: 0 }])
  // Monté en diamant, redescendre en platine ne reprend ni le diamant ni ses crans ; une victoire en platine y sertit
  // le sien. (L'argent, l'or et la platine, une fois atteints, ne se perdent plus — la platine depuis le 17 octobre
  // 2026 : c'est du diamant qu'on redescend.)
  const montee = [...DIX_VICTOIRES, ...Array.from({ length: 10 }, (_, k) => duel(10 + k, 21, 20))]
  const chute = [...montee, ...[20, 21, 22, 23].map(i => duel(i, 1, 9))]
  const apres = releverLesDuels(chute, semaine)
  assert.ok(apres.cote >= 1300 && apres.cote < 1400, `redescendu en platine (${apres.cote})`)
  assert.deepEqual(apres.bordures.find(b => b.ligue === 'diamant'), { ligue: 'diamant', crans: 2 })
  const relevee = releverLesDuels([...chute, duel(24, 16, 15)], semaine)
  assert.deepEqual(relevee.bordures.find(b => b.ligue === 'platine'), { ligue: 'platine', crans: 6 })
  // Douze crans au plus : treize victoires en bronze la sertissent, sans rien de plus.
  const treize = releverLesDuels([...Array(13)].map((_, i) => duel(i, 3, 0)), semaine)
  assert.deepEqual(treize.bordures, [{ ligue: 'bronze', crans: CRANS_D_UNE_BORDURE }])
})

test('la bordure portée : auto, la plus haute qui a un cran ; une ligue choisie, même vide ; aucune', () => {
  const bordures: BordureDeLigue[] = [
    { ligue: 'bronze', crans: 12 },
    { ligue: 'argent', crans: 4 },
    { ligue: 'or', crans: 0 },
  ]
  // Auto : la plus haute qui a un cran — l'or, encore vide, attend sa première victoire.
  assert.deepEqual(bordurePortee('auto', bordures), { ligue: 'argent', crans: 4 })
  assert.deepEqual(bordurePortee(null, bordures), { ligue: 'argent', crans: 4 })
  // Choisie : elle, même vide — il la montre s'il le veut.
  assert.deepEqual(bordurePortee('or', bordures), { ligue: 'or', crans: 0 })
  assert.deepEqual(bordurePortee('bronze', bordures), { ligue: 'bronze', crans: 12 })
  assert.equal(bordurePortee(AUCUNE_BORDURE, bordures), null)
  // Une ligue qu'il n'a pas atteinte — une page d'avant, une règle changée — se lit auto.
  assert.deepEqual(bordurePortee('maitre', bordures), { ligue: 'argent', crans: 4 })
  // Sans duel, ou sans un cran nulle part : rien d'office.
  assert.equal(bordurePortee('auto', undefined), null)
  assert.equal(bordurePortee('auto', []), null)
  assert.equal(bordurePortee('auto', [{ ligue: 'bronze', crans: 0 }]), null)
  // Ce qui n'est pas un choix vaut auto.
  for (const brut of ['arc-en-ciel', 42, null, undefined, '']) assert.equal(choixDeBordure(brut), 'auto', String(brut))
  assert.equal(choixDeBordure(AUCUNE_BORDURE), AUCUNE_BORDURE)
  assert.equal(choixDeBordure('maitre'), 'maitre')
})

// ── 2. Le dessin : la ligue donne la forme et la pierre, la finition le métal ──

interface Dessins {
  svgDuCadre(ligue: string, crans: number, finition: string): string
  svgDesRayons(ligue: string, crans: number, finition: string): string | null
  dessinDeBordure(ligue: string, crans: number, finition: string): { cadre: string; rayons: string | null }
}

test('chaque cran est une victoire : les rubis des Fleurons s’allument tous les trois, sertie elle s’illumine', async () => {
  const d: Dessins = await import(url('components/dessinDesBordures.ts'))
  // Les quatre rubis : un tous les trois crans, celui de midi au douzième.
  const rubis = (svg: string) => (svg.match(/<path d="([^"]*)" fill="#8f1028"/)?.[1].match(/M/g) ?? []).length
  assert.deepEqual([2, 3, 8, 9, 12].map(n => rubis(d.svgDuCadre('or', n, 'or'))), [0, 1, 2, 3, 4])
  // Un cran à gagner se dessine en pointillé ; sertie, plus aucun, et sa lueur s'allume.
  assert.match(d.svgDuCadre('argent', 0, 'holo'), /stroke-dasharray/)
  assert.match(d.svgDuCadre('argent', 11, 'holo'), /stroke-dasharray/)
  assert.doesNotMatch(d.svgDuCadre('argent', 11, 'holo'), /filter="url\(#b\)"/)
  assert.doesNotMatch(d.svgDuCadre('argent', 12, 'holo'), /stroke-dasharray/)
  assert.match(d.svgDuCadre('argent', 12, 'holo'), /filter="url\(#b\)"/)
  // La finition donne le métal ; en Mat, c'est celui de la ligue.
  assert.notEqual(d.svgDuCadre('or', 12, 'or'), d.svgDuCadre('or', 12, 'argent'))
  assert.equal(d.svgDuCadre('argent', 12, 'mat'), d.svgDuCadre('argent', 12, 'argent'))
  assert.equal(d.svgDuCadre('platine', 12, 'mat').includes('#f2f6fa'), true, 'le Givre en Mat est de platine')
  // Rien au milieu : l'emoji garde son halo, le médaillon son cercle.
  assert.doesNotMatch(d.svgDuCadre('bronze', 12, 'or'), /<circle cx="100" cy="100" r="(5\d|[1-4]\d)(\.\d+)?" fill="(?!none)/)
  // Seuls les maîtres ont des rayons, à part : ils tournent.
  assert.equal(d.svgDesRayons('or', 12, 'or'), null)
  assert.match(d.svgDesRayons('maitre', 12, 'or')!, /<path/)
  // Une image par alliage et par nombre de crans, faite une fois pour la page.
  assert.equal(d.dessinDeBordure('or', 7, 'or'), d.dessinDeBordure('or', 7, 'or'))
  assert.match(d.dessinDeBordure('or', 7, 'or').cadre, /^data:image\/svg\+xml,/)
})

// ── 3. Autour de l'avatar ─────────────────────────────────────────────────

/** Ce que le test lit du module des dessins — écrit à la main, comme `medaillons.test.ts`. */
interface Medaillons {
  sortesDesAvatars(avatars: readonly { legendaire?: string | null; finition?: string | null; bordure?: unknown }[]): string[]
}

/** Un avatar du client, rendu en HTML — la même recette que `lumieres.test.ts`. */
async function avatar(props: object): Promise<string> {
  Object.assign(globalThis, { React: (await import('react')).default })
  const { Avatar } = await import(url('components/Avatar.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  return renderToStaticMarkup(React.createElement(Avatar, { avatar: '🦊', ...props }))
}

const OR_3 = { ligue: 'or', crans: 3 }

test('la bordure vient avec son fichier, derrière l’avatar ; ce qui sort d’un médaillon passe par-dessus ; un Divin n’en prend aucune', async () => {
  const m: Medaillons = await import(url('components/medaillons.ts'))
  // Une page où personne n'en porte ne la télécharge pas ; un Divin ne la fait pas venir.
  assert.deepEqual(m.sortesDesAvatars([{ finition: 'or' }, {}]), [])
  assert.deepEqual(m.sortesDesAvatars([{ finition: 'or', bordure: OR_3 }]), ['bordure'])
  assert.deepEqual(m.sortesDesAvatars([{ legendaire: 'dv:lotus', bordure: OR_3 }]), ['divin'])
  // En l'attendant, l'avatar d'avant : rien autour.
  assert.doesNotMatch(await avatar({ finition: 'or', bordure: OR_3 }), /class="bo |av-bordure/)

  for (const f of ['Bordure', 'Lumiere', 'Legendaire', 'Divin']) await import(url(`components/${f}.tsx`))
  const emoji = await avatar({ finition: 'or', bordure: OR_3 })
  assert.match(emoji, /class="av av-or av-bordure"/)
  // Derrière l'emoji : posée avant lui, qui passe au-dessus (`.av-emoji`).
  assert.ok(emoji.indexOf('class="bo bo-or"') >= 0 && emoji.indexOf('class="bo bo-or"') < emoji.indexOf('class="av-emoji"'))
  // Muette : l'oreille entend l'avatar, pas ses crans.
  assert.match(emoji, /<span class="bo bo-or" aria-hidden="true">/)
  assert.doesNotMatch(emoji, /<img(?![^>]*alt="")/, 'chaque image est décorative')
  // Sertie, elle le dit à sa classe ; aux maîtres, ses rayons à part.
  assert.match(await avatar({ finition: 'or', bordure: { ligue: 'maitre', crans: 12 } }), /class="bo bo-maitre bo-sertie" aria-hidden="true"><img class="bo-rayons"/)
  // Le Phénix éclaté sort de son cadre par-dessus la bordure : son débord vit dans l'avatar, posé après elle.
  const phenix = await avatar({ legendaire: 'lg:phenix', finition: 'or', eclat: true, bordure: { ligue: 'or', crans: 12 } })
  assert.match(phenix, /lg-debord/)
  assert.ok(phenix.indexOf('class="bo bo-or bo-sertie"') < phenix.indexOf('lg-debord'))
  // Un Divin a sa propre lumière : ni finition ni bordure.
  const divin = await avatar({ legendaire: 'dv:lotus', finition: 'constellation', bordure: { ligue: 'maitre', crans: 12 } })
  assert.match(divin, /class="av av-divin"/)
  assert.doesNotMatch(divin, /class="bo |av-bordure/)
})

test('une carte attend sa bordure avant de s’ouvrir, comme la lumière de sa finition', async () => {
  // La carte s'ouvrait sans l'attendre, et la bordure se posait ensuite sous les yeux.
  const { dessinsDeLaCarte } = await import(url('components/CarteJoueur.tsx'))
  const carte = (plus: object = {}, profil: object = {}) => ({ nom: 'Tom', avatar: '🐻', finition: 'or', ...plus, profil: { legendaires: [], divins: [], ...profil } })
  assert.deepEqual(dessinsDeLaCarte(carte({ bordure: { ligue: 'maitre', crans: 12 } })), ['bordure'])
  assert.deepEqual(dessinsDeLaCarte(carte({ finition: 'aurore', bordure: OR_3 })), ['lumiere', 'bordure'])
  // Sans bordure, rien de plus ; sans profil, rien du tout.
  assert.deepEqual(dessinsDeLaCarte(carte()), [])
  assert.deepEqual(dessinsDeLaCarte({ nom: 'Invité', avatar: '🐸' }), [])
})

test('sous une bordure, la lumière des finitions 15, 20 et 25 garde son atmosphère et lui laisse ses anneaux', async () => {
  for (const f of ['Bordure', 'Lumiere', 'Legendaire']) await import(url(`components/${f}.tsx`))
  const couronne = { ligue: 'diamant', crans: 12 }
  // Le Diamant : ses arcs-en-ciel et son étincelle restent ; sa bague de cristal laisse la place.
  const diamant = await avatar({ finition: 'prisme', bordure: couronne })
  for (const c of ['lu-dispersion', 'lu-spectres-1', 'lu-etincelle', 'lu-glace']) assert.match(diamant, new RegExp(c), c)
  assert.doesNotMatch(diamant, /lu-cristal|lu-feux|lu-balayage/)
  // L'Astrolabe : sa nébuleuse et son étoile en orbite, sans le limbe ni l'anneau serti.
  const astrolabe = await avatar({ finition: 'constellation', bordure: couronne })
  for (const c of ['lu-nebuleuse', 'lu-poussiere', 'lu-orbite-arriere', 'lu-orbite-avant']) assert.match(astrolabe, new RegExp(c), c)
  assert.doesNotMatch(astrolabe, /lu-astrolabe|lu-gemmes/)
  // Les Voiles se lèvent derrière elle.
  assert.match(await avatar({ finition: 'aurore', bordure: couronne }), /lu-voile-1/)
  // L'ordre : la lumière de derrière, la bordure, l'avatar, la lumière de devant.
  const ordre = ['lu lu-arriere', 'class="bo ', 'class="av-emoji"', 'lu lu-avant'].map(t => astrolabe.indexOf(t))
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, `l'ordre des calques (${ordre})`)
  assert.ok(ordre.every(i => i >= 0))
  // Sans bordure, la lumière garde tout.
  assert.match(await avatar({ finition: 'prisme' }), /lu-cristal/)
  assert.match(await avatar({ finition: 'constellation' }), /lu-astrolabe/)
})

test('la bordure ne bouge que par ce que le navigateur compose, se fige dans les listes, s’arrête avec moins de mouvement', () => {
  for (const calque of ['bo-rayons', 'bo-reflet']) {
    const corps = CSS.match(new RegExp(`\\.${calque}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    assert.match(corps, /animation:\s*av-tourne\b/, `${calque} tourne par rotate`)
  }
  const regles = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ sel: sel.trim(), corps }))
  const figee = regles.find(r => r.sel.split(',').some(s => s.trim() === '.av.lb-avatar:not(.av-sujet) .bo *'))
  assert.ok(figee && /animation:\s*none/.test(figee.corps), 'figée dans une ligne de classement')
  assert.match(CSS, /\.bo \* \{ animation: none !important; \}/)
})

// ── 4. Le serveur : son choix, ses refus, et ce que les autres voient ─────

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const porter = (banc: Banc, cookie: string, bordure: unknown) =>
  ecrire(banc.url, '/api/joueur/moi', { bordure }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Un duel au hasard joué, écrit au journal : `justes` contre `sesJustes`, fini à `quand`. */
function duelAuJournal(banc: Banc, profileId: string, justes: number, sesJustes: number, quand: number) {
  const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
  base(banc, db =>
    db
      .prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      )
      .run(randomUUID(), profileId, justes + VIES, justes, quand - 30_000, quand, JSON.stringify(adversaire)),
  )
}

test('la loge propose ses bordures ; le serveur garde son choix, refuse une ligue pas atteinte, et la montre au classement et sur sa carte', async () => {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const idLea = idDe(banc, 'lea')

    // Avant son premier duel : rien à proposer, rien à porter.
    const neuve = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.equal(neuve.bordures, undefined)
    assert.equal(neuve.bordureChoisie, 'auto')
    const tropTot = await porter(banc, lea, 'bronze')
    assert.equal(tropTot.status, 400)
    assert.equal(tropTot.corps.error, 'Cette bordure s’ouvre en atteignant la ligue de bronze en duel')

    // Quatorze duels gagnés au dé, ces dernières heures : le bronze, l'argent et l'or, leurs crans.
    victoiresAuJournal(banc, idLea)
    const page = (await lire(banc, lea, '/api/joueur/moi')).corps.profile
    assert.deepEqual(page.bordures, BORDURES_DU_DE)
    // Au classement des duels, d'office : sa plus haute qui a un cran.
    const ligneDe = async (qui: string) => (await lire(banc, qui, '/api/duels')).corps.classement.lignes.find((l: any) => l.profileId === idLea)
    assert.deepEqual((await ligneDe(tom)).bordure, { ligue: 'or', crans: 2 })

    // Elle choisit l'argent : sa page le garde, sa carte le montre à Tom.
    const argent = await porter(banc, lea, 'argent')
    assert.equal(argent.status, 200, argent.corps.error)
    assert.equal(argent.corps.profile.bordureChoisie, 'argent')
    const carte = (await lire(banc, tom, `/api/joueur/carte/${idLea}`)).corps
    // Portée avec son avatar, comme sa finition : pas recopiée dans son profil.
    assert.deepEqual(carte.bordure, { ligue: 'argent', crans: 6 })
    assert.equal(carte.profil.bordure, undefined)
    assert.deepEqual(carte.profil.duels, { ligue: 'or', cote: 1230 }, 'sa ligue et sa cote, sans ses bordures recopiées')
    assert.deepEqual((await ligneDe(tom)).bordure, { ligue: 'argent', crans: 6 })

    // Une ligue qu'elle n'a pas atteinte, ou qui n'existe pas : refusées en clair, rien n'est écrit.
    const platine = await porter(banc, lea, 'platine')
    assert.equal(platine.status, 400)
    assert.equal(platine.corps.error, 'Cette bordure s’ouvre en atteignant la ligue de platine en duel')
    const inconnue = await porter(banc, lea, 'arc-en-ciel')
    assert.equal(inconnue.status, 400)
    assert.equal(inconnue.corps.error, 'Cette bordure n’existe pas')
    assert.equal((await lire(banc, lea, '/api/joueur/moi')).corps.profile.bordureChoisie, 'argent')

    // Aucune : ni au classement ni sur sa carte ; puis auto de nouveau.
    assert.equal((await porter(banc, lea, AUCUNE_BORDURE)).status, 200)
    assert.equal((await ligneDe(tom)).bordure, undefined)
    assert.equal((await lire(banc, tom, `/api/joueur/carte/${idLea}`)).corps.bordure, undefined)
    const auto = await porter(banc, lea, null)
    assert.equal(auto.corps.profile.bordureChoisie, 'auto')
    assert.deepEqual((await ligneDe(lea)).bordure, { ligue: 'or', crans: 2 })
    // Et l'accueil la reçoit avec ses duels : sa ligne d'identité la montre.
    assert.deepEqual((await lire(banc, lea, '/api/joueur/moi?accueil')).corps.profile.duels.bordures, page.bordures)
  } finally {
    await banc.close()
  }
})

// ── 5. La salle : sa bordure le suit jusque sur l'écran commun ─────────────

test('en soirée, sa bordure suit son avatar : relue à son entrée, changée de sa loge, jamais à un anonyme ni sous un Divin', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  const sockets: { close(): unknown }[] = []
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const nina = await inscrireProfil(banc.url, 'nina', 'Nina', '🐸')
    const [idLea, idNina] = [idDe(banc, 'lea'), idDe(banc, 'nina')]
    // Léa et Nina ont gagné quatorze duels ; Tom n'en a joué aucun. Nina a Hélios, un Divin.
    for (const id of [idLea, idNina]) victoiresAuJournal(banc, id)
    base(banc, db =>
      db
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'dv:helios', 'une-soiree-d-avant', '', '', '', 1)`)
        .run(idNina),
    )
    await banc.redemarrer()

    const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    sockets.push(host)
    const elle = await invite(banc.url, 'Léa', '🦊', { cookie: lea })
    const lui = await invite(banc.url, 'Tom', '🐻', { cookie: tom })
    const zoe = await invite(banc.url, 'Zoé', '🐙')
    const ninaIci = await invite(banc.url, 'Nina', '🐸', { cookie: nina })
    sockets.push(elle.socket, lui.socket, zoe.socket, ninaIci.socket)
    const sur = (s: any, qui: Invite) => s.players.find((p: any) => p.id === qui.playerId)

    // Relue en fond à son entrée, sans rien attendre d'elle : la salle la
    // reçoit d'elle-même — l'écran commun et les téléphones.
    const salle = await instantane(host, s => !!sur(s, elle)?.bordure && !!sur(s, ninaIci)?.bordure, 'les bordures de Léa et de Nina')
    assert.deepEqual(sur(salle, elle).bordure, { ligue: 'or', crans: 2 })
    assert.deepEqual(sur(await instantane(zoe.socket, s => !!sur(s, elle)?.bordure, 'au téléphone de Zoé'), elle).bordure, { ligue: 'or', crans: 2 })
    // Sans duel classé, rien ; un invité anonyme, rien du tout.
    assert.equal(sur(salle, lui).bordure, undefined)
    assert.equal(sur(salle, zoe).bordure, undefined)

    // Elle choisit l'argent dans sa loge : la salle le voit aussitôt, puis plus rien quand elle n'en veut aucune.
    assert.equal((await porter(banc, lea, 'argent')).status, 200)
    await instantane(host, s => sur(s, elle)?.bordure?.ligue === 'argent', 'l’argent de Léa')
    assert.equal((await porter(banc, lea, AUCUNE_BORDURE)).status, 200)
    await instantane(host, s => !!sur(s, elle) && !sur(s, elle).bordure, 'Léa sans bordure')
    assert.equal((await porter(banc, lea, null)).status, 200)
    await instantane(host, s => sur(s, elle)?.bordure?.ligue === 'or', 'Léa revenue à l’or')

    // Sa carte, touchée dans la salle : la bordure relue avec sa cote, au même endroit que sa finition.
    const carte = (await lire(banc, tom, `/s/${ADMIN.slug}/joueurs/${elle.playerId}.json`)).corps
    assert.deepEqual(carte.bordure, { ligue: 'or', crans: 2 })
    assert.equal(carte.profil.bordure, undefined)

    // Nina porte Hélios : un Divin a sa propre lumière, sa bordure s'efface.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'dv:helios' }, nina, 'PUT')).status, 200)
    const divine = await instantane(host, s => sur(s, ninaIci)?.legendaire === 'dv:helios', 'Nina sous Hélios')
    assert.equal(sur(divine, ninaIci).bordure, undefined)
    assert.equal((await lire(banc, tom, `/s/${ADMIN.slug}/joueurs/${ninaIci.playerId}.json`)).corps.bordure, undefined)
  } finally {
    for (const s of sockets) s.close()
    await banc.close()
  }
})

// ── 6. Les classements du solo : de mémoire, sans attendre la base ────────

test('les classements du quiz du jour et du défi la montrent de mémoire : la page ne l’attend jamais', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [idLea, idTom] = [idDe(banc, 'lea'), idDe(banc, 'tom')]
    victoiresAuJournal(banc, idLea)
    // Tous deux ont joué le quiz du jour et relevé le défi de la semaine.
    base(banc, db => {
      for (const [id, points] of [[idLea, 900], [idTom, 700]] as const) {
        db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, ?, 5, 1, 0)`).run(id, jourDe(DEBUT), points)
        db.prepare(
          `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, semaine)
           VALUES (?, ?, '[]', 8, 0, ?, ?, ?, 'defi', ?)`,
        ).run(randomUUID(), id, points / 100, DEBUT - 60_000, DEBUT - 30_000, semaine(DEBUT))
      }
    })
    const auJour = async (id: string) => (await lire(banc, tom, '/api/jour/classement')).corps.lignes.find((l: any) => l.profileId === id)
    const auDefi = async (id: string) => (await lire(banc, tom, '/api/campagne/defi')).corps.lignes.find((l: any) => l.profileId === id)

    // Pas encore lue : le classement part sans elle — il ne l'attend pas —
    // et la fait relire en fond ; la lecture suivante la montre.
    assert.equal((await auJour(idLea)).bordure, undefined, 'la première lecture n’attend pas la base')
    let ligne: any
    for (let i = 0; i < 100 && !(ligne = await auJour(idLea)).bordure; i++) await new Promise(r => setTimeout(r, 20))
    assert.deepEqual(ligne.bordure, { ligue: 'or', crans: 2 })
    assert.deepEqual((await auDefi(idLea)).bordure, { ligue: 'or', crans: 2 }, 'le défi de la semaine aussi')
    // Sans duel classé, rien autour de lui.
    assert.equal((await auJour(idTom)).bordure, undefined)
    assert.equal((await auDefi(idTom)).bordure, undefined)
    // Elle n'en veut aucune : aucun classement ne la montre plus.
    assert.equal((await porter(banc, lea, AUCUNE_BORDURE)).status, 200)
    assert.equal((await auJour(idLea)).bordure, undefined)
    assert.equal((await auDefi(idLea)).bordure, undefined)
  } finally {
    await banc.close()
  }
})

test('toutes lues une fois — le classement des duels, le préchauffage —, une bordure inconnue ne se relit plus : aucun duel', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [idLea, idTom] = [idDe(banc, 'lea'), idDe(banc, 'tom')]
    victoiresAuJournal(banc, idLea)
    base(banc, db => {
      for (const id of [idLea, idTom]) db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 500, 5, 1, 0)`).run(id, jourDe(DEBUT))
    })
    // Le classement des duels lit tous les duels d'un coup : chaque bordure est retenue au passage.
    assert.equal((await lire(banc, tom, '/api/duels')).status, 200)
    const lignes = (await lire(banc, tom, '/api/jour/classement')).corps.lignes
    // Dès la première lecture du jour, sans relecture en fond.
    assert.deepEqual(lignes.find((l: any) => l.profileId === idLea).bordure, { ligue: 'or', crans: 2 })
    assert.equal(lignes.find((l: any) => l.profileId === idTom).bordure, undefined)
  } finally {
    await banc.close()
  }
})

// Le classement des collectionneurs au banc : de vrais profils, des collections
// écrites dans la base, la page lue comme le téléphone la lit. Le relevé de
// tous se fait en fond — jamais sur le chemin d'une requête —, se garde dans
// `meta` et survit au réveil ; la fiche du visiteur se refait à sa visite,
// d'un aller-retour par magasin, de front (« Attention à la performance pour
// ne pas geler le serveur », le propriétaire, le 9 novembre 2026). On compte
// les allers-retours sur le fichier `file:` qui tient lieu de Turso, comme
// `profil-charge.test.ts` : rien ne dépend de la charge de la machine.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { demarrer, ecrire, inscrireProfil, relireJusqua, type Banc } from './banc'
import {
  CARATS_DE_LA_GEMME,
  CARATS_D_UN_MAITRE,
  CARATS_D_UN_TROPHEE,
  CARATS_DU_ZENITH,
  piecesDuStyle,
  type ClassementDesCollections,
  type SuiteDuClassement,
  type VitrineDUnCollectionneur,
} from '../../shared/collectionneurs'
import { CARATS_DU_THEME } from '../../shared/collectionneurs'
import { theme } from '../../shared/themes'
import { ProfileStore } from '../src/auth/profiles'
import { FICHE_GARDEE_MS, RELEVE_GARDE_MS } from '../src/core/collectionneurs'
import { raconter } from '../src/core/divins'
import { clePalier } from '../../shared/hautsfaits'

ProfileStore.tirageEclat = () => false

// ── Le compteur ───────────────────────────────────────────────────────────

const compte = { actif: false, appels: 0, finis: 0, lectures: [] as string[] }
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    // Un aller-retour dure au moins un tour de boucle : le rang d'un appel dit combien il en a attendus (`enSerie`).
    const rang = compte.finis + 1
    if (compte.actif) await new Promise<void>(r => setImmediate(r))
    const res = await origine.apply(this, args)
    if (compte.actif) {
      compte.appels++
      compte.finis = Math.max(compte.finis, rang)
      const instructions = methode === 'batch' ? (args[0] as unknown[]) : [args[0]]
      for (const i of instructions) compte.lectures.push((typeof i === 'string' ? i : (i as { sql: string }).sql).replace(/\s+/g, ' ').slice(0, 90))
    }
    return res
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; enSerie: number; lectures: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0, finis: 0, lectures: [] })
  try {
    const resultat = await travail()
    return { appels: compte.appels, enSerie: compte.finis, lectures: compte.lectures, resultat }
  } finally {
    compte.actif = false
  }
}

// ── La tablée ─────────────────────────────────────────────────────────────

/** L'horloge du serveur, à la main : la fiche de la minute, le relevé de six heures. */
const horloge = { t: Date.UTC(2026, 10, 9, 15) }
/** L'instant où Hélios est descendu chez Max : à lui seul, pour que rien ne le redise sans qu'on le voie (invariant 21). */
const DESCENTE = horloge.t - 3 * 86400_000 + 4_321
let banc: Banc
const cookies: Record<string, string> = {}
const ids: Record<string, string> = {}

const lire = async <T = any>(chemin: string, qui = 'lea', statut = 200): Promise<T> => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookies[qui] ?? '' } })
  const lu = (await r.json()) as any
  assert.equal(r.status, statut, `${chemin} : ${r.status} ${lu.error ?? ''}`)
  return lu
}

/** La page, une fois le premier relevé fait : il part en fond derrière la première visite. */
const pagePrete = (qui = 'lea') => relireJusqua(() => lire<ClassementDesCollections>('/api/collectionneurs', qui), c => !c.enPreparation)

before(async () => {
  // Le journal des duels frais comme en ligne : ces épreuves comptent ce que la production attend (règle `tests.md`).
  banc = await demarrer({ horlogeDuJour: () => horloge.t, fraicheurDesDuelsMs: 3_600_000 })
  // Léa, Max, Zoé (masquée), Hugo (suspendu), Noé (qui n'a rien).
  for (const [qui, nom] of [
    ['lea', 'Léa'],
    ['max', 'Max'],
    ['zoe', 'Zoé'],
    ['hugo', 'Hugo'],
    ['noe', 'Noé'],
  ] as const) {
    cookies[qui] = await inscrireProfil(banc.url, qui, nom)
    ids[qui] = (await lire('/api/joueur/moi?leger', qui)).profile.id
  }
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const t = horloge.t - 86400_000
    const badge = db.prepare('INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const acquis = db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)')
    // Léa : maître du tour du monde, quatre paliers des mythes, un thème acheté, une étape de piste, un Éclat sur son renard.
    acquis.run(ids.lea, 'monde', 13, t)
    acquis.run(ids.lea, 'mythes', 4, t)
    db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, ?)').run(ids.lea, 'jungle', t)
    badge.run(ids.lea, 'hf:bavard:1', 's1', '', '💬', 'Le Bavard', t)
    db.prepare('INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, ?, ?)').run(ids.lea, '🦊', 's1', t)
    // Max : un Divin descendu, et la Comète par son exploit — quatre cents réflexes : scellée d'emblée.
    badge.run(ids.max, 'dv:helios', 's2', '', '☀️', 'Hélios', DESCENTE)
    badge.run(ids.max, clePalier('hf:reflexe', 3), 's2', '', '⚡', 'Le Réflexe', t)
    // Zoé, masquée du classement par l'administrateur : maître du stade, que personne ne doit voir.
    acquis.run(ids.zoe, 'stade', 13, t)
    db.prepare('INSERT INTO jour_masques (profile_id, masque_le) VALUES (?, ?)').run(ids.zoe, t)
    // Hugo, suspendu : son Divin ne se montre nulle part.
    badge.run(ids.hugo, 'dv:helios', 's3', '', '☀️', 'Hélios', t)
    db.prepare('UPDATE profiles SET disabled_at = ? WHERE id = ?').run(t, ids.hugo)
  } finally {
    db.close()
  }
  // Ce qui a été écrit entre en mémoire avec les profils, au réveil.
  await banc.redemarrer()
})

after(() => banc.close())

// ── La page ───────────────────────────────────────────────────────────────

test('sans profil, rien : le serveur le dit, et ne relève rien', async () => {
  const r = await fetch(`${banc.url}/api/collectionneurs`)
  assert.equal(r.status, 401)
  assert.match(((await r.json()) as { error: string }).error, /Connecte-toi à ton profil/)
})

test('le premier relevé se fait en fond : la page s’ouvre tout de suite sur sa fiche, puis sur le classement', async () => {
  const premiere = await lire<ClassementDesCollections>('/api/collectionneurs')
  if (premiere.enPreparation) {
    assert.deepEqual(premiere.categories.collection.tete, [], 'rien d’inventé tant que le relevé se fait')
    assert.ok(premiere.fiches.some(f => f.id === ids.lea), 'sa propre fiche, de l’instant')
  }
  const page = await pagePrete()
  const fiche = (qui: string) => page.fiches.find(f => f.id === ids[qui])
  // Max d'abord : son Divin vaut huit légendaires.
  assert.equal(page.categories.collection.tete[0].id, ids.max)
  assert.ok(fiche('max')!.carats >= CARATS_DE_LA_GEMME.divin, `Max : ${fiche('max')!.carats} carats`)
  assert.deepEqual(fiche('max')!.divins, ['dv:helios'])
  assert.deepEqual(page.divins, [{ cle: 'dv:helios', porteurs: [ids.max] }], 'le Divin d’un suspendu ne se montre pas')
  // Léa : son maître, ses seize paliers, son thème, son étape de piste, son Éclat.
  const lea = fiche('lea')!
  assert.deepEqual(lea.maitres, ['monde'])
  assert.equal(lea.paliers, 16)
  assert.equal(lea.eclats, 1, 'un Éclat posé sur son emoji compte, même hors de l’album')
  assert.equal(lea.familles.trophees, CARATS_D_UN_MAITRE + CARATS_D_UN_TROPHEE)
  assert.ok(lea.familles.style >= CARATS_DU_THEME[theme('jungle')!.rarete], `son thème acheté : ${JSON.stringify(lea.familles)}`)
  assert.equal(lea.carats, lea.familles.avatars + lea.familles.trophees + lea.familles.style)
  assert.ok(lea.gemmes.legendaire >= 1, 'la forme ultime du tour du monde, à son palier de maître')
  // Ni la masquée, ni le suspendu, ni qui n'a rien : l'absence, pas « dernier avec zéro ».
  for (const qui of ['zoe', 'hugo', 'noe']) assert.ok(!fiche(qui), `${qui} ne paraît pas`)
  assert.deepEqual(
    page.categories.maitres.tete.map(p => p.id),
    [ids.lea],
    'la maîtresse masquée n’est pas devant elle',
  )
  assert.equal(page.categories.maitres.moi?.rang, 1)
  assert.equal(page.categories.collection.classes, 2)
})

test('la vitrine : un Divin d’abord ; ni un masqué ni un suspendu ne s’y ouvrent', async () => {
  await pagePrete()
  const max = await lire<VitrineDUnCollectionneur>(`/api/collectionneurs/${ids.max}`)
  assert.equal(max.pieces[0].cle, 'dv:helios')
  assert.equal(max.pieces[0].carats, CARATS_DE_LA_GEMME.divin)
  assert.equal(max.rang, 1)
  for (const qui of ['zoe', 'hugo']) await lire(`/api/collectionneurs/${ids[qui]}`, 'lea', 404)
  // La sienne, si — et la masquée voit la sienne, sa place comprise.
  assert.equal((await lire<VitrineDUnCollectionneur>(`/api/collectionneurs/${ids.lea}`)).fiche.id, ids.lea)
  const sienne = await lire<ClassementDesCollections>('/api/collectionneurs', 'zoe')
  assert.equal(sienne.categories.maitres.moi?.rang, 1, 'masquée, sa page lui dit la place que les classés lui feraient')
  assert.ok(!sienne.categories.maitres.tete.some(p => p.id === ids.zoe))
})

test('la suite d’un classement, à la demande : ni masqué ni suspendu, et ce qui ne se classe pas se refuse en clair', async () => {
  // « J'aimerais voir tout le monde » (le propriétaire, le 9 novembre 2026) : la page s'arrêtait au dixième.
  await pagePrete()
  const suite = await lire<SuiteDuClassement>('/api/collectionneurs/suite/collection?depuis=0')
  assert.deepEqual(
    suite.places.map(p => p.id),
    [ids.max, ids.lea],
  )
  assert.deepEqual(
    suite.fiches.map(f => f.id),
    [ids.max, ids.lea],
    'chaque place a sa fiche',
  )
  assert.equal(suite.classes, 2)
  assert.deepEqual((await lire<SuiteDuClassement>('/api/collectionneurs/suite/collection?depuis=1')).places.map(p => p.id), [ids.lea])
  assert.deepEqual((await lire<SuiteDuClassement>('/api/collectionneurs/suite/collection?depuis=10')).places, [], 'au-delà du dernier, rien')
  assert.deepEqual(
    (await lire<SuiteDuClassement>('/api/collectionneurs/suite/maitres?depuis=0')).places.map(p => p.id),
    [ids.lea],
    'la maîtresse masquée n’y est pas plus que dans la tête',
  )
  for (const chemin of ['/api/collectionneurs/suite/themes?depuis=0', '/api/collectionneurs/suite/collection?depuis=-1', '/api/collectionneurs/suite/collection?depuis=deux']) {
    assert.match((await lire<{ error: string }>(chemin, 'lea', 400)).error, /rouvre la page/)
  }
  assert.equal((await fetch(`${banc.url}/api/collectionneurs/suite/collection`)).status, 401)
})

test('trophées et style : sa fiche dit combien il en a, jamais lesquels', async () => {
  // « Comment on peut voir / comparer sur un joueur ce qu'ils ont à ce niveau ? » (le propriétaire, le 9 novembre 2026).
  const page = await pagePrete()
  const lea = page.fiches.find(f => f.id === ids.lea)!
  assert.equal(lea.style.themes[theme('jungle')!.rarete], 1, 'son thème acheté, à sa rareté')
  assert.doesNotMatch(JSON.stringify(lea.style), /jungle/, 'combien, jamais lesquels')
  assert.deepEqual(piecesDuStyle(lea.style).themes, 1, 'les thèmes offerts à tous ne se comptent pas')
  assert.equal(lea.trophees, 1, 'son étape de piste')
  // La vitrine d'un autre les montre, et le face-à-face les compare.
  const max = (await lire<VitrineDUnCollectionneur>(`/api/collectionneurs/${ids.max}`)).fiche
  assert.deepEqual(Object.keys(max.style).sort(), ['finitions', 'fonds', 'gerbes', 'ligues', 'themes'])
})

test('l’étoile du zénith : sa Comète scellée compte, sur sa pièce et dans sa valeur, et se voit quand il la porte', async () => {
  // « Il faudrait du coup pouvoir récompenser dans le classement cela » (le propriétaire, le 9 novembre 2026).
  const page = await pagePrete()
  const max = page.fiches.find(f => f.id === ids.max)!
  assert.ok(max.legendaires.includes('lg:comete'))
  assert.deepEqual(max.scelles, ['lg:comete'])
  const vitrine = await lire<VitrineDUnCollectionneur>(`/api/collectionneurs/${ids.max}`)
  assert.deepEqual(vitrine.pieces.find(p => p.cle === 'lg:comete'), { cle: 'lg:comete', gemme: 'legendaire', scelle: true, carats: CARATS_DE_LA_GEMME.legendaire + CARATS_DU_ZENITH })
  // Portée, sa Comète montre son étoile sur son avatar — sa propre page la refait à sa visite.
  assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:comete' }, cookies.max, 'PUT')).status, 200)
  const sienne = (await lire<ClassementDesCollections>('/api/collectionneurs', 'max')).fiches.find(f => f.id === ids.max)!
  assert.deepEqual([sienne.legendaire, sienne.sceau], ['lg:comete', true])
})

test('sa carte dit ce que vaut sa collection, de mémoire : la valeur et la place du dernier relevé', async () => {
  // « Rajoute la valeur de la collection sur la carte joueur » (le propriétaire, le 9 novembre 2026).
  const page = await pagePrete()
  const max = page.fiches.find(f => f.id === ids.max)!
  const sienne = await lire(`/api/joueur/carte/${ids.max}`)
  assert.deepEqual(sienne.profil.collection, { carats: max.carats, rang: 1, classes: page.categories.collection.classes })
  // La sienne aussi, depuis sa page ; et la carte ne relit rien pour la dire.
  const mienne = await mesurer(() => lire('/api/joueur/carte'))
  assert.equal(mienne.resultat.profil.collection.rang, 2)
  // Rien du relevé de tous : ni leurs épreuves, ni leurs achats, ni leur quiz du jour.
  assert.ok(!mienne.lectures.some(l => /json_array\(s?\.?profile_id|GROUP BY profile_id/.test(l)), mienne.lectures.join('\n'))
  // Qui n'a rien à classer n'en a pas : l'absence, pas « 0 carat ».
  assert.equal((await lire(`/api/joueur/carte/${ids.noe}`)).profil.collection, undefined)
})

test('un Divin se compte et se montre, jamais son récit ni le soir où il est descendu', async () => {
  // Le choix du propriétaire du 9 novembre 2026 : sa valeur et qui le garde,
  // rien de son chemin (invariant 21). Le récit reste à son porteur, sur sa
  // fin de soirée ; la date dirait de quel soir il est sorti.
  const page = await pagePrete()
  const vitrine = await lire<VitrineDUnCollectionneur>(`/api/collectionneurs/${ids.max}`)
  const [helios] = raconter(['dv:helios'])
  for (const [quoi, lu] of [
    ['la page', page],
    ['sa vitrine', vitrine],
  ] as const) {
    const texte = JSON.stringify(lu)
    assert.ok(texte.includes('dv:helios'), `${quoi} le montre`)
    assert.ok(!texte.includes(helios.legende.slice(0, 24)), `${quoi} raconte son récit`)
    assert.ok(!texte.includes(String(DESCENTE)), `${quoi} dit quand il est descendu`)
  }
})

test('rouverte dans la minute, la page ne relit rien ; après, sa fiche seule, d’un aller-retour de front', async () => {
  await pagePrete()
  const tout = await mesurer(() => lire('/api/collectionneurs'))
  assert.equal(tout.appels, 0, `rouverte dans la minute :\n${tout.lectures.join('\n')}`)
  horloge.t += FICHE_GARDEE_MS + 1
  const sienne = await mesurer(() => lire('/api/collectionneurs'))
  assert.equal(sienne.enSerie, 1, `${sienne.enSerie} allers-retours l’un derrière l’autre :\n${sienne.lectures.join('\n')}`)
  assert.ok(sienne.appels <= 3, `${sienne.appels} allers-retours :\n${sienne.lectures.join('\n')}`)
  // Rien de tous : ni leurs épreuves, ni leurs achats, ni leur quiz du jour.
  assert.ok(!sienne.lectures.some(l => /json_group_array\(json_array\(s\.profile_id|GROUP BY profile_id/.test(l)), sienne.lectures.join('\n'))
})

test('son achat se voit à sa visite suivante, sans attendre le relevé de tous', async () => {
  const avant = (await pagePrete()).fiches.find(f => f.id === ids.lea)!
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, ?)').run(ids.lea, 'aurore', horloge.t)
  } finally {
    db.close()
  }
  horloge.t += FICHE_GARDEE_MS + 1
  const apres = (await lire<ClassementDesCollections>('/api/collectionneurs')).fiches.find(f => f.id === ids.lea)!
  assert.equal(apres.familles.style - avant.familles.style, CARATS_DU_THEME[theme('aurore')!.rarete])
})

test('le relevé se garde dans la base : un réveil le reprend tel quel, sans rien relever', async () => {
  const avant = await pagePrete()
  await banc.redemarrer()
  const apres = await lire<ClassementDesCollections>('/api/collectionneurs')
  assert.ok(!apres.enPreparation, 'repris de `meta`')
  assert.equal(apres.releve, avant.releve)
  assert.deepEqual(
    apres.categories.collection.tete.map(p => p.id),
    avant.categories.collection.tete.map(p => p.id),
  )
  // Et le gros bouton de son profil le dit : sa place, de mémoire.
  const profil = (await lire('/api/joueur/moi')).profile
  assert.equal(profil.collectionneur?.classes, 2)
  assert.equal(profil.collectionneur?.rang, 2)
})

test('vieilli, le relevé se refait en fond : la page répond avec l’ancien, le suivant arrive derrière', async () => {
  const avant = await pagePrete()
  horloge.t += RELEVE_GARDE_MS + 1
  const tout = await lire<ClassementDesCollections>('/api/collectionneurs')
  assert.equal(tout.releve, avant.releve, 'l’ancien, sans attendre le neuf')
  const neuf = await relireJusqua(() => lire<ClassementDesCollections>('/api/collectionneurs'), c => c.releve > avant.releve)
  assert.equal(neuf.categories.collection.tete[0].id, ids.max)
})

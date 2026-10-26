// Le codex par ses routes, sur un vrai serveur (la version 7 du départ, le 18
// octobre 2026) : le bilan écrit à la fin d'une expédition — abandonnée
// aussi —, la renommée relue des bilans de toutes ses expéditions finies —
// rattrapée du pli pour celles qui n'en ont pas, une fois —, le niveau qu'elle
// fait et ce qu'il ouvre, figés au départ ; la carte de ses légendaires au
// codex, et l'invité du jour qui prête la sienne ; le dos de son paquet, pris
// au départ parmi les siens ; L'Explorateur, une piste de la campagne qui
// comptait le niveau d'explorateur et compte depuis le 26 octobre 2026 les salles
// complètes du Cabinet, tombée à la fin d'une expédition — jamais là où le Cabinet est fermé, qui ne la cite qu'à ses
// détenteurs, la production telle que le code la démarre comprise ;
// l'Ascension, ouverte par les victoires relues des bilans, son cran borné et
// figé au départ, gardé par le bilan. Les règles et le pli : `codex.test.ts`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { CATEGORIES, type Categorie } from '../../shared/categories'
import { NIVEAUX, codexDuNiveau, ecrireLeBilan, lireLeBilan, type BilanDUneExpedition } from '../../shared/codex'
import { paquetDesRencontres } from '../../shared/rencontres'
import { cleDeLExpedition } from '../../shared/legendaires'
import { OEUVRES_DE_DEPART, oeuvresDeLaSalle } from '../../shared/cabinet/oeuvres'
import type { CleDeSalle } from '../../shared/cabinet/salles'
import { CABINET_EN_PRODUCTION } from '../../shared/cabinet/ouverture'
import type { DepartDExpedition, PageDeLExpedition, VueDeLExpedition } from '../../shared/expedition'

function question(i: number, categorie: Categorie, difficulte: number): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${i}`)
  const lu = lireQuestionDeLaBase({
    id: `codx${String(i).padStart(4, '0')}`,
    texte: `Question d'essai du codex numéro ${i} : laquelle de ces réponses est la bonne ?`,
    reponses: [`Bonne ${i}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de la question ${i}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

const BASE = new BaseDeLaCampagne(CATEGORIES.flatMap((c, k) => [2, 3, 4].flatMap((d, m) => Array.from({ length: 8 }, (_, i) => question(k * 100 + m * 10 + i, c, d)))))

let banc: Banc

before(async () => {
  banc = await demarrer({ baseDeLaCampagne: BASE })
})

after(() => banc.close())

const lire = (cookie: string, chemin: string, b: Banc = banc) => fetch(`${b.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (cookie: string, chemin: string, corps: unknown = {}, b: Banc = banc) => ecrire(b.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(fn: (db: Database.Database) => T, ecriture = false, b: Banc = banc): T {
  const db = new Database(b.quizDbUrl.replace(/^file:/, ''), { readonly: !ecriture, fileMustExist: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const bilanEnBase = (id: string, b: Banc = banc) => base(db => (db.prepare('SELECT bilan FROM campagne_series WHERE id = ?').get(id) as { bilan: string | null }).bilan, false, b)
const ecrireLeBilanEnBase = (id: string, bilan: string | null, b: Banc = banc) => base(db => db.prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?').run(bilan, id), true, b)
const departDe = (id: string): DepartDExpedition => base(db => JSON.parse((db.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(id) as { expedition: string }).expedition))

/** Une salle du Cabinet complète, posée en base derrière le dos du serveur : ses œuvres, sans les quatre de départ, qu'il a sans ligne. */
const poserUneSalleComplete = (b: Banc, profil: string, salle: CleDeSalle) =>
  base(
    db => {
      const oeuvre = db.prepare(`INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES (?, ?, 'partie', 1)`)
      for (const o of oeuvresDeLaSalle(salle)) if (!OEUVRES_DE_DEPART.includes(o.cle)) oeuvre.run(profil, o.cle)
    },
    true,
    b,
  )
/**
 * Les paliers de L'Explorateur rangés sous une expédition, en base derrière le dos du serveur : un détenteur d'avant le
 * 26 octobre 2026, qui les a gagnés au niveau d'explorateur. Le serveur les relit à son démarrage suivant.
 */
const rangerLExplorateur = (b: Banc, profil: string, paliers: number) =>
  base(
    db => {
      const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:une-expedition', '', '🎒', 'L’Explorateur', 1)`)
      for (let palier = 1; palier <= paliers; palier++) badge.run(profil, `hf:explorateur:${palier}`)
    },
    true,
    b,
  )
const page = async (c: string): Promise<PageDeLExpedition> => (await lire(c, '/api/expedition')).corps

/** Partir aux rencontres, faire un pas, et abandonner : une expédition finie, son bilan écrit — une escale. */
async function unPasPuisAbandon(c: string): Promise<string> {
  return (await unPasPuisLaFin(c)).id
}

/** De même, et ce que sa fin a fait tomber (`recompenses`) — sur le banc du fichier, ou sur un autre serveur. */
async function unPasPuisLaFin(c: string, b: Banc = banc): Promise<{ id: string; recompenses: { key: string }[] }> {
  const parti = await poster(c, '/api/expedition', { rencontres: true }, b)
  assert.equal(parti.status, 200, parti.corps.error)
  let v = parti.corps as VueDeLExpedition
  assert.equal(v.renommee, 0, 'avant le premier pas, rien')
  const pas = await poster(c, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers: v.permises[0] } }, b)
  assert.equal(pas.status, 200, pas.corps.error)
  v = pas.corps.expedition
  assert.equal(v.renommee, 1, 'la vue dit déjà ce qu’elle rapporte : une escale')
  const fin = await poster(c, `/api/expedition/${v.id}/abandon`, {}, b)
  assert.equal(fin.status, 200, fin.corps.error)
  assert.equal(fin.corps.expedition.renommee, 1)
  return { id: v.id, recompenses: fin.corps.recompenses ?? [] }
}

const UNE_ESCALE: BilanDUneExpedition = { escales: 1, adversaires: 0, elites: 0, gardiens: 0, auBout: false }

test('la fin d’une expédition écrit son bilan — abandonnée aussi : un joueur qui tombe tôt avance quand même', async () => {
  const c = await inscrireProfil(banc.url, 'bilan', 'Bilan')
  assert.deepEqual((await page(c)).prochaine.codex, { renommee: 0, ...codexDuNiveau(1, []), ascension: 0 }, 'au premier départ, le niveau 1')
  const id = await unPasPuisAbandon(c)
  assert.equal(bilanEnBase(id), ecrireLeBilan(UNE_ESCALE))
  assert.equal((await page(c)).prochaine.codex?.renommee, 1, 'la page la relit')
})

test('la renommée se relit de toutes ses expéditions finies : son niveau, ses cartes, ses règles, figés au départ — au niveau 5, toutes les règles', async () => {
  const c = await inscrireProfil(banc.url, 'aguerri', 'Aguerri')
  const finie = await unPasPuisAbandon(c)
  // Le niveau 5, juste : la catégorie fétiche, le pari, les fioles et les talismans ouverts, et sept styles — le Sophiste s'y
  // ouvre (la version 9), le Téméraire attend le 6.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[4] }))
  const codex = (await page(c)).prochaine.codex!
  assert.deepEqual(codex, { renommee: NIVEAUX[4], ...codexDuNiveau(5, []), ascension: 0 })
  assert.deepEqual(codex.regles, ['fetiche', 'pari', 'fioles', 'talismans'])
  assert.equal(codex.styles?.length, 7)
  const parti = await poster(c, '/api/expedition', { rencontres: true, fetiche: 'Histoire' })
  assert.equal(parti.status, 200, parti.corps.error)
  const v = parti.corps as VueDeLExpedition
  assert.equal(v.fetiche, 'Histoire', 'sa catégorie fétiche part avec lui')
  // Le départ fige ce que le codex ouvre ; ses dos et ses styles, il en prend un (`DepartDExpedition.dos`, `style`).
  const { dos: _dos, styles: _styles, ...ouvert } = codexDuNiveau(5, [])
  assert.deepEqual(departDe(v.id).codex, { ...ouvert, renommee: NIVEAUX[4], ascensionOuverte: 0 })
  assert.deepEqual(v.cartes?.codex, { niveau: 5, regles: ['fetiche', 'pari', 'fioles', 'talismans'], renommee: NIVEAUX[4], exploits: [], ascensionOuverte: 0 })
  assert.deepEqual(v.exploits, [], 'aucun exploit au départ')
  // La renommée qui monte en route ne change rien à l'expédition partie : son codex est figé.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[8] }))
  const relue = await page(c)
  assert.equal(relue.prochaine.codex?.niveau, 9, 'la prochaine partira au niveau 9')
  assert.equal(relue.expedition?.cartes?.codex?.niveau, 5, 'celle en route reste au 5')
})

test('le dos de son paquet : choisi au départ parmi les siens, sinon le plus rare — un dos qu’il n’a pas ne refuse pas le départ', async () => {
  const c = await inscrireProfil(banc.url, 'dos', 'Dos')
  const finie = await unPasPuisAbandon(c)
  // Le niveau 6 : l'étoilé s'ouvre.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[5] }))
  assert.deepEqual((await page(c)).prochaine.codex?.dos, ['ordinaire', 'etoile'])
  // Le doré, qu'un autre profil du même téléphone a fait retenir : il ne l'a pas — le plus rare des siens, sans un refus pour un habit.
  let parti = await poster(c, '/api/expedition', { rencontres: true, dos: 'dore' })
  assert.equal(parti.status, 200, parti.corps.error)
  let v = parti.corps as VueDeLExpedition
  assert.equal(departDe(v.id).dos, 'etoile')
  assert.equal(v.cartes?.dos, 'etoile', 'la page en habille sa pioche')
  assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  parti = await poster(c, '/api/expedition', { rencontres: true, dos: 'ordinaire' })
  assert.equal(parti.status, 200, parti.corps.error)
  v = parti.corps as VueDeLExpedition
  assert.equal(departDe(v.id).dos, 'ordinaire', 'son choix')
  // Aux règles d'avant, pas de codex : pas de dos.
  assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  const avant = (await poster(c, '/api/expedition', { dos: 'etoile' })).corps as VueDeLExpedition
  assert.equal(departDe(avant.id).dos, undefined)
})

test('une expédition finie sans bilan — d’avant le codex, d’avant les exploits, ou qui ne se lit pas — se relit de son pli, et son bilan s’écrit', async () => {
  const c = await inscrireProfil(banc.url, 'ancien', 'Ancien')
  const finie = await unPasPuisAbandon(c)
  for (const brut of [
    null,
    'pas du JSON',
    JSON.stringify({ v: 99, escales: 500, adversaires: 0, elites: 0, gardiens: 0, auBout: false }),
    // Le bilan de la version 1 (le 18 octobre 2026), sans ses exploits : replié une fois, ce qu'elle a fait d'exploit compte.
    JSON.stringify({ v: 1, escales: 500, adversaires: 0, elites: 0, gardiens: 0, auBout: false }),
  ]) {
    ecrireLeBilanEnBase(finie, brut)
    await banc.redemarrer()
    assert.equal((await page(c)).prochaine.codex?.renommee, 1, `${brut} : refait du pli, une escale`)
    assert.equal(bilanEnBase(finie), ecrireLeBilan(UNE_ESCALE), `${brut} : son bilan écrit, pour ne la replier qu’une fois`)
  }
})

test('ses exploits se relisent des bilans : chacun ouvre sa carte au codex, se fige au départ, et une expédition qui en refait un n’en dit rien de neuf', async () => {
  const c = await inscrireProfil(banc.url, 'exploits', 'Exploits')
  const finie = await unPasPuisAbandon(c)
  assert.deepEqual((await page(c)).prochaine.codex?.exploits, [])
  // Une expédition d'avant y a gagné un gros pari et tenu un gardien sans perdre de courage.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, exploits: ['gardien-intact', 'pari-de-40'] }))
  const codex = (await page(c)).prochaine.codex!
  assert.deepEqual(codex, { renommee: 1, ...codexDuNiveau(1, [], ['pari-de-40', 'gardien-intact']), ascension: 0 })
  assert.deepEqual(codex.exploits, ['pari-de-40', 'gardien-intact'])
  assert.ok(codex.cartes.includes('banco'), 'Banco s’ouvre par son exploit, dès le niveau 1')
  assert.ok(!codex.cartes.includes('lancee'), 'Lancée attend le sien')
  const parti = await poster(c, '/api/expedition', { rencontres: true })
  assert.equal(parti.status, 200, parti.corps.error)
  const v = parti.corps as VueDeLExpedition
  assert.deepEqual(departDe(v.id).codex?.exploits, ['pari-de-40', 'gardien-intact'], 'figés au départ')
  assert.deepEqual(v.cartes?.codex?.exploits, ['pari-de-40', 'gardien-intact'], 'la page les lit : le dos doré, et ce qui sera neuf à la fin')
  assert.deepEqual(v.exploits, [])
})

test('ses légendaires ouvrent leur carte au codex ; plus d’équipe à choisir — l’invité du jour prête la sienne', async () => {
  const c = await inscrireProfil(banc.url, 'collection', 'Collection')
  const id = (await lire(c, '/api/joueur/moi')).corps.profile.id as string
  base(db => {
    db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:essai', '', '🧭', 'essai', 1)`).run(id, cleDeLExpedition('lg:phenix'))
  }, true)
  // Relu au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  const p = await page(c)
  assert.ok(p.prochaine.codex?.cartes.includes('renaissance'), 'la carte du Phénix, qu’il a')
  assert.deepEqual(p.prochaine.codex, { renommee: 0, ...codexDuNiveau(1, ['lg:phenix']), ascension: 0 })
  // Une équipe demandée ne part pas : l'invité du jour seul, sa carte dans le paquet.
  const parti = await poster(c, '/api/expedition', { rencontres: true, equipee: ['lg:phenix'] })
  assert.equal(parti.status, 200, parti.corps.error)
  const v = parti.corps as VueDeLExpedition
  assert.deepEqual(v.equipee, [p.prochaine.invite])
  assert.deepEqual(v.cartes?.paquet, paquetDesRencontres([p.prochaine.invite]))
})

// L'épreuve d'avant le 26 octobre 2026 voyait L'Explorateur tomber au niveau 4 d'explorateur, et se taire sur un serveur
// aux rencontres refermées. Le départ de l'Expédition fermé (`EXPEDITION_REMPLACEE`), sa renommée ne monterait plus : il
// compte désormais les salles complètes du Cabinet (la conception du Cabinet, § 6.4). Réécrite à la règle neuve, elle
// garde son intention : la piste se lit à la page du profil, son bronze tombe à la fin d'une partie de la campagne — ici
// une expédition, comme avant —, et un serveur qui ne sert pas ce qu'il compte ne le cite ni ne le décerne.
test('L’Explorateur, aux salles complètes du Cabinet : sa piste se lit à la page du profil — rien sans salle —, la renommée n’y compte plus, son bronze tombe à la fin de la partie qui suit la première salle, ce qu’il avait se garde ; un serveur où le Cabinet est fermé ne le cite ni ne le décerne', async () => {
  const sien = (moi: any) => moi.profile.hautsFaits.find((h: any) => h.key === 'hf:explorateur')
  const piste = async (cookie: string, b: Banc = banc) =>
    sien(await fetch(`${b.url}/api/joueur/moi`, { headers: { Cookie: cookie } }).then(r => r.json() as Promise<any>))
  const c = await inscrireProfil(banc.url, 'explorateur', 'Explorateur')
  const id = (await lire(c, '/api/joueur/moi')).corps.profile.id as string
  const avant = await piste(c)
  assert.deepEqual([avant.fois, avant.valeur, avant.prochain], [0, 0, 1])

  // La renommée de ses expéditions — le codex entier — ne le fait plus monter.
  const premiere = await unPasPuisLaFin(c)
  assert.ok(!premiere.recompenses.some(r => r.key.startsWith('hf:explorateur')), 'aucune salle : rien ne tombe')
  ecrireLeBilanEnBase(premiere.id, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[9] }))
  const seconde = await unPasPuisLaFin(c)
  assert.ok(!seconde.recompenses.some(r => r.key.startsWith('hf:explorateur')), 'le niveau d’explorateur ne compte plus')
  assert.equal((await piste(c)).valeur, 0)

  // Une salle complète : la page du profil la compte aussitôt, et la fin de la partie suivante de la campagne fait tomber
  // le bronze — sous cette partie, comme tout palier de la campagne.
  poserUneSalleComplete(banc, id, 'rempart')
  assert.equal((await piste(c)).valeur, 1)
  const troisieme = await unPasPuisLaFin(c)
  assert.deepEqual(
    troisieme.recompenses.filter(r => r.key.startsWith('hf:explorateur')).map(r => r.key),
    ['hf:explorateur:1'],
  )
  const apres = await piste(c)
  assert.deepEqual([apres.fois, apres.valeur, apres.prochain], [1, 1, 3])

  // Un détenteur d'avant : l'argent, gagné au niveau d'explorateur, rangé sous son expédition. Aucune salle complète, il
  // le garde — la page le dit à l'argent, l'or à six salles —, et la fin d'une partie ne lui reprend rien.
  const ancien = await inscrireProfil(banc.url, 'ancien-explorateur', 'Ancien')
  rangerLExplorateur(banc, (await lire(ancien, '/api/joueur/moi')).corps.profile.id as string, 2)
  // Relu au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  const garde = await piste(ancien)
  assert.deepEqual([garde.fois, garde.valeur, garde.prochain], [2, 0, 6])
  await unPasPuisLaFin(ancien)
  assert.equal((await piste(ancien)).fois, 2, 'rien ne se reprend')

  // La production telle qu'elle serait le jour où les deux drapeaux s'y refermeraient — les rencontres (le jeu depuis le
  // 19 octobre 2026) et le Cabinet (fermé tant qu'il n'y ouvre pas), forcés tous deux : le Cabinet ouvert en production,
  // l'épreuve garderait son serveur fermé — : le départ reste celui des jokers, la même salle complète et la même renommée
  // n'y font rien tomber, et la page du profil ne le cite pas à qui ne l'a pas — l'album ne lui fait pas de case
  // (`montreParLeServeur`). La production telle que le code la démarre, sans drapeau forcé : l'épreuve qui suit.
  const prod = await demarrer({ online: true, baseDeLaCampagne: BASE, rencontres: false, cabinet: false })
  try {
    const p = await inscrireProfil(prod.url, 'production', 'Production')
    const pId = ((await fetch(`${prod.url}/api/joueur/moi`, { headers: { Cookie: p } }).then(r => r.json())) as any).profile.id as string
    poserUneSalleComplete(prod, pId, 'rempart')
    const posterP = (chemin: string, corps: unknown = {}) => ecrire(prod.url, chemin, corps, p).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const finir = async () => {
      const parti = await posterP('/api/expedition', { rencontres: true })
      assert.equal(parti.status, 200, parti.corps.error)
      const v = parti.corps as VueDeLExpedition
      assert.equal(v.courage, undefined, 'les rencontres refermées, le départ reste celui des jokers')
      const pas = await posterP(`/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers: v.permises[0] } })
      assert.equal(pas.status, 200, pas.corps.error)
      const fin = await posterP(`/api/expedition/${v.id}/abandon`)
      assert.equal(fin.status, 200, fin.corps.error)
      return { id: v.id, recompenses: (fin.corps.recompenses ?? []) as { key: string }[] }
    }
    const une = await finir()
    // Son bilan s'écrit comme partout : la renommée attend le jour où les rencontres s'y ouvriront.
    assert.ok(bilanEnBase(une.id, prod))
    ecrireLeBilanEnBase(une.id, ecrireLeBilan({ ...UNE_ESCALE, escales: NIVEAUX[9] }), prod)
    const deux = await finir()
    assert.ok(![...une.recompenses, ...deux.recompenses].some(r => r.key.startsWith('hf:explorateur')), 'ni décerné…')
    const moi = await fetch(`${prod.url}/api/joueur/moi`, { headers: { Cookie: p } }).then(r => r.json() as Promise<any>)
    assert.ok(sien(moi) === undefined && moi.profile.hautsFaits.some((h: any) => h.key === 'hf:globe-trotter'), '…ni cité, quand les autres pistes le sont')

    // Un détenteur, lui, le garde cité même là : son argent, gagné quand le trophée comptait le niveau d'explorateur — la
    // production le montrait alors —, ne se cache pas avec le Cabinet fermé (invariant 22). Sa piste le dit à l'argent,
    // sans une salle comptée : rien ne s'y lit ni ne s'y gagne.
    const detenteur = await inscrireProfil(prod.url, 'detenteur-production', 'Détenteur')
    rangerLExplorateur(prod, ((await lire(detenteur, '/api/joueur/moi', prod)).corps.profile.id as string), 2)
    await prod.redemarrer()
    const tenu = await piste(detenteur, prod)
    assert.deepEqual([tenu?.fois, tenu?.valeur, tenu?.prochain], [2, 0, 6], 'cité à qui l’a, où que ce soit')
    assert.equal(await piste(p, prod), undefined, 'et toujours tu à qui ne l’a pas')
  } finally {
    await prod.close()
  }
})

// La production telle que le code la démarre, aucun drapeau forcé : les rencontres y sont le jeu depuis le 19 octobre
// 2026 — L'Explorateur y a compté le niveau d'explorateur jusqu'au 26, ses détenteurs l'ont gagné là —, et le Cabinet n'y
// ouvre qu'avec son drapeau (`CABINET_EN_PRODUCTION`). Le trophée qui change de mesure ne se cache à aucun d'eux, que
// cette mise en ligne parte avant l'ouverture du Cabinet ou avec elle : c'est cette épreuve qui le garde, sans rougir le
// jour où le drapeau s'ouvre. Qui ne l'a pas le voit, et le gagne, avec le Cabinet seulement.
test('en production, telle que le code la démarre : le détenteur de L’Explorateur le garde cité, le Cabinet fermé ou non ; qui ne l’a pas ne le voit et ne le gagne qu’avec le Cabinet ouvert', async () => {
  const prod = await demarrer({ online: true, baseDeLaCampagne: BASE })
  try {
    const sien = async (cookie: string) =>
      ((await lire(cookie, '/api/joueur/moi', prod)).corps.profile.hautsFaits as { key: string; fois: number; valeur: number; prochain: number | null }[]).find(h => h.key === 'hf:explorateur')
    const detenteur = await inscrireProfil(prod.url, 'detenteur', 'Détenteur')
    rangerLExplorateur(prod, (await lire(detenteur, '/api/joueur/moi', prod)).corps.profile.id as string, 2)
    const neuf = await inscrireProfil(prod.url, 'sans-explorateur', 'Sans')
    poserUneSalleComplete(prod, (await lire(neuf, '/api/joueur/moi', prod)).corps.profile.id as string, 'rempart')
    // Relu au démarrage : le profil sait ce qu'il a.
    await prod.redemarrer()
    const garde = await sien(detenteur)
    assert.deepEqual([garde?.fois, garde?.valeur, garde?.prochain], [2, 0, 6], 'son argent, où qu’en soit le Cabinet')
    // Sa salle complète ne compte qu'avec le Cabinet ouvert : fermé, ni la page ni la fin d'une partie ne la lisent.
    assert.equal((await sien(neuf)) !== undefined, CABINET_EN_PRODUCTION, 'cité avec le Cabinet seulement')
    const fin = await unPasPuisLaFin(neuf, prod)
    assert.equal(fin.recompenses.some(r => r.key === 'hf:explorateur:1'), CABINET_EN_PRODUCTION, 'décerné avec lui seulement')
  } finally {
    await prod.close()
  }
})

test('l’Ascension : une expédition menée au bout l’ouvre ; son cran se fige au départ parmi ceux qu’il a ouverts — demandé plus haut, le plus haut des siens —, le bilan le garde, et une victoire à son plus haut cran ouvre le suivant', async () => {
  const c = await inscrireProfil(banc.url, 'ascension', 'Ascension')
  const finie = await unPasPuisAbandon(c)
  assert.equal((await page(c)).prochaine.codex?.ascension, 0, 'sans victoire, aucun cran')
  const partir = async (corps: Record<string, unknown>) => {
    const parti = await poster(c, '/api/expedition', corps)
    assert.equal(parti.status, 200, parti.corps.error)
    return parti.corps as VueDeLExpedition
  }
  const abandonner = async (v: VueDeLExpedition) => assert.equal((await poster(c, `/api/expedition/${v.id}/abandon`)).status, 200)
  // Demandé sans victoire, un cran ne part pas — sans refuser le départ.
  let v = await partir({ rencontres: true, ascension: 2 })
  assert.equal(departDe(v.id).ascension, undefined)
  assert.equal(v.cartes?.ascension, undefined)
  assert.equal(v.cartes?.codex?.ascensionOuverte, 0, 'la fin dira le cran que sa victoire ouvre')
  await abandonner(v)
  // Une victoire d'avant l'Ascension l'ouvre.
  ecrireLeBilanEnBase(finie, ecrireLeBilan({ ...UNE_ESCALE, gardiens: 3, auBout: true }))
  assert.equal((await page(c)).prochaine.codex?.ascension, 1)
  // Un téléphone partagé retient le cran 4 d'un autre profil : il part au plus haut des siens.
  v = await partir({ rencontres: true, ascension: 4 })
  assert.equal(departDe(v.id).ascension, 1)
  assert.deepEqual([v.cartes?.ascension, v.cartes?.codex?.ascensionOuverte], [1, 1])
  const pas = await poster(c, `/api/expedition/${v.id}/geste`, { rang: v.rang + 1, geste: { quoi: 'avancer', vers: v.permises[0] } })
  assert.equal(pas.status, 200, pas.corps.error)
  await abandonner(v)
  assert.deepEqual(lireLeBilan(bilanEnBase(v.id)), { ...UNE_ESCALE, exploits: [], ascension: 1 }, 'son bilan garde son cran — perdue, elle n’ouvre rien')
  assert.equal((await page(c)).prochaine.codex?.ascension, 1)
  // Menée au bout au cran 1 : le cran 2 s'ouvre. Sans cran demandé, aucun.
  ecrireLeBilanEnBase(v.id, ecrireLeBilan({ ...UNE_ESCALE, gardiens: 3, auBout: true, ascension: 1 }))
  assert.equal((await page(c)).prochaine.codex?.ascension, 2)
  v = await partir({ rencontres: true })
  assert.equal(departDe(v.id).ascension, undefined, 'l’Ascension se choisit')
  await abandonner(v)
  // Aux règles d'avant, pas de codex : pas de cran.
  v = await partir({ ascension: 1 })
  assert.equal(departDe(v.id).ascension, undefined)
})

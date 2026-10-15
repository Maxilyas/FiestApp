// Les trophées des sentiers (le 15 octobre 2026 : « peu de trophées à gagner
// en campagne », et des paliers si durs qu'un portrait ne suffisait pas à y
// revenir) : trois pistes — Le Randonneur, les paliers validés en épreuve ;
// La Constellation, leurs étoiles ; Le Cartographe, les sentiers validés
// jusqu'au palier 8 — et deux exploits — L'Impeccable, seize sur seize en jeu
// dès le cinquième palier ; Contre toute attente, un palier validé du
// premier coup quand sa chance l'annonçait en piste noire. Les paliers repris
// des portraits d'avant n'y comptent qu'une fois rejoués et validés, comme
// leur expérience.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { hautsFaitsDeLEpreuve } from '../src/core/campagne'
import { ProfileStore } from '../src/auth/profiles'
import { HAUTS_FAITS_DE_CARRIERE, clePalier, hautFaitDeSoiree, paliersDeCampagneAtteints } from '../../shared/hautsfaits'
import { pageDuTrophee } from '../../shared/pagesDesTrophees'
import { AUCUNE_CAMPAGNE } from '../../shared/profil'
import { PALIER_DU_CARTOGRAPHE, PALIER_DU_MAITRE, QUESTIONS_PAR_EPREUVE, SANS_VRAI_FAUX_DES, couleurDePiste, statsDesSentiers, type EtatDesSentiers } from '../../shared/sentiers'
import type { CleDeBranche } from '../../shared/branches'

// Un Éclat tiré au hasard ferait tomber La Pluie d'Éclats parmi les trophées comptés.
ProfileStore.tirageEclat = () => false

// ── Les règles pures ───────────────────────────────────────────────────────

/** Les notes d'un sentier, palier par palier, en étoiles ; 0 : jamais validé en épreuve. */
const notes = (...etoiles: number[]) => ({ etoiles: [...etoiles, ...Array<number>(PALIER_DU_MAITRE - etoiles.length).fill(0)] })

test('les pistes des sentiers comptent ce qui s’est validé en épreuve : les paliers, leurs étoiles, les sentiers validés jusqu’au palier 8', () => {
  assert.deepEqual(statsDesSentiers([]), { paliersValides: 0, etoiles: 0, sentiersMenes: 0 })
  // La forêt jusqu'au huitième palier, le stade jusqu'au troisième.
  const foret = notes(1, 1, 3, 1, 1, 2, 1, 3)
  const stade = notes(2, 1, 1)
  assert.deepEqual(statsDesSentiers([foret, stade]), { paliersValides: 11, etoiles: 17, sentiersMenes: 1 })
  // Un sentier repris des portraits d'avant n'a pas d'étoile : il n'y compte
  // pas tant qu'il n'est pas rejoué. Repris au huitième, le neuvième validé
  // en épreuve le mène plus loin que le palier 8 : il compte.
  assert.deepEqual(statsDesSentiers([foret, stade, notes()]), { paliersValides: 11, etoiles: 17, sentiersMenes: 1 })
  assert.deepEqual(statsDesSentiers([foret, stade, notes(0, 0, 0, 0, 0, 0, 0, 0, 2)]), { paliersValides: 12, etoiles: 19, sentiersMenes: 2 })
  // Le septième ne suffit pas ; le maître, un palier comme un autre.
  assert.deepEqual(statsDesSentiers([notes(1, 1, 1, 1, 1, 1, 1)]).sentiersMenes, 0)
  assert.deepEqual(statsDesSentiers([notes(...Array<number>(PALIER_DU_MAITRE).fill(3))]), { paliersValides: 13, etoiles: 39, sentiersMenes: 1 })
})

test('trois pistes sur la page des sentiers, à leurs seuils : elles tombent avec celles de la campagne', () => {
  const pistes = HAUTS_FAITS_DE_CARRIERE.filter(h => pageDuTrophee(clePalier(h.key, 1)) === 'sentiers')
  assert.deepEqual(
    pistes.map(h => [h.key, [...h.paliers]]),
    [
      ['hf:randonneur', [12, 48, 120]],
      ['hf:constellation', [25, 100, 250]],
      ['hf:cartographe', [3, 6, 12]],
    ],
  )
  // Le Cartographe et L'Impeccable écrivent leur palier tel quel — collé à
  // son numéro par une espace insécable : il suit la constante.
  assert.equal(PALIER_DU_CARTOGRAPHE, 8)
  assert.match(pistes[2].mesure, new RegExp(`palier ${PALIER_DU_CARTOGRAPHE}$`))
  assert.match(pistes[2].mesureUne, new RegExp(`palier ${PALIER_DU_CARTOGRAPHE}$`))
  assert.match(hautFaitDeSoiree('hf:impeccable')!.rule, new RegExp(`palier ${SANS_VRAI_FAUX_DES}$`))
  // Ce que la campagne compte les fait tomber, à la fin d'une série ou d'une épreuve.
  assert.deepEqual(paliersDeCampagneAtteints({ ...AUCUNE_CAMPAGNE, paliersValides: 12, etoiles: 99, sentiersMenes: 6 }).sort(), [
    'hf:cartographe:1',
    'hf:cartographe:2',
    'hf:constellation:1',
    'hf:randonneur:1',
  ])
  // Leurs deux exploits aussi.
  for (const cle of ['hf:randonneur:3', 'hf:impeccable', 'hf:contre-toute-attente']) assert.equal(pageDuTrophee(cle), 'sentiers', cle)
  // Les pistes de la campagne restent les siennes.
  assert.equal(pageDuTrophee('hf:marathonien:1'), 'campagne')
})

test('les exploits d’une épreuve se lisent sur elle : seize sur seize en jeu dès le cinquième palier, validée du premier coup en piste noire', () => {
  const epreuve = (palier: number, plus: { rejeu?: boolean; issue?: 'validee' | 'ratee' | null; chance?: number | null } = {}) => ({
    palier,
    rejeu: false,
    issue: 'validee' as const,
    chance: null,
    ...plus,
  })
  // Seize sur seize au cinquième palier, en jeu : L'Impeccable.
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(SANS_VRAI_FAUX_DES), QUESTIONS_PAR_EPREUVE, 0), ['hf:impeccable'])
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(PALIER_DU_MAITRE), QUESTIONS_PAR_EPREUVE, 0), ['hf:impeccable'], 'seize expertes : le maître aussi')
  // Avant, le vrai ou faux y aidait ; à quinze, ce n'est pas impeccable ; un
  // rejeu se rejoue à volonté, sans rien risquer.
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(SANS_VRAI_FAUX_DES - 1), QUESTIONS_PAR_EPREUVE, 0), [])
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(8), QUESTIONS_PAR_EPREUVE - 1, 0), [])
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(8, { rejeu: true }), QUESTIONS_PAR_EPREUVE, 0), [])
  // Validée du premier coup, sa chance l'annonçait en piste noire : Contre toute attente.
  assert.equal(couleurDePiste(0.12), 'noire')
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(6, { chance: 0.12 }), 10, 0), ['hf:contre-toute-attente'])
  // En piste rouge, l'attente n'était pas si basse ; sans chance annoncée, rien à démentir.
  assert.equal(couleurDePiste(0.2), 'rouge')
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(6, { chance: 0.2 }), 10, 0), [])
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(6), 10, 0), [])
  // Après un échec sur ce palier, ce n'est plus du premier coup ; ratée, rien.
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(6, { chance: 0.12 }), 10, 1), [])
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(6, { chance: 0.12, issue: 'ratee' }), 3, 0), [])
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(6, { chance: 0.12, rejeu: true }), 10, 0), [])
  // Les deux à la fois.
  assert.deepEqual(hautsFaitsDeLEpreuve(epreuve(9, { chance: 0.05 }), QUESTIONS_PAR_EPREUVE, 0).sort(), ['hf:contre-toute-attente', 'hf:impeccable'])
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Jeudi 15 octobre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 9, 15, 8, 0)
const JOUR = 86_400_000

type Reponse = { status: number; corps: any }
const lire = (banc: Banc, cookie: string, chemin: string): Promise<Reponse> =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: await r.json() }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}): Promise<Reponse> =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: await r.json() }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDuProfil = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi?leger')).corps.profile.id as string

/** Des épreuves déjà validées, écrites au journal — `[branche, palier, bonnes réponses]`, en jeu, au seuil de dix. */
function valider(banc: Banc, profileId: string, epreuves: readonly [CleDeBranche, number, number][]) {
  base(banc, db => {
    const ligne = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, branche, palier, seuil, rejeu, issue)
       VALUES (?, ?, '[]', 16, 0, ?, ?, ?, 'sentier', ?, ?, 10, 0, 'validee')`,
    )
    const debut = DEBUT - 3 * JOUR
    epreuves.forEach(([branche, palier, justes], i) => ligne.run(randomUUID(), profileId, justes, debut + i * 60_000, debut + i * 60_000 + 30_000, branche, palier))
  })
}

/** Des paliers tenus de portraits d'avant les sentiers (`sentier_acquis`) : validés sans épreuve, sans étoiles. */
function acquerir(banc: Banc, profileId: string, paliers: Partial<Record<CleDeBranche, number>>) {
  base(banc, db => {
    const ligne = db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)')
    for (const [branche, n] of Object.entries(paliers)) ligne.run(profileId, branche, n, DEBUT - 30 * JOUR)
  })
}

/** La bonne réponse d'une question de `baseDEssai` : celle qui commence par « Bonne ». */
const bonneDe = (q: { reponses: string[] }) => q.reponses.findIndex(r => r.startsWith('Bonne'))

/** Joue une épreuve : `justes` bonnes réponses d'abord, puis des fautes, jusqu'à sa fin. Rend la dernière réponse. */
async function jouer(banc: Banc, cookie: string, epreuve: any, justes: number): Promise<any> {
  assert.ok(epreuve.id, epreuve.error)
  let e = epreuve
  let derniere: any = null
  for (let i = 0; !e.finie && e.question; i++) {
    const q = e.question
    const choix = i < justes ? bonneDe(q) : (bonneDe(q) + 1) % q.reponses.length
    const r = await poster(banc, cookie, `/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    e = r.corps.epreuve
  }
  return derniere
}

const commencer = async (banc: Banc, cookie: string, branche: CleDeBranche, palier: number) =>
  (await poster(banc, cookie, '/api/campagne/sentiers/epreuve', { branche, palier })).corps

const tombes = (fin: any): string[] => (fin.recompenses ?? []).map((r: any) => r.key).sort()

/** Ce que sa page dit d'un trophée : ses métaux ou ses fois, où il en est, et où il se gagne. */
async function vu(banc: Banc, cookie: string, cle: string) {
  const h = ((await lire(banc, cookie, '/api/joueur/moi')).corps.profile.hautsFaits as any[]).find(x => x.key === cle)
  return [h.fois, h.valeur, h.origine]
}

test('la fin d’une épreuve fait tomber les étapes des trois pistes — rien pour les paliers repris sans épreuve', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: baseDEssai(160, { categories: ['Nature'] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = await idDuProfil(banc, lea)
    // Déjà validés : le huitième palier du stade et de l'écran, sans faute ;
    // la forêt jusqu'au septième, deux étoiles chacun ; deux paliers de la
    // brigade. Onze paliers, vingt-trois étoiles, deux sentiers au huitième.
    valider(banc, id, [
      ['stade', 8, 16],
      ['ecran', 8, 16],
      ...[1, 2, 3, 4, 5, 6, 7].map((p): [CleDeBranche, number, number] => ['foret', p, 13]),
      ['brigade', 1, 13],
      ['brigade', 2, 10],
    ])
    // Le tour du monde, repris jusqu'au sommet de ses portraits d'avant : sans épreuve, il n'y compte pas.
    acquerir(banc, id, { monde: 12 })

    // Le huitième palier de la forêt, deux étoiles : le douzième palier, la vingt-cinquième étoile, le troisième sentier.
    const fin = await jouer(banc, lea, await commencer(banc, lea, 'foret', 8), 13)
    assert.deepEqual([fin.epreuve.issue, fin.etoiles], ['validee', 2])
    assert.deepEqual(tombes(fin), ['hf:cartographe:1', 'hf:constellation:1', 'hf:randonneur:1'])
    // Sa page : chaque piste au bronze, où il en est, et rangée avec les sentiers.
    assert.deepEqual(await vu(banc, lea, 'hf:randonneur'), [1, 12, 'sentiers'])
    assert.deepEqual(await vu(banc, lea, 'hf:constellation'), [1, 25, 'sentiers'])
    assert.deepEqual(await vu(banc, lea, 'hf:cartographe'), [1, 3, 'sentiers'])
    // Les pistes de la campagne, elles, restent les siennes.
    assert.equal((await vu(banc, lea, 'hf:marathonien'))[2], 'campagne')
  } finally {
    await banc.close()
  }
})

test('seize sur seize sur un palier en jeu, dès le cinquième : L’Impeccable — ni en rejeu, ni avant', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: baseDEssai(240, { categories: ['Nature', 'Sport'] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = await idDuProfil(banc, lea)
    acquerir(banc, id, { foret: SANS_VRAI_FAUX_DES - 1, stade: SANS_VRAI_FAUX_DES - 2 })
    const fin = await jouer(banc, lea, await commencer(banc, lea, 'foret', SANS_VRAI_FAUX_DES), QUESTIONS_PAR_EPREUVE)
    assert.deepEqual([fin.epreuve.rejeu, fin.etoiles], [false, 3])
    assert.deepEqual(
      (fin.recompenses as any[]).map(r => [r.key, r.emoji, r.title]),
      [['hf:impeccable', '💎', 'L’Impeccable']],
    )
    // Rejoué sans faute : il ne risquait rien.
    const rejeu = await jouer(banc, lea, await commencer(banc, lea, 'foret', SANS_VRAI_FAUX_DES), QUESTIONS_PAR_EPREUVE)
    assert.deepEqual([rejeu.epreuve.rejeu, tombes(rejeu)], [true, []])
    // Au quatrième palier, le vrai ou faux y aidait encore.
    const avant = await jouer(banc, lea, await commencer(banc, lea, 'stade', SANS_VRAI_FAUX_DES - 1), QUESTIONS_PAR_EPREUVE)
    assert.deepEqual([avant.epreuve.rejeu, avant.etoiles, tombes(avant)], [false, 3, []])
    // Il se regagne : rangé sous l'épreuve, une fois chacune.
    assert.deepEqual(await vu(banc, lea, 'hf:impeccable'), [1, undefined, 'sentiers'])
  } finally {
    await banc.close()
  }
})

/** Trois cents questions : cent de sport, de cinéma et d'histoire, vingt de chaque difficulté. */
const BASE = baseDEssai(300, { categories: ['Sport', 'Cinéma & séries', 'Histoire'] })
const DE = (categorie: string) => BASE.questions.filter(q => q.meta.categorie === categorie && q.meta.difficulte >= 2 && q.meta.difficulte <= 4)

/** Une série finie et ses premières réponses, écrites au journal : `[question, juste, quand]`. */
function ecrireUnPasse(banc: Banc, profileId: string, reponses: readonly [string, boolean, number][]) {
  base(banc, db => {
    const serie = randomUUID()
    const debut = Math.min(...reponses.map(r => r[2]))
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'serie')`).run(
      serie,
      profileId,
      reponses.length,
      reponses.filter(r => r[1]).length,
      debut,
      debut + 3_600_000,
    )
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
    db.transaction(() => reponses.forEach(([q, juste, quand], i) => reponse.run(serie, i, q, juste ? 1 : 0, quand)))()
  })
}

/** Le modèle du savoir, lancé en fond par la page des sentiers : on attend qu'il soit ajusté. */
async function modeleAjuste(url: string) {
  for (let essai = 0; essai < 200; essai++) {
    const sante = (await (await fetch(`${url}/healthz`)).json()) as { campagne?: { savoir?: { ajusteLe: number | null } } }
    if (sante.campagne?.savoir?.ajusteLe) return
    await new Promise(rendre => setTimeout(rendre, 50))
  }
  assert.fail('le modèle du savoir ne s’est pas ajusté')
}

const chanceGardee = (banc: Banc, epreuve: string) => base(banc, db => (db.prepare('SELECT chance FROM campagne_series WHERE id = ?').get(epreuve) as { chance: number | null }).chance)

test('validé du premier coup, quand sa chance l’annonçait en piste noire : Contre toute attente — la chance gardée au départ de l’épreuve', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE, prechauffageCampagneMs: 3_600_000 })
  try {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const id = await idDuProfil(banc, zoe)
    // Le cinéma et l'histoire, tout raté il y a deux jours ; le douzième palier l'attend sur l'écran et les mythologies.
    const avantHier = DEBUT - 2 * JOUR
    ecrireUnPasse(banc, id, [
      ...DE('Cinéma & séries').slice(0, 40).map((q, i): [string, boolean, number] => [q.id, false, avantHier + i * 10_000]),
      ...DE('Histoire').slice(0, 40).map((q, i): [string, boolean, number] => [q.id, false, avantHier + (40 + i) * 10_000]),
    ])
    acquerir(banc, id, { ecran: 11, mythes: 11 })
    await lire(banc, zoe, '/api/campagne/sentiers')
    await modeleAjuste(banc.url)
    const { pourToi } = (await lire(banc, zoe, '/api/campagne/sentiers')).corps as EtatDesSentiers
    const ecran = pourToi!.find(c => c.branche === 'ecran')!
    const mythes = pourToi!.find(c => c.branche === 'mythes')!
    assert.deepEqual([ecran.palier, couleurDePiste(ecran.chance), couleurDePiste(mythes.chance)], [12, 'noire', 'noire'])

    // Le départ garde la chance que la page lui disait.
    const e = await commencer(banc, zoe, 'ecran', 12)
    assert.equal(chanceGardee(banc, e.id), ecran.chance)
    const fin = await jouer(banc, zoe, e, 10)
    assert.equal(fin.epreuve.issue, 'validee')
    assert.deepEqual(tombes(fin), ['hf:contre-toute-attente'])
    assert.deepEqual(await vu(banc, zoe, 'hf:contre-toute-attente'), [1, undefined, 'sentiers'])

    // Un rejeu ne risque rien : rien d'annoncé à démentir.
    const rejeu = await commencer(banc, zoe, 'ecran', 12)
    assert.deepEqual([rejeu.rejeu, chanceGardee(banc, rejeu.id)], [true, null])
    await poster(banc, zoe, `/api/campagne/epreuve/${rejeu.id}/abandon`)

    // Raté d'abord, validé ensuite : ce n'est plus du premier coup.
    const rate = await jouer(banc, zoe, await commencer(banc, zoe, 'mythes', 12), 0)
    assert.equal(rate.epreuve.issue, 'ratee')
    const seconde = await commencer(banc, zoe, 'mythes', 12)
    assert.equal(couleurDePiste(chanceGardee(banc, seconde.id)!), 'noire')
    const finSeconde = await jouer(banc, zoe, seconde, 10)
    assert.deepEqual([finSeconde.epreuve.issue, tombes(finSeconde)], ['validee', []])
  } finally {
    await banc.close()
  }
})

test('au démarrage, les épreuves d’avant se relisent une fois : les étapes des pistes et L’Impeccable, sans rien doubler', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: baseDEssai(80, { categories: ['Nature'] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = await idDuProfil(banc, lea)
    // Le sommet de la forêt, une étoile par palier — sauf le sixième, seize sur seize.
    valider(
      banc,
      id,
      Array.from({ length: 12 }, (_, i): [CleDeBranche, number, number] => ['foret', i + 1, i + 1 === 6 ? 16 : 10]),
    )
    base(banc, db => db.prepare(`DELETE FROM campagne_meta WHERE cle = 'relecture_des_epreuves'`).run())
    await banc.redemarrer()
    assert.deepEqual(await vu(banc, lea, 'hf:randonneur'), [1, 12, 'sentiers'])
    assert.deepEqual(await vu(banc, lea, 'hf:impeccable'), [1, undefined, 'sentiers'])
    assert.deepEqual((await vu(banc, lea, 'hf:constellation')).slice(0, 2), [0, 14])
    // Relue une fois : un autre démarrage n'y revient pas, et rien ne se double.
    await banc.redemarrer()
    assert.deepEqual(await vu(banc, lea, 'hf:impeccable'), [1, undefined, 'sentiers'])
  } finally {
    await banc.close()
  }
})

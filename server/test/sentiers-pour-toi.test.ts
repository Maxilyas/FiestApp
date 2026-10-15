// Sa chance sur chaque sentier (le choix du propriétaire du 15 octobre 2026 :
// garder les questions difficiles, et dire honnêtement à chacun où il a ses
// chances, plutôt que de rien adoucir) : la page des sentiers dit la chance
// de valider du premier coup le palier qui l'attend, lue par le modèle du
// savoir sur ses premières réponses, sa couleur de piste, et ce qu'elle
// valait il y a une semaine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, inscrireProfil, type Banc } from './banc'
import { NIVEAUX, type Niveau } from '../../shared/campagne'
import { BRANCHES, type CleDeBranche } from '../../shared/branches'
import {
  COULEURS_DES_PISTES,
  PREMIERES_REPONSES_POUR_SA_CHANCE,
  REPONSES_DE_SA_PROGRESSION,
  chanceDeValider,
  couleurDePiste,
  pourcentDeChance,
  regleDuPalier,
  type ChanceDuSentier,
  type EtatDesSentiers,
} from '../../shared/sentiers'
import { chance, chanceDeLEpreuve, indiceDeCategorie, serieDeReference } from '../src/core/modeleDuSavoir'

// ── Les règles pures ───────────────────────────────────────────────────────

test('la couleur d’une chance : verte dès 70 %, bleue dès 45 %, rouge dès 20 %, noire en deçà', () => {
  assert.deepEqual(
    [0.99, 0.7, 0.69, 0.45, 0.449, 0.2, 0.199, 0].map(couleurDePiste),
    ['verte', 'verte', 'bleue', 'bleue', 'rouge', 'rouge', 'noire', 'noire'],
  )
  assert.deepEqual(
    COULEURS_DES_PISTES.map(p => p.couleur),
    ['verte', 'bleue', 'rouge', 'noire'],
    'de la plus sûre à la plus dure',
  )
  // Ni « 100 % », qu'aucune épreuve ne garantit, ni « 0 % », qui condamnerait d'avance.
  assert.deepEqual([0.9996, 0.354, 0.0004].map(pourcentDeChance), [99, 35, 1])
})

/** Une série de référence à la main : huit questions par marche dans une catégorie, à ces difficultés. */
function referenceDe(categorie: string, difficultes: Readonly<Record<Niveau, number>>) {
  const jouables = NIVEAUX.flatMap(n => Array.from({ length: 8 }, (_, i) => ({ n, d: difficultes[n] + (i - 3.5) * 0.1, meta: { categorie } })))
  return serieDeReference(jouables, q => q.n, q => q.d)
}

test('sa chance d’une épreuve : plus haute plus il est fort, plus basse sur un mélange plus dur — et jamais aussi sûre que sa force seule', () => {
  const reference = referenceDe('Sport', { facile: -2, moyen: 0, difficile: 1.2, expert: 2.5 })
  const c = indiceDeCategorie('Sport')
  const p8 = regleDuPalier(8)!
  const p12 = regleDuPalier(12)!
  const sa = (net: number, r = p8) => chanceDeLEpreuve(reference, c, net, r.melange, r.seuil)
  // Elle monte avec sa force.
  const forces = [-2, -1, 0, 1, 2]
  forces.slice(1).forEach((f, i) => assert.ok(sa(f) > sa(forces[i]), `${f} contre ${forces[i]}`))
  // Le douzième palier, plus dur que le huitième.
  assert.ok(sa(0, p12) < sa(0))
  // Sa forme du jour : un fort n'est jamais tout à fait sûr de passer, un faible jamais tout à fait perdu.
  const sansLaForme = (net: number) => {
    const taux = Object.fromEntries(NIVEAUX.map(n => [n, reference.marches[n][0].difficultes.reduce((s, d) => s + chance(net - d), 0) / reference.marches[n][0].difficultes.length])) as Record<Niveau, number>
    return chanceDeValider(p8.melange, p8.seuil, taux)
  }
  assert.ok(sansLaForme(2) > 0.9 && sa(2) < sansLaForme(2), `le fort : ${sa(2).toFixed(3)} contre ${sansLaForme(2).toFixed(3)}`)
  assert.ok(sansLaForme(-1.5) < 0.1 && sa(-1.5) > sansLaForme(-1.5), `le faible : ${sa(-1.5).toFixed(3)} contre ${sansLaForme(-1.5).toFixed(3)}`)
  // Une catégorie que la base n'a pas se lit sur les autres, au lieu de compter pour perdue.
  assert.ok(sa(0) > 0 && Math.abs(chanceDeLEpreuve(reference, indiceDeCategorie('Cuisine'), 0, p8.melange, p8.seuil) - sa(0)) < 1e-9)
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Jeudi 15 octobre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 9, 15, 8, 0)
const JOUR = 86_400_000

/** Trois cents questions : cent de sport, de cinéma et d'histoire, vingt de chaque difficulté. */
const BASE = baseDEssai(300, { categories: ['Sport', 'Cinéma & séries', 'Histoire'] })
const DE = (categorie: string) => BASE.questions.filter(q => q.meta.categorie === categorie && q.meta.difficulte >= 2 && q.meta.difficulte <= 4)

/** Une série finie et ses premières réponses, écrites dans la base permanente : `[question, juste, quand]`. */
function ecrireUnPasse(banc: Banc, profileId: string, reponses: readonly [string, boolean, number][]) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
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
    db.transaction(() => reponses.forEach(([id, juste, quand], i) => reponse.run(serie, i, id, juste ? 1 : 0, quand)))()
  } finally {
    db.close()
  }
}

/** Des paliers déjà tenus, sans épreuve (`sentier_acquis`) : de quoi viser un palier qui départage. */
function acquerir(banc: Banc, profileId: string, paliers: Partial<Record<CleDeBranche, number>>) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const ligne = db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, ?)')
    for (const [branche, n] of Object.entries(paliers)) ligne.run(profileId, branche, n, DEBUT - 30 * JOUR)
  } finally {
    db.close()
  }
}

const idDuProfil = async (url: string, cookie: string) =>
  ((await (await fetch(`${url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as { profile: { id: string } }).profile.id

const lireLesSentiers = async (url: string, cookie: string) => (await (await fetch(`${url}/api/campagne/sentiers`, { headers: { Cookie: cookie } })).json()) as EtatDesSentiers

/** Le modèle du savoir, lancé en fond par la page : on attend qu'il soit ajusté. */
async function modeleAjuste(url: string) {
  for (let essai = 0; essai < 200; essai++) {
    const sante = (await (await fetch(`${url}/healthz`)).json()) as { campagne?: { savoir?: { ajusteLe: number | null } } }
    if (sante.campagne?.savoir?.ajusteLe) return
    await new Promise(rendre => setTimeout(rendre, 50))
  }
  assert.fail('le modèle du savoir ne s’est pas ajusté')
}

const sur = (pourToi: readonly ChanceDuSentier[] | undefined, b: CleDeBranche) => pourToi?.find(c => c.branche === b)

test('la page des sentiers dit sa chance sur chacun, lue de ses premières réponses : le stade où il trouve, l’écran où il rate', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE, prechauffageCampagneMs: 3_600_000 })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const id = await idDuProfil(banc.url, lea)
    // Trente questions de sport trouvées, trente de cinéma ratées, il y a deux jours.
    const avantHier = DEBUT - 2 * JOUR
    ecrireUnPasse(banc, id, [
      ...DE('Sport').slice(0, 30).map((q, i): [string, boolean, number] => [q.id, true, avantHier + i * 10_000]),
      ...DE('Cinéma & séries').slice(0, 30).map((q, i): [string, boolean, number] => [q.id, false, avantHier + (30 + i) * 10_000]),
    ])
    // Le septième palier tenu au stade et à l'écran, le sommet dans la forêt, le maître au théâtre.
    acquerir(banc, id, { stade: 7, ecran: 7, foret: 12, scene: 13 })

    // Avant le premier ajustement du modèle, la page ne dit pas de chance — et le lance.
    const avant = await lireLesSentiers(banc.url, lea)
    assert.equal(avant.pourToi, undefined)
    await modeleAjuste(banc.url)

    const { pourToi, sentiers } = await lireLesSentiers(banc.url, lea)
    assert.ok(pourToi, 'sa chance, une fois le modèle ajusté')
    // Chaque sentier a la sienne, sur le palier qui l'attend ; le maître validé n'attend plus rien.
    assert.deepEqual(
      pourToi.map(c => [c.branche, c.palier]),
      BRANCHES.filter(b => b.key !== 'scene').map(b => [b.key, (sentiers.find(s => s.branche === b.key)?.paliers ?? 0) + 1]),
    )
    assert.equal(sur(pourToi, 'foret')!.palier, 13, 'après le sommet, le maître')
    for (const c of pourToi) assert.ok(c.chance > 0 && c.chance < 1, `${c.branche} : ${c.chance}`)
    // Le huitième palier : facile pour elle au stade, un mur à l'écran.
    const stade = sur(pourToi, 'stade')!.chance
    const ecran = sur(pourToi, 'ecran')!.chance
    assert.ok(stade > ecran + 0.3, `le stade ${stade}, l’écran ${ecran}`)
    assert.notEqual(couleurDePiste(stade), couleurDePiste(ecran))
    // Toutes ses réponses ont moins d'une semaine : rien à quoi comparer.
    assert.ok(pourToi.every(c => c.avant === undefined))
  } finally {
    await banc.close()
  }
})

test('sous vingt premières réponses, la page ne dit pas de chance : ce serait celle d’un joueur moyen', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE, prechauffageCampagneMs: 3_600_000 })
  try {
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const id = await idDuProfil(banc.url, tom)
    const peu = DE('Sport').slice(0, PREMIERES_REPONSES_POUR_SA_CHANCE - 1)
    ecrireUnPasse(banc, id, peu.map((q, i): [string, boolean, number] => [q.id, true, DEBUT - JOUR + i * 10_000]))
    await lireLesSentiers(banc.url, tom)
    await modeleAjuste(banc.url)
    assert.equal((await lireLesSentiers(banc.url, tom)).pourToi, undefined)
    // Une de plus, et elle se dit.
    ecrireUnPasse(banc, id, [[DE('Sport')[PREMIERES_REPONSES_POUR_SA_CHANCE].id, true, DEBUT - JOUR / 2]])
    assert.ok((await lireLesSentiers(banc.url, tom)).pourToi)
  } finally {
    await banc.close()
  }
})

test('ce que sa chance valait il y a une semaine : là où il a progressé depuis, et seulement là où il avait déjà répondu, et a répondu depuis', async () => {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE, prechauffageCampagneMs: 3_600_000 })
  try {
    const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐼')
    const id = await idDuProfil(banc.url, zoe)
    const il = (jours: number) => DEBUT - jours * JOUR
    const sport = DE('Sport')
    const cinema = DE('Cinéma & séries')
    const histoire = BASE.questions.filter(q => q.meta.categorie === 'Histoire')
    // Il y a dix jours : le sport raté, le cinéma trouvé.
    ecrireUnPasse(banc, id, [
      ...sport.slice(0, 25).map((q, i): [string, boolean, number] => [q.id, false, il(10) + i * 10_000]),
      ...cinema.slice(0, 25).map((q, i): [string, boolean, number] => [q.id, true, il(10) + (25 + i) * 10_000]),
    ])
    // Cette semaine : du sport, trouvé — assez pour se lire ; du cinéma, trop
    // peu ; et de l'histoire, qu'elle n'avait jamais jouée.
    ecrireUnPasse(banc, id, [
      ...sport.slice(25, 25 + REPONSES_DE_SA_PROGRESSION + 5).map((q, i): [string, boolean, number] => [q.id, true, il(2) + i * 10_000]),
      ...cinema.slice(25, 25 + REPONSES_DE_SA_PROGRESSION - 1).map((q, i): [string, boolean, number] => [q.id, true, il(2) + (20 + i) * 10_000]),
      ...histoire.slice(0, 2 * REPONSES_DE_SA_PROGRESSION).map((q, i): [string, boolean, number] => [q.id, true, il(2) + (40 + i) * 10_000]),
    ])
    acquerir(banc, id, { stade: 7, ecran: 7 })
    await lireLesSentiers(banc.url, zoe)
    await modeleAjuste(banc.url)
    const { pourToi } = await lireLesSentiers(banc.url, zoe)
    const stade = sur(pourToi, 'stade')!
    assert.ok(stade.avant !== undefined && stade.avant < stade.chance - 0.05, `le stade : ${stade.avant} il y a une semaine, ${stade.chance} aujourd’hui`)
    // Neuf réponses de cinéma cette semaine : pas assez pour dire ce qu'elles ont changé.
    assert.equal(sur(pourToi, 'ecran')!.avant, undefined)
    // Rien répondu en cuisine depuis : sa chance d'avant n'y dirait rien d'elle.
    assert.equal(sur(pourToi, 'brigade')!.avant, undefined)
    // L'histoire, jamais jouée avant la semaine : sa chance d'alors n'était que son niveau d'ailleurs.
    assert.equal(sur(pourToi, 'mythes')!.avant, undefined)
  } finally {
    await banc.close()
  }
})

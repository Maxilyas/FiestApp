// Les joueurs au QG (`/admin#joueurs`, le lot 6 du QG 2, le 4 novembre 2026) :
// la feuille de présence et la mémoire longue (`qg_presences`, `qg_jours`),
// dérivées des journaux, écrites une fois par jour fini et rattrapées quand
// elles manquent ; ce que la page en tire — les joueurs du jour, de la
// semaine, du mois, la fidélité, les segments, les cohortes, quand on joue,
// qui joue à quoi, d'où viennent les profils ; et ce qu'elle coûte à la base :
// un jour fini se lit une fois, aujourd'hui se relit par ses index.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { dUneTraite } from '../../shared/tranches'
import { jourAvant, jourDe } from '../../shared/jour'
import { participationsParSeau } from '../../shared/qg'
import { lireLOrigine, origineDeLAccueil } from '../../shared/origines'
import { FORMULE, celluleDeTableur, texteTabule } from '../../shared/tableur'
import {
  BIT_DU_MODE,
  VERSION_DE_LA_MEMOIRE,
  calculDeLaPage,
  cohortesDesProfils,
  combinaisonsDesModes,
  heuresDeJeu,
  joursDeLaMemoire,
  lignesDeLaMemoire,
  lireLeSegment,
  minuitDuJour,
  nomDeLaCombinaison,
  originesDesProfils,
  presencesDuJour,
  segmentsDesProfils,
  tracesDesTrenteJours,
  type ChiffresDUnJour,
  type ComptesDesSegments,
  type PageDesJoueurs,
  type Presence,
  type ProfilDeLAudience,
} from '../../shared/qgJoueurs'

/** Mercredi 4 novembre 2026, 21 h à Paris — l'heure d'hiver : 20 h du temps universel. */
const MAINTENANT = Date.UTC(2026, 10, 4, 20, 0)
const AUJOURDHUI = '2026-11-04'
const J = 86_400_000
const H = 3_600_000
/** Un instant d'un jour de Paris, à telle heure. */
const a = (jour: string, heure: number) => minuitDuJour(jour) + heure * H
const il_y_a = (n: number) => jourAvant(AUJOURDHUI, n)

/** Une feuille de présence d'un jour, profil par profil — tous à 10 h, sur un seul mode. */
const feuille = (jour: string, ...qui: string[]): [string, Presence[]] => [jour, qui.map(q => ({ jour, qui: q, modes: BIT_DU_MODE.jour, premiere: 600 }))]

// ── Les dérivations ─────────────────────────────────────────────────────────

test('la feuille d’un jour : chaque profil une fois, l’union de ses modes, la minute de sa première partie', () => {
  const jour = '2026-11-03'
  const minuit = minuitDuJour(jour)
  assert.equal(jourDe(minuit), jour)
  assert.equal(jourDe(minuit - 1), '2026-11-02')
  const p = presencesDuJour(jour, minuit, [
    { qui: 'bob', quand: minuit + 90 * 60_000, mode: 'jour' },
    { qui: 'ana', quand: a(jour, 20), mode: 'campagne' },
    { qui: 'ana', quand: a(jour, 8), mode: 'duel' },
    { qui: 'ana', quand: a(jour, 9), mode: 'duel' },
  ])
  assert.deepEqual(p, [
    { jour, qui: 'ana', modes: BIT_DU_MODE.campagne | BIT_DU_MODE.duel, premiere: 480 },
    { jour, qui: 'bob', modes: BIT_DU_MODE.jour, premiere: 90 },
  ])
})

test('les jours d’une plage : leurs feuilles, leurs chiffres comptés comme le poste de commande, la semaine et le mois sur les feuilles d’avant', () => {
  const jours = ['2026-11-02', '2026-11-03']
  const minuits = jours.map(minuitDuJour)
  const fin = minuitDuJour('2026-11-04')
  const solo = [
    { qui: 'ana', quand: a('2026-11-02', 9), mode: 'jour' as const },
    { qui: 'ana', quand: a('2026-11-02', 21), mode: 'campagne' as const },
    { qui: 'bob', quand: a('2026-11-03', 21), mode: 'duel' as const },
    // Hors de la plage : ni avant, ni après.
    { qui: 'eve', quand: minuits[0] - 1, mode: 'jour' as const },
    { qui: 'eve', quand: fin, mode: 'jour' as const },
  ]
  // Une soirée de cinq invités, dont deux profils ; une d'avant les profils, de trois invités, tous à part.
  const soirees = [
    { quand: a('2026-11-03', 21), joueurs: 5, profils: ['ana', 'cid'] },
    { quand: a('2026-11-03', 22), joueurs: 3 },
  ]
  const journaux = { solo, soireesDesProfils: [{ qui: 'dan', quand: a('2026-11-02', 23) }], soirees, inscriptions: [a('2026-11-02', 10)], achats: [a('2026-11-03', 12), a('2026-11-03', 13)] }
  // Les vingt-neuf jours d'avant : Zoé, il y a dix jours, compte au mois et pas à la semaine.
  const avant = new Map([['2026-10-24', ['zoe']]])
  const [lundi, mardi] = dUneTraite(joursDeLaMemoire(journaux, minuits, fin, avant))
  assert.deepEqual(
    lundi.presences.map(p => [p.qui, p.modes]),
    [
      ['ana', BIT_DU_MODE.jour | BIT_DU_MODE.campagne],
      ['dan', BIT_DU_MODE.soiree],
    ],
  )
  assert.deepEqual(
    mardi.presences.map(p => [p.qui, p.modes]),
    [
      ['ana', BIT_DU_MODE.soiree],
      ['bob', BIT_DU_MODE.duel],
      ['cid', BIT_DU_MODE.soiree],
    ],
  )
  // Comptés comme le poste de commande, de la même règle (`participationsParSeau`).
  const [seau] = participationsParSeau(solo.slice(2, 3), soirees, [minuits[1]], fin - 1)
  assert.deepEqual([mardi.chiffres.joueurs, mardi.chiffres.modes, mardi.chiffres.parties], [seau.joueurs, seau.modes, seau.parties])
  assert.equal(mardi.chiffres.joueurs, 1 + 2 + 3 + 3, 'Bob, Ana et Cid, et six invités sans profil, chacun une fois par soirée')
  assert.deepEqual([mardi.chiffres.invites, lundi.chiffres.invites], [3 + 3, 0], 'trois sans profil le premier soir, les trois du second sans fiche de profils')
  assert.deepEqual([lundi.chiffres.nouveauxProfils, lundi.chiffres.achats, mardi.chiffres.achats], [1, 0, 2])
  assert.deepEqual([lundi.chiffres.profils, lundi.chiffres.semaine, lundi.chiffres.mois], [2, 2, 3])
  assert.deepEqual([mardi.chiffres.profils, mardi.chiffres.semaine, mardi.chiffres.mois], [3, 4, 5], 'Ana, Dan, Bob, Cid — et Zoé au mois')
  // Quand on joue : l'heure de Paris de chaque participation, et chaque invité d'une soirée à l'heure de sa soirée.
  assert.equal(lundi.chiffres.heures[9], 1)
  assert.equal(mardi.chiffres.heures[21], 1 + 5)
  assert.equal(mardi.chiffres.heures[22], 3)
  assert.equal(mardi.chiffres.v, VERSION_DE_LA_MEMOIRE)
})

test('les segments : chacun dans le premier qui lui va, les nouveaux d’abord, sans les suspendus', () => {
  const profil = (id: string, cree: number, suspendu = false): ProfilDeLAudience => ({ id, cree, suspendu, origine: null })
  const vieux = MAINTENANT - 60 * J
  const presences = new Map([
    feuille(AUJOURDHUI, 'reg', 'occ', 'neuf'),
    feuille(il_y_a(1), 'reg'),
    feuille(il_y_a(2), 'reg', 'sus'),
    feuille(il_y_a(7), 'risque'),
    feuille(il_y_a(13), 'risque2'),
    feuille(il_y_a(14), 'dort'),
    feuille(il_y_a(29), 'dort2'),
    // Hors des trente jours : perdu de vue.
    feuille(il_y_a(30), 'loin'),
  ])
  const profils = [
    profil('reg', vieux),
    profil('occ', vieux),
    profil('neuf', MAINTENANT - 6 * J),
    profil('jamais', MAINTENANT - 2 * H),
    profil('risque', vieux),
    profil('risque2', vieux),
    profil('dort', vieux),
    profil('dort2', vieux),
    profil('loin', vieux),
    profil('rien', vieux),
    profil('sus', vieux, true),
  ]
  const s = segmentsDesProfils(profils, tracesDesTrenteJours(presences, AUJOURDHUI), AUJOURDHUI)
  assert.deepEqual(
    Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map(m => m.id)])),
    {
      nouveaux: ['jamais', 'neuf'],
      reguliers: ['reg'],
      occasionnels: ['occ'],
      'a-risque': ['risque', 'risque2'],
      endormis: ['dort', 'dort2'],
      perdus: ['loin', 'rien'],
    },
  )
  assert.deepEqual(
    [s.reguliers[0].jours, s.reguliers[0].dernier, s.reguliers[0].modes],
    [3, AUJOURDHUI, ['jour']],
  )
  assert.equal(lireLeSegment(undefined), null)
  assert.equal(lireLeSegment('tous'), null)
  assert.equal(lireLeSegment('endormis'), 'endormis')
  assert.throws(() => lireLeSegment('dormeurs'), /Ce segment n’existe pas/)
})

test('les cohortes : chaque semaine d’inscription, et qui revient chacune des semaines suivantes — les semaines finies seulement', () => {
  // Mercredi 4 novembre : cette semaine part du lundi 2. La plus récente cohorte suivie est celle du 19 octobre, sa
  // semaine suivante — celle du 26 — finie ; la plus ancienne, celle du 31 août, aurait ses huit semaines derrière elle,
  // mais personne n'y est né. Celle du 7 septembre a les sept premières : la huitième est celle-ci.
  const profil = (id: string, jour: string): ProfilDeLAudience => ({ id, cree: a(jour, 12), suspendu: false, origine: null })
  const profils = [profil('a', '2026-09-07'), profil('b', '2026-09-13'), profil('c', '2026-10-19'), profil('d', '2026-10-26'), profil('e', '2026-11-03')]
  const presences = new Map([
    feuille('2026-09-15', 'a'), // une semaine après
    feuille('2026-10-27', 'a', 'c'), // sept semaines après pour a, une pour c
    feuille('2026-10-29', 'b'), // b : sept semaines après aussi
    feuille('2026-11-03', 'a', 'c', 'd'), // cette semaine : pas encore finie, rien ne se lit
  ])
  const cohortes = cohortesDesProfils(profils, presences, AUJOURDHUI)
  assert.deepEqual(
    cohortes.map(c => [c.semaine, c.taille, c.revenus]),
    [
      ['2026-09-07', 2, [1, 0, 0, 0, 0, 0, 2, null]],
      ['2026-10-19', 1, [1, null, null, null, null, null, null, null]],
    ],
    'les semaines sans inscrit ne se montrent pas ; d et e, inscrits ces deux dernières semaines, attendent la leur',
  )
})

test('qui joue à quoi, d’où viennent les profils, quand on joue', () => {
  const presences = new Map([
    [AUJOURDHUI, [{ jour: AUJOURDHUI, qui: 'ana', modes: BIT_DU_MODE.jour, premiere: 0 }]],
    [il_y_a(3), [
      { jour: il_y_a(3), qui: 'ana', modes: BIT_DU_MODE.campagne, premiere: 0 },
      { jour: il_y_a(3), qui: 'bob', modes: BIT_DU_MODE.jour, premiere: 0 },
      { jour: il_y_a(3), qui: 'cid', modes: BIT_DU_MODE.jour, premiere: 0 },
    ]],
  ])
  const combinaisons = combinaisonsDesModes(tracesDesTrenteJours(presences, AUJOURDHUI))
  assert.deepEqual(combinaisons, [
    { modes: ['jour'], profils: 2 },
    { modes: ['campagne', 'jour'], profils: 1 },
  ])
  assert.deepEqual(combinaisonsDesModes(tracesDesTrenteJours(presences, AUJOURDHUI), 1), [
    { modes: ['jour'], profils: 2 },
    { modes: [], profils: 1 },
  ])
  assert.equal(nomDeLaCombinaison(['jour']), 'Le quiz du jour seul')
  assert.equal(nomDeLaCombinaison(['campagne', 'jour']), 'La campagne et le quiz du jour')
  assert.equal(nomDeLaCombinaison(['soiree', 'campagne', 'duel']), 'Les soirées, la campagne et les duels')
  assert.equal(nomDeLaCombinaison(['soiree', 'campagne', 'cabinet', 'jour', 'duel']), 'Un peu de tout')
  assert.equal(nomDeLaCombinaison([]), 'Les autres combinaisons')

  const depuis = minuitDuJour(il_y_a(29))
  const p = (id: string, cree: number, origine: ProfilDeLAudience['origine']): ProfilDeLAudience => ({ id, cree, suspendu: false, origine })
  assert.deepEqual(
    originesDesProfils([p('a', MAINTENANT, null), p('b', MAINTENANT, 'entree'), p('c', MAINTENANT, 'entree'), p('d', MAINTENANT, 'jour'), p('e', depuis - 1, 'jour')], depuis),
    [
      { origine: 'entree', profils: 2 },
      { origine: 'jour', profils: 1 },
      { origine: null, profils: 1 },
    ],
    'les nés ces trente jours seulement, le plus fréquent d’abord, ceux d’avant l’origine en dernier',
  )
  assert.equal(lireLOrigine('entree'), 'entree')
  for (const faux of [undefined, null, 'admin', 42]) assert.equal(lireLOrigine(faux), 'inconnue')
  assert.equal(origineDeLAccueil('/jour', true), 'jour')
  assert.equal(origineDeLAccueil('/duels#defi-abc', false), 'duels')
  assert.equal(origineDeLAccueil('/campagne#sentiers', false), 'campagne')
  assert.equal(origineDeLAccueil('/cabinet', false), 'cabinet')
  assert.equal(origineDeLAccueil('/salon', false), 'salon')
  assert.equal(origineDeLAccueil('/compte', false), 'compte')
  assert.equal(origineDeLAccueil('', true), 'fin-de-soiree')
  assert.equal(origineDeLAccueil('', false), 'accueil')
  assert.equal(origineDeLAccueil('/jourx', false), 'accueil', 'une page qui commence comme une autre n’en est pas')

  // Les quatre dernières semaines finies, chaque jour à son jour de la semaine : aujourd'hui, entamé, n'y est pas.
  const heures = Array.from({ length: 24 }, (_, h) => (h === 21 ? 4 : 0))
  const jours = new Map<string, Pick<ChiffresDUnJour, 'heures'>>([
    [il_y_a(1), { heures }], // mardi
    [il_y_a(8), { heures }], // le mardi d'avant
    [AUJOURDHUI, { heures }],
    [il_y_a(29), { heures }], // hors des quatre semaines
  ])
  const { grille, jours: comptes } = heuresDeJeu(jours, AUJOURDHUI)
  assert.equal(comptes, 2)
  assert.equal(grille[1][21], 8, 'les deux mardis')
  assert.equal(grille.flat().reduce((t, n) => t + n, 0), 8)
})

test('la page : ce que la mémoire ne sait pas encore ne se compare pas, et la fidélité se lit au soir d’hier', () => {
  const vide = (profils: number, mois: number): ChiffresDUnJour => ({
    v: VERSION_DE_LA_MEMOIRE,
    joueurs: profils,
    modes: { soiree: 0, campagne: 0, cabinet: 0, jour: profils, duel: 0 },
    parties: { soiree: 0, campagne: 0, cabinet: 0, jour: profils, duel: 0 },
    nouveauxProfils: 0,
    achats: 0,
    profils,
    semaine: profils,
    mois,
    invites: 1,
    heures: Array.from({ length: 24 }, () => 0),
  })
  const jours = new Map(Array.from({ length: 7 }, (_, k) => [il_y_a(k + 1), vide(k + 1, 20)] as const))
  const page = dUneTraite(
    calculDeLaPage({
      maintenant: MAINTENANT,
      presences: new Map([feuille(AUJOURDHUI, 'ana', 'bob'), feuille(il_y_a(1), 'ana')]),
      jours,
      depuis: il_y_a(7),
      profils: [],
      invitesDuJour: 2,
    }),
  )
  assert.deepEqual(page.actifs.jour, { valeur: 2, avant: 0 }, 'un jour moyen des sept d’avant, à la même minute : 10 h, Ana seule hier — arrondi')
  assert.deepEqual([page.actifs.semaine.valeur, page.actifs.mois.valeur], [2, 2])
  assert.deepEqual([page.actifs.semaine.avant, page.actifs.mois.avant], [null, null], 'la mémoire ne remonte qu’à sept jours')
  // (1 + 2 + … + 7) / 7 = 4 joueurs par jour en moyenne, sur vingt au mois.
  assert.deepEqual(page.actifs.fidelite, { valeur: 20, avant: null })
  assert.deepEqual(page.invites, { valeur: 7 + 2, avant: null })
  assert.deepEqual(
    page.parJour.map(j => [j.jour, j.profils]),
    [...Array.from({ length: 7 }, (_, k) => [il_y_a(7 - k), 7 - k]), [AUJOURDHUI, 2]],
  )
})

test('la mémoire en tableur : un jour par ligne, le plus ancien d’abord, et ce qu’un jour ne sait pas reste vide', () => {
  const modes = (n: number) => ({ soiree: n, campagne: n + 1, cabinet: 0, jour: n + 2, duel: 0 })
  const dAvant: ChiffresDUnJour = { v: 1, joueurs: 7, modes: modes(1), parties: modes(2), nouveauxProfils: 1, achats: 0, profils: 5, semaine: 9, mois: 14, invites: 2, heures: [] }
  const complet = {
    ...dAvant,
    v: VERSION_DE_LA_MEMOIRE,
    soirees: [
      { espace: 'salon-a', invites: 6, profils: 2 },
      { espace: 'salon-a', invites: 3, profils: 1 },
      { espace: 'salon-b', invites: 4, profils: null },
    ],
    nouveauxSalons: ['salon-b'],
    naissances: { entree: 2, 'fin-de-soiree': 1, accueil: 4 },
    lendemain: 1,
    missions: { faites: 9, profils: 5, toutes: 2 },
    questions: { soiree: 120, campagne: 40, cabinet: 0, jour: 30, duel: 10 },
    confettis: { gagnes: { campagne: 300, jour: 50 }, depenses: { themes: 200 } },
    serveur: { heures: 17.25, versions: ['abc1234', 'def5678'] },
  } as unknown as ChiffresDUnJour
  const [tete, ...lignes] = lignesDeLaMemoire(new Map([[il_y_a(1), complet], [il_y_a(400), dAvant]]))
  const colonne = (nom: string) => {
    const i = tete.indexOf(nom)
    assert.ok(i >= 0, nom)
    return lignes.map(l => l[i])
  }
  assert.equal(tete.length, lignes[0].length)
  assert.deepEqual(colonne('Jour'), [il_y_a(400), il_y_a(1)])
  assert.deepEqual(colonne('Personnes'), [7, 7])
  assert.deepEqual(colonne('Passages d’invités'), [2, 2])
  // Une ligne d'avant la version 2 ne dit ni ses soirées, ni ses naissances, ni ses confettis, ni son serveur : vide, pas zéro.
  assert.deepEqual(colonne('Soirées'), ['', 3])
  assert.deepEqual(colonne('Salons qui ont joué'), ['', 2])
  assert.deepEqual(colonne('Nouveaux salons'), ['', 1])
  assert.deepEqual(colonne('Nés en soirée'), ['', 3])
  assert.deepEqual(colonne('Questions jouées · Soirées'), ['', 120])
  assert.deepEqual(colonne('Missions faites'), ['', 9])
  assert.deepEqual(colonne('Confettis gagnés'), ['', 350])
  assert.deepEqual(colonne('Confettis dépensés'), ['', 200])
  // Une heure à la virgule, que le tableur français lit comme un nombre ; les versions d'une ligne.
  assert.deepEqual(colonne('Heures éveillées du serveur'), ['', '17,3'])
  assert.deepEqual(colonne('Versions en ligne'), ['', 'abc1234 def5678'])
  assert.deepEqual(colonne('Joueurs · Campagne'), [2, 2])
  // Des comptes : ni un salon, ni un profil.
  assert.doesNotMatch(JSON.stringify(lignes), /salon-/)
})

test('un tableau du QG copié pour un tableur : des colonnes tabulées, un nombre français rendu nombre, une formule désamorcée', () => {
  // « Copier », sur chaque tableau du QG (`CopierLeTableau`) : ce que la page montre, collé en colonnes.
  assert.equal(
    texteTabule([
      ['Route', 'Appels', 'Écart', 'Réussite'],
      ['GET /api/jour', '12 345', '−3', '48 %'],
      ['=HYPERLINK("x")', '+12 %', '0,8', ' Léa\n(2) '],
    ]),
    "Route\tAppels\tÉcart\tRéussite\nGET /api/jour\t12345\t-3\t48 %\n'=HYPERLINK(\"x\")\t'+12 %\t0,8\tLéa (2)\n",
  )
  // Un nombre ne se désamorce pas ; une date, un rang, un texte restent ce qu'ils sont.
  assert.deepEqual(['-40', '1889', '3 sur 9', '1ʳᵉ place', '@lea'].map(celluleDeTableur), ['-40', '1889', '3 sur 9', '1ʳᵉ place', "'@lea"])
  // La même règle que le CSV téléchargé (`toCsv`) : une seule liste de ce qu'un tableur prend pour une formule.
  assert.ok(['=', '+', '-', '@'].every(c => FORMULE.test(`${c}1`)))
})

// ── Au banc : ce qui s'écrit, ce qui se relit ───────────────────────────────

/** Ce que la base permanente a servi pendant une mesure : chaque instruction, comme `qg-charge.test.ts`. */
const compte = { actif: false, instructions: [] as string[] }
const sqlDe = (s: unknown) => (typeof s === 'string' ? s : (s as { sql: string }).sql).replace(/\s+/g, ' ').trim()
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.instructions.push(...(methode === 'batch' ? (args[0] as unknown[]) : [args[0]]).map(sqlDe))
    return origine.apply(this, args)
  }
}
async function mesurer<T>(travail: () => Promise<T>): Promise<{ instructions: string[]; resultat: T }> {
  Object.assign(compte, { actif: true, instructions: [] })
  try {
    const resultat = await travail()
    return { instructions: [...compte.instructions], resultat }
  } finally {
    compte.actif = false
  }
}

const lire = async <T>(banc: Banc, cookie: string, chemin: string): Promise<T> => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
  const corps = (await r.json()) as T & { error?: string }
  assert.equal(r.status, 200, `${chemin} : ${r.status} ${corps.error ?? ''}`)
  return corps
}

/** Les plans des lectures d'une mesure : aucune ne parcourt une table de journal, ni celle des profils. */
function parcourues(banc: Banc, instructions: readonly string[]): string[] {
  const lecteur = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return instructions.filter(sql => {
      if (!/^SELECT\b/i.test(sql) || !/\b(jour_parties|campagne_series|profile_xp|profiles|soirees|qg_presences|qg_jours)\b/.test(sql)) return false
      const numerotes = [...sql.matchAll(/\?(\d+)/g)].map(m => Number(m[1]))
      const parametres = numerotes.length > 0 ? Math.max(...numerotes) : (sql.match(/\?/g) ?? []).length
      const plan = lecteur.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array<null>(parametres).fill(null)) as { detail: string }[]
      return plan.some(e => /^SCAN (jour_parties|campagne_series|profile_xp|profiles|soirees|qg_presences|qg_jours)\b(?! USING)/.test(e.detail))
    })
  } finally {
    lecteur.close()
  }
}

test('la mémoire s’écrit une fois par jour fini, aussi loin que les journaux remontent, se rattrape, se relit une fois — et la page la lit', async () => {
  const horloge = { t: MAINTENANT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const admin = await connexionAnimateur(banc.url)
    // L'origine que la page envoie, gardée ; sans elle, une page d'avant : « inconnue », jamais devinée.
    const inscrire = async (login: string, origine?: string) => {
      const res = await ecrire(banc.url, '/api/joueur/inscription', { login, password: 'motdepasse1', name: login, avatar: '🦊', ...(origine && { origine }) })
      assert.equal(res.status, 201)
    }
    await inscrire('lea', 'entree')
    await inscrire('bob')
    await inscrire('zoe', 'accueil')
    await inscrire('max', 'jour')
    await inscrireProfil(banc.url, 'sam', 'Sam')
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const ids = Object.fromEntries((db.prepare('SELECT login, id, origine FROM profiles').all() as { login: string; id: string; origine: string | null }[]).map(p => [p.login, p.id]))
    assert.deepEqual(
      (db.prepare("SELECT login, origine FROM profiles WHERE login IN ('lea', 'bob', 'zoe', 'max') ORDER BY login").all() as { login: string; origine: string }[]).map(p => [p.login, p.origine]),
      [
        ['bob', 'inconnue'],
        ['lea', 'entree'],
        ['max', 'jour'],
        ['zoe', 'accueil'],
      ],
    )
    // Léa joue depuis quarante jours ; Bob a joué il y a neuf jours ; Zoé il y a vingt ; Max est né avant-hier ; Sam,
    // inscrite il y a vingt jours, ne l'a jamais fait — et ne dit pas d'où elle vient : d'avant l'origine.
    const naissance = db.prepare('UPDATE profiles SET created_at = ?, origine = ? WHERE id = ?')
    naissance.run(MAINTENANT - 40 * J, 'entree', ids.lea)
    naissance.run(MAINTENANT - 25 * J, 'inconnue', ids.bob)
    naissance.run(MAINTENANT - 40 * J, 'accueil', ids.zoe)
    naissance.run(MAINTENANT - 2 * J, 'jour', ids.max)
    naissance.run(MAINTENANT - 20 * J, null, ids.sam)
    const partie = db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes) VALUES (?, ?, ?, 10, 6)')
    for (const k of [0, 1, 2, 3]) partie.run(ids.lea, il_y_a(k), a(il_y_a(k), k === 0 ? 9 : 18))
    const serie = db.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 3, 0, 0, ?, NULL, ?)")
    serie.run('s-bob', ids.bob, a(il_y_a(9), 20), 'duel')
    serie.run('s-zoe', ids.zoe, a(il_y_a(20), 15), 'cabinet')
    db.close()

    const { resultat: page } = await mesurer(() => lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs'))
    const memoire = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const jours = () => (memoire.prepare('SELECT jour, chiffres FROM qg_jours ORDER BY jour').all() as { jour: string; chiffres: string }[]).map(r => ({ jour: r.jour, ...(JSON.parse(r.chiffres) as ChiffresDUnJour) }))
    const presences = () => (memoire.prepare('SELECT jour, profile_id AS qui, modes FROM qg_presences ORDER BY jour, profile_id').all() as { jour: string; qui: string; modes: number }[])
    try {
      // Aussi loin que les journaux remontent — la naissance de Léa et de Zoé, il y a quarante jours —, jusqu'à hier : un jour par ligne.
      const ecrits = jours()
      assert.equal(ecrits.length, 40)
      assert.deepEqual([ecrits[0].jour, ecrits.at(-1)?.jour], [il_y_a(40), il_y_a(1)])
      assert.ok(ecrits.every(j => j.v === VERSION_DE_LA_MEMOIRE))
      assert.deepEqual(
        presences().map(p => [p.jour, p.qui === ids.lea ? 'lea' : p.qui === ids.bob ? 'bob' : 'zoe', p.modes]),
        [
          [il_y_a(20), 'zoe', BIT_DU_MODE.cabinet],
          [il_y_a(9), 'bob', BIT_DU_MODE.duel],
          [il_y_a(3), 'lea', BIT_DU_MODE.jour],
          [il_y_a(2), 'lea', BIT_DU_MODE.jour],
          [il_y_a(1), 'lea', BIT_DU_MODE.jour],
        ],
        'aujourd’hui ne s’écrit pas : il n’est pas fini',
      )
      assert.deepEqual([ecrits.at(-1)?.profils, ecrits.at(-1)?.semaine, ecrits.at(-1)?.mois], [1, 1, 3])
      assert.equal(ecrits.find(j => j.jour === il_y_a(40))?.nouveauxProfils, 2)

      // La page : Léa aujourd'hui, la semaine, le mois ; chacun son segment.
      assert.deepEqual([page.actifs.jour.valeur, page.actifs.semaine.valeur, page.actifs.mois.valeur], [1, 1, 3])
      assert.equal(page.depuis, il_y_a(40))
      const membres = Object.fromEntries(page.segments.map(s => [s.segment, s.montres.map(m => m.login)]))
      assert.deepEqual(membres, { nouveaux: ['max'], reguliers: ['lea'], occasionnels: [], 'a-risque': ['bob'], endormis: ['zoe'], perdus: ['sam'] })
      assert.deepEqual(
        page.origines.map(o => [o.origine, o.profils]),
        [
          ['inconnue', 1],
          ['jour', 1],
          [null, 1],
        ],
        'les nés ces trente jours — Bob, Max, Sam —, ceux d’avant l’origine en dernier',
      )
      // Les segments, comptés pour les annonces : les mêmes.
      const comptes = await lire<ComptesDesSegments>(banc, admin, '/api/admin/joueurs/segments')
      assert.deepEqual(comptes.comptes, { nouveaux: 1, reguliers: 1, occasionnels: 0, 'a-risque': 1, endormis: 1, perdus: 1 })

      // Rouverte le même jour : rien de fini ne se relit — ni la mémoire, ni les journaux d'hier, ni les profils d'avant
      // aujourd'hui ; aujourd'hui, par ses index.
      const { instructions, resultat: encore } = await mesurer(() => lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs'))
      assert.deepEqual(encore.actifs, page.actifs)
      assert.deepEqual(instructions.filter(sql => /\bqg_(presences|jours)\b/.test(sql)), [], 'les jours finis restent gardés')
      assert.deepEqual(instructions.filter(sql => /\bMIN\(/.test(sql)), [], 'rien à rattraper : la mémoire est à jour')
      assert.ok(instructions.some(sql => /FROM jour_parties WHERE jour >= \? AND jour <= \? AND commencee_le >= \?/.test(sql)), 'aujourd’hui se relit')
      assert.deepEqual(parcourues(banc, instructions), [], 'chaque lecture par un index')

      // Le lendemain : le jour d'hier s'écrit, et lui seul — Léa y a joué.
      horloge.t += J
      const { instructions: lendemain } = await mesurer(() => lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs'))
      assert.equal(jours().length, 41)
      assert.deepEqual(
        presences().filter(p => p.jour === AUJOURDHUI).map(p => p.qui),
        [ids.lea],
      )
      assert.deepEqual(parcourues(banc, lendemain), [], 'le rattrapage d’un jour par ses index aussi')

      // Un redémarrage ne réécrit rien : la mémoire dit jusqu'où elle va.
      await banc.redemarrer()
      const { instructions: auReveil } = await mesurer(() => lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs'))
      assert.deepEqual(auReveil.filter(sql => /INSERT OR REPLACE INTO qg_jours/.test(sql)), [])

      // Une version des dérivations d'avant : tout se refait des journaux, la même chose.
      const avant = jours()
      const ecriture = new Database(banc.quizDbUrl.replace(/^file:/, ''))
      ecriture.prepare("UPDATE qg_jours SET chiffres = json_set(chiffres, '$.v', 0)").run()
      ecriture.close()
      await banc.redemarrer()
      await lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs')
      assert.deepEqual(jours(), avant, 'refaite des journaux, à la version du jour')

      // Supprimé, un profil emporte sa feuille de présence — les chiffres des jours, sans un nom, restent.
      const supprime = await ecrire(banc.url, `/api/admin/profils/${ids.lea}`, undefined, admin, 'DELETE')
      assert.equal(supprime.status, 200)
      assert.equal(presences().filter(p => p.qui === ids.lea).length, 0)
      assert.equal(jours().length, 41)
      const sans = await lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs')
      assert.ok(!sans.segments.some(s => s.montres.some(m => m.login === 'lea')))
    } finally {
      memoire.close()
    }
  } finally {
    await banc.close()
  }
})

test('les joueurs se lisent à l’administrateur seul, et ne nomment que des profils', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    for (const chemin of ['/api/admin/joueurs', '/api/admin/joueurs/segments', '/api/admin/joueurs/memoire.csv']) {
      assert.equal((await fetch(`${banc.url}${chemin}`, { headers: { Cookie: lea } })).status, 401, chemin)
    }
    const admin = await connexionAnimateur(banc.url)
    const page = await lire<PageDesJoueurs>(banc, admin, '/api/admin/joueurs')
    // Une base où rien n'a encore eu lieu que des inscriptions d'aujourd'hui : rien à écrire, rien à comparer.
    assert.deepEqual([page.actifs.jour.valeur, page.cohortes, page.combinaisons], [0, [], []])
    assert.equal(page.segments.find(s => s.segment === 'nouveaux')?.montres[0]?.nom, 'Léa')
    // Rien d'une soirée : ni un titre, ni un prénom d'invité, ni un espace — des comptes, et les profils des segments.
    assert.doesNotMatch(JSON.stringify(page), /spaceId|titre|title|"salon"/)
    // « Télécharger la mémoire » : le tableur d'Excel en français, que le navigateur enregistre sous un nom daté, jamais
    // gardé en route ; ici, l'en-tête seul — aucun jour fini.
    const tableur = await fetch(`${banc.url}/api/admin/joueurs/memoire.csv`, { headers: { Cookie: admin } })
    assert.equal(tableur.status, 200)
    assert.match(tableur.headers.get('content-type') ?? '', /^text\/csv; charset=utf-8/)
    assert.match(tableur.headers.get('content-disposition') ?? '', /^attachment; filename="memoire-du-qg-\d{4}-\d{2}-\d{2}\.csv"$/)
    assert.equal(tableur.headers.get('cache-control'), 'no-store')
    // Le BOM d'abord, qu'Excel lit pour l'UTF-8 — `text()` le retire en décodant : il se lit dans les octets.
    const octets = new Uint8Array(await tableur.arrayBuffer())
    assert.deepEqual([...octets.slice(0, 3)], [0xef, 0xbb, 0xbf])
    const texte = new TextDecoder('utf-8', { ignoreBOM: true }).decode(octets)
    assert.ok(texte.startsWith('﻿Jour;Personnes;Profils actifs;'), texte.slice(0, 80))
    assert.equal(texte.trim().split('\r\n').length, 1, 'l’en-tête seul')
    assert.doesNotMatch(texte, /Léa|lea/)
  } finally {
    await banc.close()
  }
})

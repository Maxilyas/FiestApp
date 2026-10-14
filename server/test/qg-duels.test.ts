// Les duels au QG (`/admin#duels`, les choix du 13 octobre 2026) : les
// duels contre Automate et ceux classés entre joueurs jour par jour, les
// ligues et le classement tels que les joueurs les voient, les confettis de
// ligue de la semaine passée, les duels qui attendent leur adversaire — et
// « Annuler » un duel que l'adversaire n'a pas commencé : il ne compte pour
// personne, comme expiré.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'
import { DUREE_D_UN_DUEL_MS, VIES } from '../../shared/campagne'
import { COTE_DE_DEPART, LIGUES, ligueDe, recompenseDeLaSemaine, releverLesDuels } from '../../shared/duels'
import { JOURS_DU_QG, minuitsDeParis, type VueDEnsemble } from '../../shared/qg'
import { duelsDeLaVue, joueursParLigue, type SuiviDesDuels } from '../../shared/qgDuels'

ProfileStore.tirageEclat = () => false

/** Mardi 13 octobre 2026, 10 h à Paris (UTC+2) : la semaine passée est celle du lundi 5. */
const MARDI = Date.UTC(2026, 9, 13, 8, 0)
const MINUTE = 60_000
const JOUR = 24 * 60 * MINUTE
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des duels contre Automate déjà joués, écrits dans le journal : `n` fois `justes` contre `sesJustes`, finis à partir de `depuis`. */
function duelsJoues(banc: Banc, profileId: string, n: number, justes: number, sesJustes: number, depuis: number) {
  base(banc, db => {
    for (let i = 0; i < n; i++) {
      const adversaire = { serie: randomUUID(), profil: '', simule: true, reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
         VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
      ).run(randomUUID(), profileId, justes + VIES, justes, depuis + i * MINUTE, depuis + i * MINUTE + 30_000, JSON.stringify(adversaire))
    }
  })
}

/** Joue une tentative de duel jusqu'à sa troisième faute : `justes` bonnes réponses d'abord. */
async function jouer(banc: Banc, cookie: string, serie: string, justes: number): Promise<any> {
  const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as {
    bonne: number
    reponses: string[]
  }[]
  let derniere: any = null
  for (let i = 0; i < qs.length; i++) {
    const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix: i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    derniere = r.corps
    if (r.corps.finie) break
  }
  return derniere
}

/** Un duel classé lancé et joué par qui défie : il part à l'autre. Rend son code. */
async function lancer(banc: Banc, auteur: string, adversaire: string, justes: number): Promise<string> {
  const lance = await poster(banc, auteur, '/api/campagne/duel', { categories: ['Histoire'], adversaire })
  assert.equal(lance.status, 200, lance.corps.error)
  const fin = await jouer(banc, auteur, lance.corps.serie.id, justes)
  assert.equal(fin.finie, true)
  return lance.corps.code
}

const suiviDe = async (banc: Banc, admin: string) => {
  const r = await lire<SuiviDesDuels>(banc, admin, '/api/admin/duels/suivi')
  assert.equal(r.status, 200)
  return r.corps
}

test('les duels jour par jour, les ligues comptées dans l’ordre : des dérivations pures', () => {
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const aujourdhui = minuits.at(-1)!
  const vue = duelsDeLaVue(
    [
      { quand: aujourdhui + MINUTE, qui: 'lea', mode: 'rencontre' },
      { quand: aujourdhui + 2 * MINUTE, qui: 'lea', mode: 'rencontre' },
      { quand: aujourdhui + 3 * MINUTE, qui: 'tom', mode: 'duel' },
      { quand: aujourdhui + 4 * MINUTE, qui: 'tom', mode: 'serie' },
      { quand: minuits.at(-2)! + MINUTE, qui: 'cleo', mode: 'duel' },
      { quand: maintenant + MINUTE, qui: 'dan', mode: 'rencontre' },
    ],
    minuits,
    maintenant,
  )
  assert.deepEqual(
    vue.parJour.at(-1),
    { jour: vue.parJour.at(-1)!.jour, automate: 2, contre: 1 },
    'une série de la campagne n’est pas un duel ; un duel à venir ne compte pas encore',
  )
  assert.equal(vue.parJour.at(-2)!.contre, 1)
  assert.equal(vue.joueurs.aujourdhui, 2)
  assert.deepEqual(
    joueursParLigue(['or', 'bronze', 'or'], LIGUES.map(l => l.cle)),
    LIGUES.map(l => ({ cle: l.cle, joueurs: l.cle === 'or' ? 2 : l.cle === 'bronze' ? 1 : 0 })),
  )
})

test('le suivi des duels : les lancés, les ligues et le classement des joueurs, la semaine passée, les duels en attente', async () => {
  const horloge = { t: MARDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const admin = await connexionAnimateur(banc.url)
    const [lea, tom, hugo, ines] = await Promise.all([
      inscrireProfil(banc.url, 'lea', 'Léa', '🦊'),
      inscrireProfil(banc.url, 'tom', 'Tom', '🐻'),
      inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼'),
      inscrireProfil(banc.url, 'ines', 'Inès', '🦄'),
    ])
    const [deLea, deTom, deHugo, deInes] = ['lea', 'tom', 'hugo', 'ines'].map(l => idDe(banc, l))
    // La semaine passée : Tom gagne trois duels contre Automate, Hugo deux — la récompense en demande trois.
    duelsJoues(banc, deTom, 3, 12, 8, MARDI - 7 * JOUR)
    duelsJoues(banc, deHugo, 2, 4, 8, MARDI - 7 * JOUR)
    // Il y a deux mois, Inès : hors des quatre semaines du classement.
    duelsJoues(banc, deInes, 2, 12, 8, MARDI - 60 * JOUR)

    // Aujourd'hui : Léa défie Tom, et Hugo défie Léa ; Tom joue celui de Léa, Léa laisse celui de Hugo.
    const deLeaATom = await lancer(banc, lea, deTom, 5)
    horloge.t += MINUTE
    const deHugoALea = await lancer(banc, hugo, deLea, 3)
    horloge.t += MINUTE
    const releve = await poster(banc, tom, `/api/campagne/duel/${deLeaATom}`)
    assert.equal(releve.status, 200, releve.corps.error)
    await jouer(banc, tom, releve.corps.id, 6)

    const suivi = await suiviDe(banc, admin)
    assert.equal(suivi.jours.length, JOURS_DU_QG)
    assert.equal(suivi.lances.at(-1), 2)
    assert.equal(suivi.jouesDesDeuxCotes, 1)
    // Les ligues et le classement : ceux qui ont fini un duel classé ces quatre semaines — pas Inès.
    const cotes: Record<string, number> = Object.fromEntries(
      await Promise.all([
        ['lea', lea],
        ['tom', tom],
        ['hugo', hugo],
      ].map(async ([login, cookie]) => [login, (await lire(banc, cookie, '/api/duels')).corps.cote as number] as const)),
    )
    assert.equal(suivi.classement.joueurs, 3)
    assert.deepEqual(
      suivi.ligues.filter(l => l.joueurs > 0),
      LIGUES.flatMap(l => {
        const n = Object.values(cotes).filter(c => ligueDe(c).cle === l.cle).length
        return n > 0 ? [{ cle: l.cle, joueurs: n }] : []
      }),
    )
    const NOMS: Record<string, string> = { lea: 'Léa', tom: 'Tom', hugo: 'Hugo' }
    assert.deepEqual(
      suivi.classement.lignes.map(l => [l.nom, l.cote]),
      Object.keys(NOMS)
        .sort((a, b) => cotes[b] - cotes[a])
        .map(login => [NOMS[login], cotes[login]]),
      'le classement des joueurs, cote par cote',
    )
    // La semaine passée : Tom seul a joué ses trois duels, payé de sa meilleure ligue de la semaine.
    const semaineDeTom = releverLesDuels(
      Array.from({ length: 3 }, (_, i) => ({ serie: `s${i}`, justes: 12, sesJustes: 8, finiLe: MARDI - 7 * JOUR + i * MINUTE })),
      () => '2026-10-05',
    ).semaines.get('2026-10-05')
    assert.deepEqual(suivi.semainePassee, { semaine: '2026-10-05', payes: 1, confettis: recompenseDeLaSemaine(semaineDeTom) })
    assert.ok(suivi.semainePassee.confettis > 0)
    // En attente : celui de Hugo, que Léa n'a pas commencé ; celui de Léa est joué.
    assert.deepEqual(
      suivi.attente.duels.map(d => [d.code, d.auteur.nom, d.adversaire.nom, d.fermeLe - d.envoyeLe <= DUREE_D_UN_DUEL_MS]),
      [[deHugoALea, 'Hugo', 'Léa', true]],
    )
    assert.deepEqual([suivi.attente.total, suivi.attente.fermesSansReponse], [1, 0])
    assert.equal(typeof suivi.attente.plusAncien, 'number')

    // Masquée, Léa sort du classement et de ses ligues, comme pour les joueurs.
    assert.equal((await poster(banc, admin, '/api/admin/jour/masquer', { profileId: deLea, masque: true })).status, 200)
    const masquee = await suiviDe(banc, admin)
    assert.equal(masquee.classement.joueurs, 2)
    assert.ok(!masquee.classement.lignes.some(l => l.nom === 'Léa'))
    assert.equal(masquee.ligues.reduce((n, l) => n + l.joueurs, 0), 2)

    // La vue d'ensemble tient les duels du jour : quatre parties contre un joueur, aucune contre Automate.
    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    assert.deepEqual([vue.duels.parJour.at(-1)!.automate, vue.duels.parJour.at(-1)!.contre], [0, 3])
    assert.equal(vue.duels.joueurs.aujourdhui, 3)
  } finally {
    await banc.close()
  }
})

test('annuler un duel que l’adversaire n’a pas commencé : fermé tout de suite, il ne compte pour personne, et le geste se note', async () => {
  const horloge = { t: MARDI }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: BASE })
  try {
    const admin = await connexionAnimateur(banc.url)
    const [lea, tom, hugo] = await Promise.all([
      inscrireProfil(banc.url, 'lea', 'Léa', '🦊'),
      inscrireProfil(banc.url, 'tom', 'Tom', '🐻'),
      inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼'),
    ])
    const [deTom, deHugo] = [idDe(banc, 'tom'), idDe(banc, 'hugo')]
    const code = await lancer(banc, lea, deTom, 5)
    const autre = await lancer(banc, lea, deHugo, 4)
    horloge.t += MINUTE

    // Hugo commence le sien : il compte déjà, il ne s'annule plus.
    assert.equal((await poster(banc, hugo, `/api/campagne/duel/${autre}`)).status, 200)
    const commence = await poster(banc, admin, `/api/admin/duels/${autre}/annuler`)
    assert.equal(commence.status, 400)
    assert.equal(commence.corps.error, 'Ce duel est commencé des deux côtés : il compte déjà, il ne s’annule plus')
    assert.equal((await poster(banc, admin, '/api/admin/duels/ZZZZZZ/annuler')).corps.error, 'Ce duel classé n’existe pas')

    const annule = await poster(banc, admin, `/api/admin/duels/${code}/annuler`)
    assert.equal(annule.status, 200, annule.corps.error)
    assert.deepEqual(annule.corps, { ok: true, code })
    // Fermé : Tom ne peut plus le relever, et personne ne bouge — Léa n'a toujours aucun duel classé.
    assert.equal((await poster(banc, tom, `/api/campagne/duel/${code}`)).corps.error, 'Ce défi est fermé : son classement est figé')
    assert.equal((await lire(banc, lea, '/api/duels')).corps.cote, COTE_DE_DEPART)
    assert.equal((await lire(banc, tom, '/api/duels')).corps.cote, COTE_DE_DEPART)
    // Une seconde fois : déjà fermé.
    assert.equal((await poster(banc, admin, `/api/admin/duels/${code}/annuler`)).corps.error, 'Ce duel est déjà fermé')
    // Un redémarrage le relit fermé.
    await banc.redemarrer()
    assert.equal((await poster(banc, tom, `/api/campagne/duel/${code}`)).corps.error, 'Ce défi est fermé : son classement est figé')

    const suivi = await suiviDe(banc, admin)
    assert.deepEqual([suivi.attente.total, suivi.attente.fermesSansReponse], [0, 1])
    // Le journal : sa phrase, sous le profil qui l'avait lancé.
    const journal = (await lire(banc, admin, '/api/admin/gestes?sorte=duel')).corps
    assert.deepEqual(
      journal.gestes.map((g: { resume: string; cible: string | null }) => [g.resume, g.cible]),
      [['Duel classé annulé avant d’être joué : Léa (@lea) → Tom (@tom)', idDe(banc, 'lea')]],
    )
  } finally {
    await banc.close()
  }
})

test('la page des duels au QG : les chiffres du jour, les duels par jour, les ligues, le classement, l’attente', async () => {
  Object.assign(globalThis, { React })
  const { AujourdhuiDesDuels, DuelsParJour, LiguesAuQg, ClassementDesDuelsAuQg, DuelsEnAttente } = await import(
    new URL('../../client/src/components/QgDuels.tsx', import.meta.url).href
  )
  const { renderToStaticMarkup } = await import('react-dom/server')
  const maintenant = Date.UTC(2026, 9, 13, 19, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const vue = {
    aujourdhui: { duels: { aujourdhui: 38, habituel: 30, parJour: [] } },
    duels: duelsDeLaVue(
      minuits.flatMap((m, i) => [
        ...Array.from({ length: 20 + (i % 7) }, (_, k) => ({ quand: m + k * MINUTE, qui: `j${k}`, mode: 'rencontre' })),
        ...Array.from({ length: 9 }, (_, k) => ({ quand: m + k * MINUTE, qui: `j${k}`, mode: 'duel' })),
      ]),
      minuits,
      maintenant,
    ),
  }
  const suivi: SuiviDesDuels = {
    maintenant,
    jours: vue.duels.parJour.map(j => j.jour),
    lances: minuits.map((_, i) => 5 + (i % 4)),
    jouesDesDeuxCotes: 164,
    ligues: LIGUES.map((l, i) => ({ cle: l.cle, joueurs: [61, 54, 48, 29, 14, 8][i] })),
    semainePassee: { semaine: '2026-10-05', payes: 171, confettis: 4980 },
    classement: {
      joueurs: 214,
      lignes: [{ profileId: 'p1', nom: 'Nadia', avatar: '🦊', niveau: 12, cote: 1642, ligue: 'maitre', rang: 1, duels: 64 }],
    },
    attente: {
      duels: [{ code: 'ABCDEF', auteur: { id: 'a', nom: 'Léo', avatar: '🐼' }, adversaire: { id: 'b', nom: 'Maud', avatar: '🦉' }, envoyeLe: maintenant - 6 * JOUR, fermeLe: maintenant + JOUR }],
      total: 17,
      plusAncien: maintenant - 6 * JOUR,
      fermesSansReponse: 6,
    },
  }
  const html = renderToStaticMarkup(
    React.createElement(React.Fragment, null, [
      React.createElement(AujourdhuiDesDuels, { key: 1, vue, suivi }),
      React.createElement(DuelsParJour, { key: 2, vue, suivi }),
      React.createElement(LiguesAuQg, { key: 3, suivi }),
      React.createElement(ClassementDesDuelsAuQg, { key: 4, suivi, occupe: false, masquer: () => {} }),
      React.createElement(DuelsEnAttente, { key: 5, suivi, occupe: false, annuler: () => {} }),
    ]),
  ).replace(/[  ]/g, ' ')
  for (const attendu of [
    '21 contre Automate · 9 contre un joueur',
    'Contre Automate',
    'Classés, entre joueurs',
    '193 lancés, dont 164 joués des deux côtés',
    'Maîtres · 1500 et plus',
    '214 joueurs classés',
    '171 joueurs payés pour trois duels joués, 4980 confettis de ligue',
    'Nadia',
    'Maîtres · 64 duels',
    'Masquer',
    'parti il y a 6 j · expire dans 1 j',
    'Annuler',
    'Et 16 autres, qui expirent plus tard.',
    'le plus ancien : 6 j',
    'ces sept jours · ils ne comptent pas',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
})

// L'économie au QG (`/admin#economie`, les choix du 13 octobre 2026) : les
// confettis gagnés et dépensés jour par jour, source par source — les
// étoiles des sentiers et les ligues des duels, qui ne laissent aucune
// ligne, datées à l'épreuve et au lundi qui paient —, ceux qui circulent,
// relus une fois par jour et égaux aux soldes des profils, les meilleures
// ventes, les Éclats et les légendaires portés.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import React from 'react'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'
import { VIES, semaineAvant, semaineDe } from '../../shared/campagne'
import { COMPAGNONS, PRIX_D_UN_COMPAGNON } from '../../shared/compagnons'
import { recompenseDeLaSemaine, releverLesDuels } from '../../shared/duels'
import { jourDe } from '../../shared/jour'
import { gainVide, releveVide } from '../../shared/profil'
import { JOURS_DU_QG, minuitDe, minuitsDeParis } from '../../shared/qg'
import {
  circulationDes,
  eclatsEtLegendaires,
  etoilesDansLeTemps,
  fluxDeConfettis,
  liguesDansLeTemps,
  lundiQuiPaie,
  meilleuresVentes,
  sansMouvement,
  sommeDuJour,
  type PageDeLEconomie,
} from '../../shared/qgEconomie'
import { PRIX_D_UNE_VIE } from '../../shared/sentiers'
import { NOM_DE_RARETE, PRIX_DES_THEMES, THEMES } from '../../shared/themes'

ProfileStore.tirageEclat = () => false

const H = 3_600_000
const MINUTE = 60_000
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

test('les confettis jour par jour, les étoiles et les ligues datées, la circulation, les ventes : des dérivations pures', () => {
  // Mardi 13 octobre 2026, 19 h à Paris.
  const maintenant = Date.UTC(2026, 9, 13, 17, 0)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const aujourdhui = minuits.at(-1)!
  const hier = minuits.at(-2)!

  // Une somme du jour : aujourd'hui jusqu'à maintenant ; d'habitude, la même heure des sept jours d'avant.
  const somme = sommeDuJour(
    [
      { quand: aujourdhui + 9 * H, confettis: 30 },
      { quand: aujourdhui + 18 * H, confettis: 20 },
      { quand: hier + 10 * H, confettis: 40 },
      { quand: hier + 21 * H, confettis: 100 },
      { quand: maintenant + H, confettis: 999 },
    ],
    minuits,
    maintenant,
  )
  assert.equal(somme.aujourdhui, 50)
  assert.equal(somme.habituel, Math.round(40 / 7), 'hier à 21 h n’était pas encore là à 19 h ; les six autres jours comptent zéro')
  assert.deepEqual(somme.parJour.slice(-2), [140, 50])

  // Les flux d'une période : jour par jour, source par source, sorte par sorte.
  const m = sansMouvement()
  m.gagnes.campagne.push({ quand: aujourdhui + 9 * H, confettis: 12 }, { quand: hier + 9 * H, confettis: 8 })
  m.gagnes.ligues.push({ quand: hier, confettis: 30 })
  m.gagnes.dons.push({ quand: minuits[0] - H, confettis: 500 })
  m.achats.push(
    { quand: aujourdhui + 10 * H, sorte: 'themes', objets: 1, article: 'aurore', confettis: 400 },
    { quand: aujourdhui + 11 * H, sorte: 'vies', objets: 3, article: null, confettis: 3 * PRIX_D_UNE_VIE },
    { quand: hier + 11 * H, sorte: 'vies', objets: 2, article: null, confettis: 2 * PRIX_D_UNE_VIE },
    { quand: maintenant + H, sorte: 'compagnons', objets: 1, article: 'loup', confettis: PRIX_D_UN_COMPAGNON },
  )
  const f = fluxDeConfettis(m, minuits, maintenant)
  assert.deepEqual(f.jours.at(-1), { jour: jourDe(maintenant), gagnes: 12, depenses: 475 }, 'un achat à venir ne compte pas encore')
  assert.deepEqual(f.jours.at(-2), { jour: jourDe(hier + 12 * H), gagnes: 38, depenses: 50 })
  assert.deepEqual(
    f.sources,
    { campagne: 20, jour: 0, soirees: 0, ligues: 30, etoiles: 0, missions: 0, coffres: 0, dons: 0 },
    'un don d’avant les trente jours n’en est pas',
  )
  assert.deepEqual(f.depenses, {
    themes: { objets: 1, confettis: 400 },
    compagnons: { objets: 0, confettis: 0 },
    vies: { objets: 5, confettis: 5 * PRIX_D_UNE_VIE },
    sabliers: { objets: 0, confettis: 0 },
  })
  assert.deepEqual(f.aujourdhui.achatsParSorte, { themes: 1, compagnons: 0, vies: 1, sabliers: 0 })
  assert.deepEqual([f.aujourdhui.achats.aujourdhui, f.aujourdhui.gagnes.aujourdhui, f.aujourdhui.depenses.aujourdhui], [2, 12, 475])

  // Les étoiles d'un palier : la meilleure note paie, une meilleure ne paie que la différence, à l'épreuve qui l'atteint.
  const etoiles = etoilesDansLeTemps([
    { profil: 'a', branche: 'foret', palier: 3, justes: 16, seuil: 10, quand: 300 },
    { profil: 'a', branche: 'foret', palier: 3, justes: 10, seuil: 10, quand: 100 },
    { profil: 'a', branche: 'foret', palier: 3, justes: 13, seuil: 10, quand: 200 },
    { profil: 'a', branche: 'foret', palier: 3, justes: 12, seuil: 10, quand: 400 },
    { profil: 'b', branche: 'nulle-part', palier: 1, justes: 16, seuil: 10, quand: 100 },
    { profil: 'b', branche: 'foret', palier: 99, justes: 16, seuil: 10, quand: 100 },
    { profil: 'b', branche: 'stade', palier: 1, justes: 16, seuil: null, quand: 500 },
  ])
  assert.deepEqual(etoiles.mouvements, [
    { quand: 200, confettis: 10 },
    { quand: 300, confettis: 15 },
    { quand: 500, confettis: 25 },
  ])
  assert.deepEqual([...etoiles.parProfil], [
    ['a', 25],
    ['b', 25],
  ])

  // Les ligues : chaque semaine close qui a eu ses trois duels paie sa meilleure ligue, au lundi qui la clôt.
  const ligues = liguesDansLeTemps(
    [
      [
        'a',
        {
          semaines: new Map([
            ['2026-10-05', { duels: 3, meilleure: 1250 }],
            ['2026-10-12', { duels: 5, meilleure: 1400 }],
          ]),
        },
      ],
      [
        'b',
        {
          semaines: new Map([
            ['2026-10-05', { duels: 2, meilleure: 1600 }],
            ['2026-09-28', { duels: 4, meilleure: 900 }],
          ]),
        },
      ],
    ],
    '2026-10-12',
  )
  assert.deepEqual(ligues.mouvements, [
    { quand: lundiQuiPaie('2026-10-05'), confettis: 30 },
    { quand: lundiQuiPaie('2026-09-28'), confettis: 10 },
  ])
  assert.deepEqual([...ligues.parProfil], [
    ['a', 30],
    ['b', 10],
  ])
  assert.equal(lundiQuiPaie('2026-10-05'), Date.UTC(2026, 9, 11, 22), 'lundi 12 octobre, minuit à Paris')
  assert.equal(lundiQuiPaie('2026-10-19'), Date.UTC(2026, 9, 25, 23), 'lundi 26 octobre : l’heure d’hiver est passée la veille')

  // La circulation : la somme des soldes, négatifs compris, leurs tranches, la médiane de ceux qui jouent.
  const c = circulationDes(
    [
      { solde: -20, actif: false },
      { solde: 50, actif: true },
      { solde: 150, actif: true },
      { solde: 990, actif: true },
      { solde: PRIX_D_UN_COMPAGNON, actif: false },
      { solde: 2400, actif: true },
    ],
    123,
  )
  assert.deepEqual(
    { ...c, tranches: c.tranches.map(t => t.profils) },
    { le: 123, total: 3570 + PRIX_D_UN_COMPAGNON, profils: 6, actifs: 4, medianeDesActifs: (150 + 990) / 2, tranches: [2, 1, 1, 2], deQuoiUnCompagnon: 2 },
  )

  // Les meilleures ventes : les plus vendues ces trente jours d'abord, puis depuis toujours.
  const rare = THEMES.find(t => t.rarete === 'rare')!
  const commune = THEMES.find(t => t.rarete === 'commune')!
  const loup = COMPAGNONS.find(x => x.key === 'loup')!
  assert.deepEqual(
    meilleuresVentes([
      { sorte: 'theme', article: commune.key, ventes: 57, recentes: 11 },
      { sorte: 'compagnon', article: 'loup', ventes: 31, recentes: 12 },
      { sorte: 'theme', article: rare.key, ventes: 64, recentes: 12 },
      { sorte: 'theme', article: 'parti-du-catalogue', ventes: 3, recentes: 0 },
    ]).map(v => [v.nom, v.rarete, v.ventes, v.recentes]),
    [
      [rare.nom, NOM_DE_RARETE.rare, 64, 12],
      [loup.nom, 'Compagnon', 31, 12],
      [commune.nom, NOM_DE_RARETE.commune, 57, 11],
      ['parti-du-catalogue', '–', 3, 0],
    ],
  )

  // Les Éclats, par la ligne qui les a tirés ; les légendaires portés, les plus portés d'abord — rien d'autre qu'un légendaire.
  const el = eclatsEtLegendaires(
    [{ soiree: '#jour:2026-10-13' }, { soiree: '#jour:2026-10-12' }, { soiree: '#defi:2026-10-12' }, { soiree: '2026-10-10-abcd' }],
    new Map([
      ['lg:phenix', 2],
      ['lg:dragon', 5],
      ['lg:inconnu', 4],
    ]),
  )
  assert.deepEqual(el.eclats, { total: 4, jour: 2, soirees: 1, defi: 1 })
  assert.deepEqual(
    el.legendaires.plusPortes.map(x => [x.cle, x.porteurs]),
    [
      ['lg:dragon', 5],
      ['lg:phenix', 2],
    ],
  )
  assert.equal(el.legendaires.porteurs, 7)
})

test('l’économie sur un vrai serveur : chaque source et chaque achat à sa place, la circulation égale aux soldes des profils, gardée pour la journée', async () => {
  const banc = await demarrer({ baseDeLaCampagne: BASE })
  try {
    const admin = await connexionAnimateur(banc.url)
    const [lea, tom] = await Promise.all([inscrireProfil(banc.url, 'lea', 'Léa', '🦊'), inscrireProfil(banc.url, 'tom', 'Tom', '🐻')])
    const [deLea, deTom] = ['lea', 'tom'].map(l => idDe(banc, l))
    const maintenant = Date.now()
    const minuit = minuitDe(maintenant)
    const hier = minuitDe(minuit - 1) + 12 * H
    const avantHier = minuitDe(minuitDe(minuit - 1) - 1) + 12 * H
    // Aujourd'hui, une minute plus tôt — au pire minuit, si l'épreuve tourne juste après.
    const tantot = Math.max(minuit, maintenant - 5 * MINUTE)
    const passee = semaineAvant(semaineDe(jourDe(maintenant)))
    const [a, mo, j] = passee.split('-').map(Number)
    const mercrediPasse = Date.UTC(a, mo - 1, j + 2, 10)

    // Les dons, par la vraie route : 200 à Léa, de quoi s'offrir un thème ; 40 à Tom.
    assert.equal((await poster(banc, admin, `/api/admin/profils/${deLea}/confettis`, { confettis: 200 })).status, 200)
    assert.equal((await poster(banc, admin, `/api/admin/profils/${deTom}/confettis`, { confettis: 40, mot: 'Merci !' })).status, 200)
    // Un thème acheté par la vraie route : Léa, au prix de sa rareté.
    const theme = THEMES.find(t => t.rarete === 'commune' && !t.saison && !t.gagne)!
    const achat = await poster(banc, lea, '/api/joueur/themes', { theme: theme.key, porter: false })
    assert.equal(achat.status, 200, achat.corps.error)
    const cadeau = THEMES.find(t => t.rarete === 'rare' && !t.saison && !t.gagne)!

    base(banc, db => {
      const partie = db.prepare('INSERT INTO jour_parties (profile_id, jour, commencee_le, question, justes, finie_le) VALUES (?, ?, ?, 10, ?, ?)')
      partie.run(deLea, jourDe(hier), hier, 7, hier + 4 * MINUTE)
      partie.run(deTom, jourDe(tantot), tantot, 4, null)
      const serie = db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire) VALUES (?, ?, '[]', ?, 0, ?, ?, ?, ?, ?)`,
      )
      const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
      /** Une série et ses réponses, une par minute : `justes` bonnes, puis ses trois fautes. */
      const jouer = (profil: string, quand: number, justes: number, mode = 'serie', adversaire: string | null = null) => {
        const id = randomUUID()
        serie.run(id, profil, justes + VIES, justes, quand, quand + (justes + VIES) * MINUTE, mode, adversaire)
        for (let i = 0; i < justes + VIES; i++) reponse.run(id, i, `q${i}`, i < justes ? 1 : 0, quand + i * MINUTE)
      }
      jouer(deLea, hier, 5)
      jouer(deTom, tantot, 3)
      // Trois duels contre Automate la semaine passée, gagnés 12 à 8 : sa ligue paie lundi.
      for (let i = 0; i < 3; i++) {
        jouer(deTom, mercrediPasse + i * H, 12, 'rencontre', JSON.stringify({ serie: randomUUID(), profil: '', simule: true, reponses: [...Array(8).fill(true), ...Array(VIES).fill(false)] }))
      }
      // Une épreuve de sentier validée à 13 sur 16 avant-hier : deux étoiles, dix confettis.
      db.prepare(
        `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, branche, palier, seuil, rejeu, issue)
         VALUES (?, ?, '[]', 16, 0, 13, ?, ?, 'sentier', 'foret', 1, 10, 0, 'validee')`,
      ).run(randomUUID(), deLea, avantHier, avantHier + 10 * MINUTE)
      // Une soirée hier soir : six bonnes réponses et une estimation proche, sept confettis — et la ligne à part du quiz du jour, qui n'en est pas une.
      const detail = (justes: number) => JSON.stringify({ v: 3, gain: { ...gainVide(), reponses: 8 }, releve: { ...releveVide(), justes, estimationsProches: 1 } })
      const ligne = db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 50, ?, ?)')
      ligne.run(deLea, `${jourDe(hier)}-soiree`, 'banc', detail(6), hier + 9 * H)
      ligne.run(deLea, '#jour', 'banc', detail(50), hier + 9 * H)
      // Les achats d'avant : un compagnon avant-hier, deux vies hier, un sablier tantôt.
      db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, ?, 0, ?)').run(deLea, 'loup', PRIX_D_UN_COMPAGNON, avantHier)
      db.prepare('INSERT INTO profile_vies (id, profile_id, nombre, prix, created_at) VALUES (?, ?, 2, ?, ?)').run(randomUUID(), deTom, 2 * PRIX_D_UNE_VIE, hier)
      db.prepare('INSERT INTO profile_sabliers (id, profile_id, prix, created_at) VALUES (?, ?, 50, ?)').run(randomUUID(), deTom, tantot)
      // Deux Éclats : un au quiz du jour d'hier, un en soirée.
      const eclat = db.prepare('INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, ?, ?, ?)')
      eclat.run(deLea, '🦊', `#jour:${jourDe(hier)}`, hier)
      eclat.run(deTom, '🐻', `${jourDe(hier)}-soiree`, hier + H)
      // Les trois missions d'hier de Léa, et leur bonus : soixante confettis ; le coffre d'argent de Tom, ouvert tantôt : quatre-vingt-dix.
      const mission = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le, faite_le) VALUES (?, ?, ?, ?, ?, ?)')
      for (let rang = 0; rang <= 3; rang++) mission.run(deLea, jourDe(hier), rang, rang < 3 ? JSON.stringify({ sorte: 'duel', cible: 1 }) : '{}', hier, hier + 2 * H)
      const coffre = db.prepare('INSERT INTO profile_coffres (profile_id, semaine, tampons, rang, rarete, objet, confettis, ouvert_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      coffre.run(deTom, passee, 3, 'argent', 'commune', 'confettis', 90, tantot)
      // Un thème tiré d'un coffre s'écrit à prix nul : ni une dépense, ni une vente.
      coffre.run(deLea, semaineAvant(passee), 1, 'bois', 'rare', `theme:${cadeau.key}`, 0, avantHier)
      db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, ?)').run(deLea, cadeau.key, avantHier)
      // Léa porte le Phénix, qu'elle a gagné ; Tom porte le Dragon, qu'il n'a pas : il ne compte pas.
      db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:phenix', 'une-soiree', 'banc', '🔥', 'Phénix', ?)`).run(deLea, avantHier)
      db.prepare(`UPDATE profiles SET legendaire = 'lg:phenix' WHERE id = ?`).run(deLea)
      db.prepare(`UPDATE profiles SET legendaire = 'lg:dragon' WHERE id = ?`).run(deTom)
    })
    // Relus de la base : ce qu'un serveur en marche gardait en mémoire de Léa et de Tom.
    await banc.redemarrer()

    const page = (await lire<PageDeLEconomie>(banc, admin, '/api/admin/economie')).corps
    const semaineDeTom = releverLesDuels(
      Array.from({ length: 3 }, (_, i) => ({ serie: `s${i}`, justes: 12, sesJustes: 8, finiLe: mercrediPasse + i * H + (12 + VIES) * MINUTE })),
      instant => semaineDe(jourDe(instant)),
    ).semaines.get(passee)
    const ligues = recompenseDeLaSemaine(semaineDeTom)
    assert.ok(ligues > 0)
    assert.deepEqual(page.sources, { campagne: 5 + 3 + 36, jour: 11, soirees: 7, ligues, etoiles: 10, missions: 60, coffres: 90, dons: 240 })
    assert.deepEqual(page.depenses, {
      themes: { objets: 1, confettis: PRIX_DES_THEMES.commune },
      compagnons: { objets: 1, confettis: PRIX_D_UN_COMPAGNON },
      vies: { objets: 2, confettis: 2 * PRIX_D_UNE_VIE },
      sabliers: { objets: 1, confettis: 50 },
    })
    const gagnes = Object.values(page.sources).reduce((n, x) => n + x, 0)
    assert.equal(
      page.jours.reduce((n, x) => n + x.gagnes, 0),
      gagnes,
    )
    assert.equal(page.jours.at(-1)!.jour, jourDe(maintenant))
    assert.equal(page.aujourdhui.gagnes.aujourdhui, 3 + 4 + 240 + 90 + (lundiQuiPaie(passee) >= minuit ? ligues : 0))
    assert.equal(page.aujourdhui.depenses.aujourdhui, PRIX_DES_THEMES.commune + 50)
    assert.deepEqual(page.aujourdhui.achatsParSorte, { themes: 1, compagnons: 0, vies: 0, sabliers: 1 })

    // La circulation : la somme des soldes que la fiche de chaque profil donne, au confetti près.
    const ids = base(banc, db => (db.prepare('SELECT id FROM profiles').all() as { id: string }[]).map(r => r.id))
    let soldes = 0
    for (const id of ids) soldes += (await lire(banc, admin, `/api/admin/profils/${id}`)).corps.confettis.solde
    const c = page.circulation!
    assert.equal(c.total, soldes)
    assert.equal(c.profils, ids.length)
    assert.equal(c.actifs, 2, 'Léa et Tom ont joué ces trente jours')
    assert.equal(c.tranches.reduce((n, t) => n + t.profils, 0), ids.length)
    // Les ventes : le thème et le compagnon, chacun une fois, ces trente jours.
    assert.deepEqual(
      page.ventes.map(v => [v.article, v.ventes, v.recentes]).sort(),
      [
        ['loup', 1, 1],
        [theme.key, 1, 1],
      ].sort(),
    )
    assert.deepEqual(page.eclats, { total: 2, jour: 1, soirees: 1, defi: 0 })
    assert.deepEqual(page.legendaires, { porteurs: 1, plusPortes: [{ cle: 'lg:phenix', nom: 'Le Phénix', porteurs: 1 }] })

    // Écrits après la lecture : un sablier d'hier, une vie d'aujourd'hui, un don. Les jours
    // finis sont gardés jusqu'à minuit, la circulation pour la journée ; aujourd'hui se relit.
    base(banc, db => {
      db.prepare('INSERT INTO profile_sabliers (id, profile_id, prix, created_at) VALUES (?, ?, 50, ?)').run(randomUUID(), deTom, hier + H)
      db.prepare('INSERT INTO profile_vies (id, profile_id, nombre, prix, created_at) VALUES (?, ?, 1, ?, ?)').run(randomUUID(), deTom, PRIX_D_UNE_VIE, tantot)
    })
    const encore = (await lire<PageDeLEconomie>(banc, admin, '/api/admin/economie')).corps
    assert.deepEqual([encore.depenses.sabliers.objets, encore.depenses.vies.objets], [1, 3], 'hier gardé tel quel, aujourd’hui relu')
    assert.deepEqual(encore.circulation, page.circulation, 'les soldes, relus une fois par jour')
    // Un redémarrage relit tout : le sablier d'hier y est, et les soldes ont bougé.
    await banc.redemarrer()
    const relue = (await lire<PageDeLEconomie>(banc, admin, '/api/admin/economie')).corps
    assert.equal(relue.depenses.sabliers.objets, 2)
    assert.equal(relue.circulation!.total, page.circulation!.total - 50 - PRIX_D_UNE_VIE)
  } finally {
    await banc.close()
  }
})

test('la page de l’économie au QG : les chiffres du jour, gagnés et dépensés, d’où ils viennent, la circulation, les ventes, les Éclats', async () => {
  Object.assign(globalThis, { React })
  const { AujourdhuiDeLEconomie, GagnesEtDepenses, SourcesDesConfettis, DepensesDesConfettis, EnCirculation, MeilleuresVentes, EclatsEtLegendairesAuQg } = await import(
    new URL('../../client/src/components/QgEconomie.tsx', import.meta.url).href
  )
  const { renderToStaticMarkup } = await import('react-dom/server')
  const maintenant = Date.UTC(2026, 9, 13, 17, 4)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const m = sansMouvement()
  minuits.forEach((minuit, i) => {
    m.gagnes.campagne.push({ quand: minuit + 9 * H, confettis: 3000 + 10 * i })
    m.gagnes.jour.push({ quand: minuit + 8 * H, confettis: 2300 })
    m.achats.push({ quand: minuit + 10 * H, sorte: 'themes', objets: 1, article: 'aurore', confettis: 400 })
  })
  m.achats.push({ quand: minuits.at(-1)! + 11 * H, sorte: 'compagnons', objets: 1, article: 'loup', confettis: PRIX_D_UN_COMPAGNON })
  const page: PageDeLEconomie = {
    maintenant,
    ...fluxDeConfettis(m, minuits, maintenant),
    circulation: { ...circulationDes([{ solde: 96, actif: true }, { solde: 1200, actif: true }, { solde: 40, actif: false }], maintenant), total: 412_300, profils: 1380 },
    ventes: meilleuresVentes([{ sorte: 'compagnon', article: 'loup', ventes: 31, recentes: 12 }]),
    ...eclatsEtLegendaires([{ soiree: '#jour:2026-10-12' }, { soiree: '#defi:2026-10-12' }], new Map([['lg:phenix', 3]])),
  }
  const html = renderToStaticMarkup(
    React.createElement(React.Fragment, null, [
      React.createElement(AujourdhuiDeLEconomie, { key: 1, page }),
      React.createElement(GagnesEtDepenses, { key: 2, page }),
      React.createElement(SourcesDesConfettis, { key: 3, page }),
      React.createElement(DepensesDesConfettis, { key: 4, page }),
      React.createElement(EnCirculation, { key: 5, page }),
      React.createElement(MeilleuresVentes, { key: 6, page }),
      React.createElement(EclatsEtLegendairesAuQg, { key: 7, page }),
    ]),
  ).replace(/[\u00a0\u202f]/g, ' ')
  for (const attendu of [
    '1 thème · 1 compagnon',
    // Aujourd'hui : 3290 et 2300 gagnés, 400 et un compagnon dépensés.
    `+ ${3290 + 2300 - 400 - PRIX_D_UN_COMPAGNON} aujourd’hui`,
    'Gagnés et dépensés, jour par jour',
    'Les confettis gagnés, jour par jour',
    'Campagne',
    'Tes dons',
    'Thèmes · 30',
    'Compagnons · 1',
    'relu à 19 h 04, une fois par jour',
    '412 300',
    'chez 1380 profils',
    'des 2 profils qui ont joué ces trente jours',
    `profils à ${PRIX_D_UN_COMPAGNON} confettis et plus`,
    'Moins de 100',
    `${PRIX_D_UN_COMPAGNON} et plus`,
    'Le Loup',
    'Compagnon',
    'trente jours · 1 au quiz du jour, 0 en soirée, 1 au défi',
    'profils · le plus porté : Le Phénix',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
  // Un solde peut passer sous zéro : le signe moins, pas le trait d'union.
  const sousZero = renderToStaticMarkup(React.createElement(EnCirculation, { page: { ...page, circulation: { ...page.circulation!, total: -1200, medianeDesActifs: -35 } } }))
  assert.ok(sousZero.includes('−1200') && sousZero.includes('−35'), 'le signe moins')
  assert.ok(!sousZero.includes('-1200'))
})

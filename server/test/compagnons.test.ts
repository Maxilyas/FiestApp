// Les compagnons de la boutique (le choix du 13 octobre 2026) : achetés
// 1000 confettis à leur première forme, ils grandissent avec les bonnes
// réponses données avec eux — celles qui rapportent un confetti, en soirée,
// au quiz du jour, en campagne —, à 100, 300 et 500. Une forme atteinte ne
// se perd jamais, l'on peut porter une forme d'avant, et qui portait sa plus
// haute porte la nouvelle. Celui qui grandit est celui de sa niche, qu'il le
// porte ou non (le 18 octobre 2026) : `niche.test.ts` ; l'adoption l'y
// installe sans le faire porter (le 19 octobre 2026) : `ma-niche.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  baseDEssai,
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
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import {
  COMPAGNONS,
  COMPAGNONS_DE_LA_BOUTIQUE,
  FORMES_DES_COMPAGNONS,
  JUSTES_DES_FORMES,
  METAMORPHOSES,
  MONTREE_DE_LA_METAMORPHOSE,
  PRIX_D_UN_COMPAGNON,
  compagnon,
  formeDansLaNiche,
  formeDeCompagnon,
  formesOuvertes,
  metamorphoseOuverte,
  nomDeLaForme,
  prochaineForme,
  rangAtteint,
  type CleDeCompagnon,
} from '../../shared/compagnons'
import { brilleChez } from '../../shared/profil'
import { cibleEclat } from '../../shared/legendaires'
import { ceQuIlAPorter, cibleDeLEclat, lignesDeLEssai } from '../../shared/loge'
import { CATEGORIES } from '../../shared/categories'
import React from 'react'
import { annonceDuChoix } from '../../client/src/components/choix'

ProfileStore.tirageEclat = () => false

// ── Le catalogue, pur ─────────────────────────────────────────────────────

test('quatre compagnons — trois en boutique, la luciole en expédition —, quatre formes chacun, la rareté qui monte avec eux', () => {
  assert.deepEqual(
    COMPAGNONS.map(c => c.key),
    ['loup', 'chat', 'tortue', 'luciole'],
  )
  // La luciole ne se vend pas (le 20 octobre 2026) : la boutique, le coffre et « À la une » ne lisent que les trois.
  assert.deepEqual(
    COMPAGNONS_DE_LA_BOUTIQUE.map(c => c.key),
    ['loup', 'chat', 'tortue'],
  )
  assert.equal(compagnon('luciole')!.gagne, 'expedition')
  assert.equal(FORMES_DES_COMPAGNONS.length, 16)
  assert.equal(new Set(FORMES_DES_COMPAGNONS.map(f => f.key)).size, 16, 'une clé par forme')
  for (const c of COMPAGNONS) {
    assert.deepEqual(
      c.formes.map(f => f.rarete),
      ['commune', 'rare', 'epique', 'legendaire'],
      `${c.nom} : commune, rare, épique, légendaire`,
    )
    assert.deepEqual(
      c.formes.map(f => f.rang),
      [0, 1, 2, 3],
    )
    for (const f of c.formes) {
      assert.match(f.key, new RegExp(`^cp:${c.key}-[a-z]+$`))
      assert.equal(formeDeCompagnon(f.key), f)
    }
  }
  assert.equal(formeDeCompagnon('lg:phenix'), undefined)
  assert.equal(formeDeCompagnon('cp:loup'), undefined, 'le compagnon n’est pas une forme')
  assert.equal(PRIX_D_UN_COMPAGNON, 1000)
  assert.deepEqual([...JUSTES_DES_FORMES], [0, 100, 300, 500])
})

test('chacun a sa métamorphose de lumière : une forme de plus, légendaire, qui ne se gagne pas en grandissant', () => {
  // Peintes le 13 octobre 2026, livrées le 19 : l'Éclat les ouvre, et elles ne
  // remplacent rien (le propriétaire : « je veux que ce soit un choix ») ; la
  // luciole-aurore, peinte et livrée le 20.
  assert.deepEqual(
    METAMORPHOSES.map(f => f.key),
    ['cp:loup-tempete', 'cp:chat-soleil', 'cp:tortue-fleurs', 'cp:luciole-aurore'],
  )
  assert.deepEqual(
    COMPAGNONS.map(c => c.lumiere?.nom),
    ['Le loup-tempête', 'Le chat-soleil', 'L’île en fleurs', 'La luciole-aurore'],
  )
  // La luciole, qui ne s'achète pas, s'ouvre la sienne comme les autres : sa forme ultime et l'Éclat.
  assert.equal(metamorphoseOuverte({ compagnon: 'luciole', rang: 3, eclat: true }), true)
  assert.equal(metamorphoseOuverte({ compagnon: 'luciole', rang: 2, eclat: true }), false)
  assert.deepEqual(formesOuvertes([{ compagnon: 'luciole', rang: 3, eclat: true }]), [...compagnon('luciole')!.formes.map(f => f.key), 'cp:luciole-aurore'])
  assert.equal(formeDansLaNiche({ compagnon: 'luciole', rang: 3, eclat: true, montree: MONTREE_DE_LA_METAMORPHOSE })?.key, 'cp:luciole-aurore')
  assert.equal(formeDansLaNiche({ compagnon: 'luciole', rang: 3, montree: MONTREE_DE_LA_METAMORPHOSE })?.key, 'cp:luciole-constellation', 'sans l’Éclat, sa forme ultime')
  // Un compagnon sans elle n'en promet aucune : rien ne s'ouvre pour ce que le catalogue ne connaît pas.
  assert.equal(metamorphoseOuverte({ compagnon: 'inconnu' as CleDeCompagnon, rang: 3, eclat: true }), false)
  for (const c of COMPAGNONS) {
    const m = c.lumiere!
    assert.equal(formeDeCompagnon(m.key), m)
    assert.deepEqual([m.compagnon, m.rang, m.rarete, m.metamorphose], [c.key, 3, 'legendaire', true], m.key)
    assert.ok(!FORMES_DES_COMPAGNONS.includes(m), `${m.key} : pas une forme où il grandit`)
    assert.equal(nomDeLaForme(m), 'Métamorphose')
    assert.equal(nomDeLaForme(c.formes[3]), 'Forme ultime')
  }
  assert.equal(prochaineForme({ compagnon: 'loup', rang: 3, justes: 900, eclat: true }), null, 'sa forme ultime n’a toujours pas de suite')
  // Elle s'ouvre à sa forme ultime, l'Éclat sur lui — tombé avant ou après.
  assert.deepEqual(
    [{ compagnon: 'loup' as const, rang: 3, eclat: true as const }, { compagnon: 'loup' as const, rang: 2, eclat: true as const }, { compagnon: 'loup' as const, rang: 3 }].map(
      metamorphoseOuverte,
    ),
    [true, false, false],
  )
  assert.deepEqual(
    formesOuvertes([
      { compagnon: 'loup', rang: 3, eclat: true },
      { compagnon: 'chat', rang: 3 },
      { compagnon: 'tortue', rang: 2, eclat: true },
    ]),
    [
      ...COMPAGNONS[0].formes.map(f => f.key),
      'cp:loup-tempete',
      ...COMPAGNONS[1].formes.map(f => f.key),
      'cp:tortue-bebe',
      'cp:tortue-jeune',
      'cp:tortue-adulte',
    ],
  )
  // Sa niche la montre au rang de plus (4), et seulement ouverte.
  assert.equal(MONTREE_DE_LA_METAMORPHOSE, 4)
})

test('il grandit à 100, 300 et 500 bonnes réponses ; ce qui reste se compte', () => {
  assert.deepEqual(
    [0, 99, 100, 299, 300, 499, 500, 4000].map(rangAtteint),
    [0, 0, 1, 1, 2, 2, 3, 3],
  )
  assert.deepEqual(prochaineForme({ compagnon: 'loup', rang: 0, justes: 62 }), { forme: formeDeCompagnon('cp:loup-jeune'), encore: 38 })
  assert.deepEqual(prochaineForme({ compagnon: 'chat', rang: 2, justes: 420 }), { forme: formeDeCompagnon('cp:chat-esprit'), encore: 80 })
  assert.equal(prochaineForme({ compagnon: 'tortue', rang: 3, justes: 900 }), null, 'la forme ultime n’a pas de suite')
  assert.deepEqual(
    formesOuvertes([
      { compagnon: 'loup', rang: 1 },
      { compagnon: 'tortue', rang: 0 },
    ]),
    ['cp:loup-louveteau', 'cp:loup-jeune', 'cp:tortue-bebe'],
  )
})

test('l’Éclat tombe sur le compagnon qu’il porte, et le suit sous toutes ses formes', () => {
  assert.equal(cibleEclat('cp:loup-jeune', '🦊'), 'cp:loup-jeune')
  const profil = { eclats: ['cp:loup-louveteau'] }
  assert.equal(brilleChez(profil, 'cp:loup-louveteau'), true)
  assert.equal(brilleChez(profil, 'cp:loup-ultime'), true, 'le louveteau éclaté a grandi : il brille encore')
  assert.equal(brilleChez(profil, 'cp:chat-chaton'), false, 'un autre compagnon ne brille pas pour lui')
  assert.equal(brilleChez({ ...profil, eclatsEteints: ['cp:loup-louveteau'] }, 'cp:loup-adulte'), false, 'éteint, il est éteint partout')
  // Sa métamorphose aussi : ses paillettes la suivent, et le tirage d'après tombe dans le vide (`cibleEclatDe`).
  assert.equal(brilleChez(profil, 'cp:loup-tempete'), true)
  // Son Éclat n'a pas de version à choisir : la loge ne propose rien sous lui — sa métamorphose est une case de plus.
  assert.equal(cibleDeLEclat({ avatar: '🦊', legendaire: 'cp:loup-jeune' }), null)
  assert.equal(cibleDeLEclat({ avatar: '🦊', legendaire: 'cp:loup-tempete' }), null)
})

test('la loge le dit : « Compagnon · Le Loup » à l’essai, « Tu portes le jeune loup » à l’oreille, et chaque forme atteinte est du nouveau', () => {
  assert.deepEqual(lignesDeLEssai({ legendaire: 'cp:loup-jeune' }, { niveau: 3 }), [{ piece: 'avatar', nom: 'Le jeune loup', detail: 'Compagnon · Le Loup' }])
  assert.equal(annonceDuChoix({ legendaire: 'cp:tortue-ile' }), 'Tu portes la tortue-île.')
  const profil = {
    hautsFaits: [],
    vitrine: [],
    legendaires: [],
    divins: [],
    niveau: 1,
    ouvertes: ['mat'],
    eclats: [],
    sentiers: {},
    compagnons: [{ compagnon: 'loup', rang: 1 }],
  }
  const avatars = ceQuIlAPorter(profil as any).avatar
  assert.ok(avatars.includes('cp:loup-louveteau') && avatars.includes('cp:loup-jeune'), 'ses deux formes')
  assert.ok(!avatars.includes('cp:loup-adulte'), 'pas celle qu’il n’a pas atteinte')
  // Sa métamorphose ouverte est du nouveau, comme une forme : la loge la marque, la barre du menu la compte.
  const ultime = (eclat?: true) => ceQuIlAPorter({ ...profil, compagnons: [{ compagnon: 'loup', rang: 3, ...(eclat && { eclat }) }] } as any).avatar
  assert.ok(ultime(true).includes('cp:loup-tempete'))
  assert.ok(!ultime().includes('cp:loup-tempete'), 'pas sans l’Éclat')
  assert.deepEqual(lignesDeLEssai({ legendaire: 'cp:loup-tempete' }, { niveau: 3 }), [{ piece: 'avatar', nom: 'Le loup-tempête', detail: 'Compagnon · Le Loup' }])
  assert.equal(annonceDuChoix({ legendaire: 'cp:tortue-fleurs' }), 'Tu portes l’île en fleurs.')
})
/** Le rayon des compagnons, rendu pour ce profil. */
async function rayon(profil: object): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(new URL('../../client/src/components/RayonDesCompagnons.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.RayonDesCompagnons, { profil, busy: false, acheter: async () => null }))
}

test('la boutique : trois compagnons, leurs quatre formes et ce qu’elles demandent — le prix, ou où il en est', async () => {
  const boutique = (solde: number, compagnons?: object[]) => ({ confettis: { gagnes: solde, depenses: 0, solde }, possedes: [], porte: null, jour: '2026-10-13', compagnons })
  const neuf = await rayon({ legendaire: null, boutique: boutique(1200) })
  // Une vitrine : une scène par compagnon (le souhait du propriétaire du 14 octobre 2026 : « les
  // mettre vraiment en avant, super mignon et avoir envie de les acheter »), qu'on caresse.
  assert.equal(neuf.match(/<article class="compagnon-carte"/g)?.length, 3)
  assert.match(neuf, /<button type="button" class="compagnon-scene" aria-label="Caresser le loup">/)
  assert.match(neuf, /aria-label="Caresser la tortue-île"/)
  assert.equal(neuf.match(/>L’adopter<\/button>/g)?.length, 3, 'de quoi les adopter tous les trois')
  assert.equal(neuf.match(/class="compagnon-prix">🎊 1000</g)?.length, 3)
  // Chaque forme dit ce qu'elle demande : l'achat, puis 100, 300, 500 — en couleur, à toucher : on voit ce qu'il devient.
  assert.equal(neuf.match(/<span class="compagnon-seuil" aria-hidden="true">Achat<\/span>/g)?.length, 3)
  for (const n of ['100', '300', '500']) assert.equal(neuf.match(new RegExp(`<span class="compagnon-seuil" aria-hidden="true">${n}</span>`, 'g'))?.length, 3, n)
  assert.equal(neuf.match(/<button type="button" class="compagnon-forme"/g)?.length, 12)
  assert.match(neuf, /aria-pressed="true" aria-label="Le louveteau, commune, à l’adoption"/)
  assert.match(neuf, /aria-label="Le loup des étoiles, légendaire, à 500 bonnes réponses"/)
  assert.doesNotMatch(neuf, /pas encore à toi/, 'aucune silhouette : la boutique montre ce qu’il deviendra')
  // Les points sous la vitrine : un par compagnon, le premier montré.
  assert.equal(neuf.match(/class="vitrine-point"/g)?.length, 3)
  assert.match(neuf, /<button type="button" class="vitrine-point" aria-label="Le Loup" aria-current="true">/)
  // Le loup grandi d'une forme, porté ; trop peu de confettis pour les autres.
  const avecLeLoup = await rayon({ legendaire: 'cp:loup-jeune', boutique: boutique(50, [{ compagnon: 'loup', rang: 1, justes: 162 }]) })
  assert.match(avecLeLoup, /À toi · Le jeune loup, deuxième forme/)
  assert.match(avecLeLoup, /162 sur 300 bonnes réponses avec lui\s: le loup adulte/)
  assert.match(avecLeLoup, /<a class="link-inline" href="\/profil#avatar">Tu le portes en avatar · en changer<\/a>/)
  // Ses formes atteintes cochées ; la sienne montrée en grand.
  assert.equal(avecLeLoup.match(/class="compagnon-forme compagnon-atteinte"/g)?.length, 2)
  assert.match(avecLeLoup, /aria-pressed="true" aria-label="Le jeune loup, rare, à toi"/)
  assert.equal(avecLeLoup.match(/>Encore 950 confettis</g)?.length, 2)
  assert.doesNotMatch(avecLeLoup, />L’adopter</, 'rien à adopter à ce prix-là')
  // Ce qui manque se gagne : les missions du jour le disent, sous chacun.
  assert.equal(avecLeLoup.match(/<a class="link-inline" href="\/#missions">mes missions<\/a>/g)?.length, 2)
  // À sa forme ultime, la jauge vise le palier suivant de sa niche au lieu de s'arrêter (le propriétaire, le
  // 19 octobre 2026) ; elle ne s'arrête qu'à la légende, sa niche ornée de tout.
  assert.match(
    await rayon({ legendaire: null, boutique: boutique(0, [{ compagnon: 'tortue', rang: 3, justes: 620 }]) }),
    /620 sur 1500 bonnes réponses avec elle\s: une guirlande de petites lampes/,
  )
  assert.match(
    await rayon({ legendaire: null, boutique: boutique(0, [{ compagnon: 'tortue', rang: 3, paliers: 4, justes: 26000 }]) }),
    /Légende\s: sa niche a tous ses ornements\./,
  )
  // La tortue se dit au féminin : « Tu le portes » se lisait de travers sous elle.
  const avecLaTortue = await rayon({ legendaire: 'cp:tortue-jeune', boutique: boutique(0, [{ compagnon: 'tortue', rang: 1, justes: 120 }]) })
  assert.match(avecLaTortue, /120 sur 300 bonnes réponses avec elle\s: la tortue-bosquet/)
  assert.match(avecLaTortue, /<a class="link-inline" href="\/profil#avatar">Tu la portes en avatar · en changer<\/a>/)
  assert.match(avecLaTortue, /aria-label="Les formes de la Tortue-île"/)
  // Pas portée : la loge s'ouvre avec sa plus grande forme à l'essai.
  const pasPortee = await rayon({ legendaire: null, boutique: boutique(0, [{ compagnon: 'tortue', rang: 1, justes: 120 }]) })
  assert.match(pasPortee, /<a class="link-inline" href="\/profil\?essayer=cp:tortue-jeune#avatar">La porter en avatar<\/a>/)
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
/** Douze questions de chacune des douze catégories : de quoi jouer une série. */
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    await scenario(banc)
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

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, jour: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`,
      )
      .run(profileId, jour, justes),
  )
}

/** Une série de campagne d'avant, ses `n` bonnes réponses données en portant `compagnon`. */
function serieEnPortant(banc: Banc, profileId: string, id: string, n: number, compagnon: string | null) {
  enBase(banc, db => {
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 3, ?, 1, 2)`).run(
      id,
      profileId,
      n,
      n,
    )
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
    db.transaction(() => {
      for (let i = 0; i < n; i++) reponse.run(id, i, `${id}-${i}`, compagnon)
    })()
  })
}

const lire = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
const acheter = (banc: Banc, cookie: string | undefined, compagnon: string) =>
  ecrire(banc.url, '/api/joueur/compagnons', { compagnon }, cookie).then(async r => ({
    status: r.status,
    corps: (await r.json()) as any,
  }))
const porter = (banc: Banc, cookie: string, patch: object) =>
  ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('un compagnon s’achète 1000 confettis à sa première forme, et se porte : ce qu’on n’a pas est refusé en clair', () =>
  avecBanc(async banc => {
    assert.equal((await acheter(banc, undefined, 'loup')).status, 401, 'sans profil, pas de boutique')
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    assert.equal((await lire(banc, cookie)).compagnons, undefined, 'sans compagnon, rien à lire')

    const fauche = await acheter(banc, cookie, 'loup')
    assert.equal(fauche.status, 400)
    assert.equal(fauche.corps.error, 'Il te manque 1000 confettis pour le Loup')
    assert.equal((await acheter(banc, cookie, 'dragon')).corps.error, 'Ce compagnon n’existe pas')

    confettis(banc, alice, '2026-09-20', 1200)
    const achat = await acheter(banc, cookie, 'loup')
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(achat.corps.profile.legendaire, null, 'adopté, il vit dans sa niche : il ne se porte qu’en le choisissant')
    assert.deepEqual(achat.corps.profile.compagnons, [{ compagnon: 'loup', rang: 0 }])
    assert.deepEqual(achat.corps.boutique.confettis, { gagnes: 1200, depenses: 1000, solde: 200 })
    assert.deepEqual(achat.corps.boutique.compagnons, [{ compagnon: 'loup', rang: 0, justes: 0 }])
    assert.equal((await acheter(banc, cookie, 'loup')).corps.error, 'Le Loup est déjà à toi')
    assert.equal((await acheter(banc, cookie, 'chat')).corps.error, 'Il te manque 800 confettis pour le Chat des lanternes')

    // Ce qu'il n'a pas ne se porte pas : une forme pas encore atteinte, un compagnon pas acheté.
    const tropTot = await porter(banc, cookie, { legendaire: 'cp:loup-jeune' })
    assert.equal(tropTot.status, 400)
    assert.equal(tropTot.corps.error, 'Le jeune loup arrive à 100 bonnes réponses données avec lui')
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:tortue-bebe' })).corps.error, 'La Tortue-île s’achète d’abord, à la boutique')

    // Il se porte d'un geste ; un emoji l'ôte.
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-louveteau' })).corps.profile.legendaire, 'cp:loup-louveteau')
    assert.equal((await porter(banc, cookie, { avatar: '🦊' })).corps.profile.legendaire, null)
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-louveteau' })).corps.profile.legendaire, 'cp:loup-louveteau')

    // Un autre adopté : celui qu'il porte reste sur lui.
    confettis(banc, alice, '2026-09-21', 1000)
    const garde = await acheter(banc, cookie, 'chat')
    assert.equal(garde.status, 200, garde.corps.error)
    assert.equal(garde.corps.profile.legendaire, 'cp:loup-louveteau')
    assert.deepEqual(
      garde.corps.profile.compagnons.map((c: any) => c.compagnon),
      ['loup', 'chat'],
    )
    assert.deepEqual(garde.corps.boutique.confettis, { gagnes: 2200, depenses: 2000, solde: 200 })
    // La tortue se dit au féminin, jusque dans le refus.
    confettis(banc, alice, '2026-09-22', 1000)
    assert.equal((await acheter(banc, cookie, 'tortue')).status, 200)
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:tortue-jeune' })).corps.error, 'La jeune tortue arrive à 100 bonnes réponses données avec elle')

    // La salle le voit : il remplace son emoji à l'instantané.
    assert.equal(
      enBase(banc, db => (db.prepare('SELECT legendaire FROM profiles WHERE id = ?').get(alice) as { legendaire: string }).legendaire),
      'cp:loup-louveteau',
    )
  }))

test('il grandit avec les bonnes réponses données avec lui ; qui le portait à sa plus haute forme porte la nouvelle ; une forme atteinte ne se perd jamais', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    assert.equal((await acheter(banc, cookie, 'loup')).status, 200)
    // Il le porte en avatar : il le choisit, l'adoption ne le fait pas.
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-louveteau' })).status, 200)

    // 99 bonnes réponses avec lui, et une sans lui : pas encore.
    serieEnPortant(banc, alice, 's1', 99, 'loup')
    serieEnPortant(banc, alice, 's2', 1, null)
    let moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 0, justes: 99 }])
    assert.equal(moi.legendaire, 'cp:loup-louveteau')

    // La centième : le jeune loup. Il portait sa plus haute forme : il porte la nouvelle.
    serieEnPortant(banc, alice, 's3', 1, 'loup')
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 1, justes: 100 }])
    assert.deepEqual(moi.compagnons, [{ compagnon: 'loup', rang: 1 }])
    assert.equal(moi.legendaire, 'cp:loup-jeune', 'il a grandi pour de bon')

    // Il préfère le louveteau : il le garde, même quand le loup grandit encore.
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-louveteau' })).corps.profile.legendaire, 'cp:loup-louveteau')
    serieEnPortant(banc, alice, 's4', 200, 'loup')
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 2, justes: 300 }])
    assert.equal(moi.legendaire, 'cp:loup-louveteau', 'qui avait choisi une forme d’avant la garde')
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-adulte' })).status, 200)

    // Ses bonnes réponses s'en vont (une série effacée) : la forme reste.
    enBase(banc, db => db.prepare('DELETE FROM campagne_reponses').run())
    moi = await lire(banc, cookie)
    assert.deepEqual(moi.boutique.compagnons, [{ compagnon: 'loup', rang: 2, justes: 0 }])
    assert.equal(moi.legendaire, 'cp:loup-adulte')
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-jeune' })).status, 200, 'une forme d’avant se porte toujours')
    assert.equal(
      (await porter(banc, cookie, { legendaire: 'cp:loup-ultime' })).corps.error,
      'Le loup des étoiles arrive à 500 bonnes réponses données avec lui',
    )
  }))

const lireLaNiche = async (banc: Banc, cookie: string) => (await (await fetch(`${banc.url}/api/joueur/niche`, { headers: { Cookie: cookie } })).json()) as any
const montrer = (banc: Banc, cookie: string, compagnon: string, montree: number | null) =>
  ecrire(banc.url, `/api/joueur/compagnons/${compagnon}`, { montree }, cookie, 'PUT').then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('l’Éclat lui ouvre sa métamorphose à sa forme ultime : rien ne change d’office, elle se porte et se montre en la choisissant, neuve tant qu’il ne l’a pas trouvée', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 2000)
    assert.equal((await acheter(banc, cookie, 'loup')).status, 200)
    // Le chat attend son tour : le loup garde sa niche.
    assert.equal((await ecrire(banc.url, '/api/joueur/compagnons', { compagnon: 'chat', installer: false }, cookie)).status, 200)
    // Sa forme ultime atteinte, sans l'Éclat : elle ne s'ouvre pas.
    serieEnPortant(banc, alice, 's1', 520, 'loup')
    const sansEclat = 'Le loup-tempête s’ouvre à sa forme ultime, quand l’Éclat tombe sur lui'
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-tempete' })).corps.error, sansEclat)
    assert.equal((await montrer(banc, cookie, 'loup', MONTREE_DE_LA_METAMORPHOSE)).corps.error, sansEclat)
    // Sa loge vue une fois : ce qui viendra s'y dira nouveau.
    assert.equal((await ecrire(banc.url, '/api/joueur/vus', { vus: { avatar: ['cp:loup-louveteau'] } }, cookie, 'PUT')).status, 200)
    // Tombé sur son louveteau, une soirée d'avant : il a grandi depuis.
    enBase(banc, db => db.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, 'cp:loup-louveteau', 'une-soiree', 1)`).run(alice))
    await banc.redemarrer()
    // La niche ne lit pas les Éclats : le serveur le dit de chaque compagnon, à
    // sa page comme à sa fiche — le chat, lui, n'a pas éclaté.
    const moi = await lire(banc, cookie)
    assert.deepEqual(moi.compagnons, [
      { compagnon: 'loup', rang: 3, eclat: true },
      { compagnon: 'chat', rang: 0 },
    ])
    // Rien ne change d'office : ni son avatar, ni sa niche, qui garde sa forme ultime.
    assert.equal(moi.legendaire, null)
    let fiche = await lireLaNiche(banc, cookie)
    assert.deepEqual(fiche.niche, { compagnon: 'loup', rang: 3, eclat: true, justes: 520 })
    // Neuve, pour qu'il la trouve : « Décorer » la marque, comme la loge.
    assert.deepEqual(fiche.neuves, ['cp:loup-tempete'])
    // Le chat n'a ni sa forme ultime ni l'Éclat : refusé en clair, partout.
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:chat-soleil' })).corps.error, 'Le chat-soleil s’ouvre à sa forme ultime, quand l’Éclat tombe sur lui')
    assert.equal((await montrer(banc, cookie, 'chat', MONTREE_DE_LA_METAMORPHOSE)).status, 400)
    assert.equal((await montrer(banc, cookie, 'loup', 5)).corps.error, 'Cette forme n’existe pas')
    // Montrée dans sa niche : choisie, et trouvée — ni « Décorer » ni la loge ne la disent plus nouvelle.
    const montree = await montrer(banc, cookie, 'loup', MONTREE_DE_LA_METAMORPHOSE)
    assert.equal(montree.status, 200, montree.corps.error)
    assert.deepEqual(montree.corps.profile.compagnons[0], { compagnon: 'loup', rang: 3, montree: MONTREE_DE_LA_METAMORPHOSE, eclat: true })
    const vus = enBase(banc, db => JSON.parse((db.prepare('SELECT vus FROM profile_loge_vus WHERE profile_id = ?').get(alice) as { vus: string }).vus))
    assert.ok(vus.avatar.includes('cp:loup-tempete'))
    // Et le choix tient au réveil du serveur : relu, il ne gardait que les formes d'avant la plus haute.
    await banc.redemarrer()
    fiche = await lireLaNiche(banc, cookie)
    assert.equal(fiche.niche.montree, MONTREE_DE_LA_METAMORPHOSE)
    assert.deepEqual(fiche.neuves, [])
    // L'avatar est une autre affaire : la porter est un autre choix, que la salle voit.
    assert.equal((await porter(banc, cookie, { legendaire: 'cp:loup-tempete' })).corps.profile.legendaire, 'cp:loup-tempete')
    assert.equal((await montrer(banc, cookie, 'loup', null)).status, 200, 'sa forme ultime reprend la niche d’un toucher')
    assert.equal((await lire(banc, cookie)).legendaire, 'cp:loup-tempete', 'et la métamorphose reste sur lui')
    // La soirée qui avait fait tomber l'Éclat retirée, il s'en va : sa métamorphose se referme.
    assert.equal((await montrer(banc, cookie, 'loup', MONTREE_DE_LA_METAMORPHOSE)).status, 200)
    enBase(banc, db => db.prepare('DELETE FROM profile_eclats WHERE profile_id = ?').run(alice))
    await banc.redemarrer()
    const sans = await lire(banc, cookie)
    assert.equal(sans.legendaire, null, 'plus portée')
    assert.equal(formeDansLaNiche(sans.compagnons[0])?.key, 'cp:loup-ultime', 'sa niche reprend sa forme ultime')
    assert.deepEqual(sans.compagnons[0], { compagnon: 'loup', rang: 3, montree: MONTREE_DE_LA_METAMORPHOSE }, 'son choix reste, pour quand l’Éclat reviendra')
    assert.deepEqual((await lireLaNiche(banc, cookie)).neuves, [])
  }))

/** Les questions de sa série, lues en base : le téléphone ne voit jamais la bonne avant sa réponse. */
function bonnes(banc: Banc, serie: string): number[] {
  return enBase(banc, db => {
    const { questions } = db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }
    return (JSON.parse(questions) as { bonne: number }[]).map(q => q.bonne)
  })
}

test('en campagne et au quiz du jour, chaque réponse retient le compagnon de sa niche — porté ou non', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    assert.equal((await acheter(banc, cookie, 'tortue')).status, 200)

    // Une série : deux justes, une fausse.
    const s = (await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as any
    assert.ok(s.id, s.error)
    const reponses = bonnes(banc, s.id)
    for (const [i, juste] of [true, true, false].entries()) {
      const choix = juste ? reponses[i] : (reponses[i] + 1) % 2
      const r = await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix }, cookie)
      assert.equal(r.status, 200)
    }
    assert.deepEqual(
      enBase(banc, db => db.prepare('SELECT juste, compagnon FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(s.id)),
      [
        { juste: 1, compagnon: 'tortue' },
        { juste: 1, compagnon: 'tortue' },
        { juste: 0, compagnon: 'tortue' },
      ],
    )

    // Le quiz du jour : toute la partie, la tortue ôtée de son avatar pour la
    // première — elle reste dans sa niche.
    assert.equal((await porter(banc, cookie, { avatar: '🦊' })).status, 200)
    let etat = (await (await ecrire(banc.url, '/api/jour/commencer', {}, cookie)).json()) as any
    const questions = enBase(banc, db =>
      JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
    ) as { bonne: number }[]
    while (etat.question) {
      const i = etat.question.index
      if (i === 1) assert.equal((await porter(banc, cookie, { legendaire: 'cp:tortue-bebe' })).status, 200)
      const r = await ecrire(banc.url, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne }, cookie)
      assert.equal(r.status, 200)
      etat = await (await ecrire(banc.url, '/api/jour/suivante', {}, cookie)).json()
    }
    const lignes = enBase(banc, db => db.prepare('SELECT question, compagnon FROM jour_reponses WHERE profile_id = ? ORDER BY question').all(alice)) as {
      question: number
      compagnon: string | null
    }[]
    assert.equal(lignes.length, 10)
    assert.equal(lignes[0].compagnon, 'tortue', 'pas portée, mais dans sa niche : elle grandit')
    assert.ok(
      lignes.slice(1).every(l => l.compagnon === 'tortue'),
      'portée, de même',
    )
    // Deux justes en campagne, dix au quiz du jour.
    assert.deepEqual((await lire(banc, cookie)).boutique.compagnons, [{ compagnon: 'tortue', rang: 0, justes: 12 }])
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

test('en soirée, ses bonnes réponses le nourrissent — les justes et l’estimation la plus proche — et la salle le voit grandir à la fin du quiz', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [
      qcm('Le ciel est bleu ?'),
      qcm('L’eau mouille ?'),
      qcm('La Lune est un fromage ?', ['Oui', 'Non'], 1),
      estimation('Combien de marches à la tour Eiffel ?', 1665),
    ])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 1000)
    assert.equal((await acheter(banc, aliceCookie, 'loup')).status, 200)
    // Elle le porte en avatar : la salle le verra grandir.
    assert.equal((await porter(banc, aliceCookie, { legendaire: 'cp:loup-louveteau' })).status, 200)
    // 97 bonnes réponses en campagne : les trois de ce soir le font grandir.
    serieEnPortant(banc, alice, 'avant', 97, 'loup')

    const host = await ecranCommun(banc.url, cookie)
    const aliceTel = await invite(banc.url, 'Alice', '', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const aliceALaSalle = (instantane: any) => instantane.players.find((p: any) => p.name === 'Alice')
    const grandi = attendre<any>(host, 'party:snapshot', s => aliceALaSalle(s)?.legendaire === 'cp:loup-jeune', 'le jeune loup à la salle', 15_000)

    // Alice : deux justes, une fausse, l'estimation la plus proche. Bob se trompe partout.
    await jouerQuiz(host, quiz, [
      [
        [aliceTel, { choice: 0 }],
        [bob, { choice: 1 }],
      ],
      [
        [aliceTel, { choice: 0 }],
        [bob, { choice: 1 }],
      ],
      [
        [aliceTel, { choice: 0 }],
        [bob, { choice: 0 }],
      ],
      [
        [aliceTel, { value: 1600 }],
        [bob, { value: 300 }],
      ],
    ])
    // Le quiz fini, il a grandi : la salle voit le jeune loup.
    await grandi
    let compagnons: any
    for (const limite = Date.now() + 8000; ; await patienter(100)) {
      compagnons = (await lire(banc, aliceCookie)).boutique.compagnons
      if (compagnons?.[0]?.justes >= 100 || Date.now() > limite) break
    }
    assert.deepEqual(compagnons, [{ compagnon: 'loup', rang: 1, justes: 100 }])
    // Ce soir : ses deux justes et son estimation la plus proche, rangées
    // dans son relevé comme ses confettis — la fausse n'y est pas.
    const releve = enBase(banc, db => {
      const { detail } = db.prepare(`SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%'`).get(alice) as { detail: string }
      return JSON.parse(detail).releve
    })
    assert.deepEqual(releve.compagnons, { loup: 3 })

    // Chaque ligne du journal retient ce qu'il portait — Bob, rien —, le
    // miroir aussi : un réveil sur disque effacé la retrouve.
    const parJoueur = (lignes: { player_id: string; compagnon: string | null }[]) =>
      [...new Set(lignes.map(l => `${l.player_id === aliceTel.playerId ? 'Alice' : 'Bob'} ${l.compagnon}`))].sort()
    await patienter(400)
    assert.deepEqual(
      parJoueur(enBase(banc, db => db.prepare('SELECT player_id, compagnon FROM party_answers').all() as any)),
      ['Alice loup', 'Bob null'],
    )
    await banc.redemarrer({ disqueEfface: true })
    const locale = new Database(banc.dbPath)
    try {
      assert.deepEqual(parJoueur(locale.prepare('SELECT player_id, compagnon FROM answer_log').all() as any), ['Alice loup', 'Bob null'], 'le réveil les rend au journal')
    } finally {
      locale.close()
    }
  }))

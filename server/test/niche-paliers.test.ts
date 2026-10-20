// Sa niche, sur la durée (le choix du 19 octobre 2026, le propriétaire :
// « Après 500 : 1 500, 4 000, 10 000, 25 000 bonnes réponses avec lui,
// chacune un ornement gardé pour toujours […]. On choisit lesquels montrer,
// et la jauge vise le palier suivant au lieu de s'arrêter. ») : après sa
// forme ultime, sa niche s'embellit — une guirlande, du lierre et des fleurs,
// l'arche dorée, un halo —, chaque palier gardé même quand une soirée retirée
// reprend des bonnes réponses. Et la carte que la salle ouvre montre le
// compagnon de sa niche, avec son nom (« Le compagnon sur la carte doit avoir
// son nom », le même jour).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { MONTREE_DE_LA_METAMORPHOSE, compagnon } from '../../shared/compagnons'
import { formatNumber } from '../../shared/typographie'
import {
  ORNEMENTS,
  PALIERS_DE_LA_NICHE,
  STYLES_D_ORNEMENT,
  STYLE_D_OFFICE,
  lireLesOrnements,
  ornementsMontres,
  paliersDeLaNicheAtteints,
  prochainOrnement,
  prochainSeuil,
  titreDeLAmitie,
} from '../../shared/ornements'
import { CATEGORIES } from '../../shared/categories'

ProfileStore.tirageEclat = () => false

// ── La règle, pure ────────────────────────────────────────────────────────

test('après sa forme ultime, quatre paliers, chacun son ornement : 1 500, 4 000, 10 000, 25 000 bonnes réponses avec lui', () => {
  assert.deepEqual([...PALIERS_DE_LA_NICHE], [1500, 4000, 10000, 25000])
  assert.deepEqual(
    ORNEMENTS.map(o => [o.key, o.palier, o.justes, o.titre]),
    [
      ['guirlande', 1, 1500, 'Amis pour la vie'],
      ['lierre', 2, 4000, 'Complices'],
      ['arche', 3, 10000, 'Inséparables'],
      ['halo', 4, 25000, 'Légende'],
    ],
  )
  for (const [justes, paliers] of [
    [0, 0],
    [500, 0],
    [1499, 0],
    [1500, 1],
    [3999, 1],
    [4000, 2],
    [10000, 3],
    [24999, 3],
    [25000, 4],
    [1_000_000, 4],
  ]) {
    assert.equal(paliersDeLaNicheAtteints(justes), paliers, String(justes))
  }
  // La jauge vise le palier suivant au lieu de s'arrêter à la forme ultime.
  assert.deepEqual(prochainOrnement({ justes: 600 }), { ornement: ORNEMENTS[0], encore: 900 })
  assert.deepEqual(prochainOrnement({ paliers: 3, justes: 12000 }), { ornement: ORNEMENTS[3], encore: 13000 })
  assert.equal(prochainOrnement({ paliers: 4, justes: 30000 }), null, 'la légende : tout est là')
  // Une soirée retirée a repris des bonnes réponses : le palier reste, la jauge repart d'où il en est.
  assert.deepEqual(prochainOrnement({ paliers: 1, justes: 1200 }), { ornement: ORNEMENTS[1], encore: 2800 })
  // Le prochain but, partout où une jauge le vise : sa forme suivante, puis le palier suivant.
  assert.equal(prochainSeuil({ rang: 1 }), 300)
  assert.equal(prochainSeuil({ rang: 3 }), 1500)
  assert.equal(prochainSeuil({ rang: 3, paliers: 2 }), 10000)
  assert.equal(prochainSeuil({ rang: 3, paliers: 4 }), null)
  assert.equal(titreDeLAmitie(undefined), undefined)
  assert.equal(titreDeLAmitie(1), 'Amis pour la vie')
  assert.equal(titreDeLAmitie(4), 'Légende')
})

test('chaque ornement gagné se montre d’office, peint ; on choisit lesquels montrer, et comment — et rien d’inconnu ne passe', () => {
  // Peint, dessiné comme sur la maquette, ou caché : le Féerique d'office, le style choisi le 20 octobre 2026.
  assert.deepEqual([...STYLES_D_ORNEMENT], ['feerique', 'dessin', 'cache'])
  assert.equal(STYLE_D_OFFICE, 'feerique')
  assert.deepEqual(ornementsMontres({}), [])
  assert.deepEqual(ornementsMontres({ paliers: 2 }), [
    { cle: 'guirlande', style: 'feerique' },
    { cle: 'lierre', style: 'feerique' },
  ])
  assert.deepEqual(ornementsMontres({ paliers: 4, ornements: { lierre: 'cache', arche: 'dessin' } }), [
    { cle: 'guirlande', style: 'feerique' },
    { cle: 'arche', style: 'dessin' },
    { cle: 'halo', style: 'feerique' },
  ])
  // Un réglage d'un ornement pas encore atteint ne montre rien ; un style inconnu reprend celui d'office.
  assert.deepEqual(ornementsMontres({ paliers: 1, ornements: { halo: 'dessin' } }), [{ cle: 'guirlande', style: 'feerique' }])
  assert.deepEqual(ornementsMontres({ paliers: 1, ornements: { guirlande: 'paillettes' } }), [{ cle: 'guirlande', style: 'feerique' }])
  // Seul ce qui s'écarte du style d'office se retient.
  assert.deepEqual(lireLesOrnements('{"guirlande":"cache","lierre":"dessin","dragon":"cache","arche":"paillettes","halo":"feerique"}'), { guirlande: 'cache', lierre: 'dessin' })
  assert.deepEqual(lireLesOrnements({ halo: 'cache' }), { halo: 'cache' })
  for (const brut of ['pas du json', '["cache"]', null, 42, ['cache']]) assert.deepEqual(lireLesOrnements(brut), {}, JSON.stringify(brut))
})

// ── Au téléphone ──────────────────────────────────────────────────────────

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

test('le téléphone retient ses paliers et ses ornements ; un palier atteint pendant la partie le fait sortir de sa niche', async () => {
  const retenu = new Map<string, string>()
  Object.assign(globalThis, {
    document: { body: { classList: { toggle: () => true } } },
    localStorage: { getItem: (k: string) => retenu.get(k) ?? null, setItem: (k: string, v: string) => retenu.set(k, v), removeItem: (k: string) => retenu.delete(k) },
  })
  try {
    const niche = await import(client('niche.ts'))
    let appels = 0
    niche.abonnerNiche(() => appels++)
    const moments: string[] = []
    niche.ecouterLaNiche((m: { sorte: string }) => moments.push(m.sorte))
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 3, paliers: 1 }] })
    assert.deepEqual(JSON.parse(retenu.get('quizz.niche')!), { compagnon: 'loup', rang: 3, paliers: 1 })
    const avant = appels
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 3, paliers: 1, ornements: { guirlande: 'cache' } }] })
    assert.equal(appels, avant + 1, 'un ornement caché : la niche le prend')
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 3, paliers: 1, ornements: { guirlande: 'cache' } }] })
    assert.equal(appels, avant + 1, 'le même réglage ne refait rien')
    // Une réponse donnée, puis le profil relu avec un palier de plus : il sort la montrer.
    niche.nicheRetientSonSouffle()
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 3, paliers: 2, ornements: { guirlande: 'cache' } }] })
    assert.deepEqual(moments, ['souffle', 'sortie'])
    // Rien d'abîmé ne se relit : un palier hors des quatre, ou avant sa forme ultime.
    for (const [brut, lu] of [
      [{ compagnon: 'loup', rang: 3, paliers: 4, ornements: { halo: 'cache' } }, { compagnon: 'loup', rang: 3, paliers: 4, ornements: { halo: 'cache' } }],
      [{ compagnon: 'loup', rang: 3, paliers: 7 }, { compagnon: 'loup', rang: 3 }],
      [{ compagnon: 'loup', rang: 2, paliers: 1 }, { compagnon: 'loup', rang: 2 }],
      [{ compagnon: 'loup', rang: 3, paliers: 1, ornements: 'cache' }, { compagnon: 'loup', rang: 3, paliers: 1 }],
      [{ compagnon: 'loup', rang: 3, paliers: 1, ornements: { guirlande: 3 } }, { compagnon: 'loup', rang: 3, paliers: 1 }],
    ]) {
      retenu.set('quizz.niche', JSON.stringify(brut))
      niche.poserNicheRetenue()
      assert.deepEqual(niche.nicheActuelle(), lu, JSON.stringify(brut))
    }
  } finally {
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('« Touche-moi ! » : sur l’accueil, le profil et la boutique, trois fois au plus, jamais plus une fois touchée', async () => {
  const { appelerAuToucher } = await import(client('niche.ts'))
  assert.equal(appelerAuToucher('/', { vues: 0, touchee: false }), true)
  assert.equal(appelerAuToucher('/profil', { vues: 2, touchee: false }), true)
  assert.equal(appelerAuToucher('/boutique', { vues: 3, touchee: false }), false, 'trois fois suffisent')
  assert.equal(appelerAuToucher('/', { vues: 0, touchee: true }), false, 'touchée, elle est trouvée')
  for (const page of ['/jour', '/campagne', '/duels', '/chez-bruno', '/expedition']) {
    assert.equal(appelerAuToucher(page, { vues: 0, touchee: false }), false, `pas en jouant : ${page}`)
  }
})

/** Un composant de la niche, rendu tel que la page le montre. */
async function rendre(composant: string, props: object): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(client('components/Niche.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

test('sa niche porte les ornements qu’il montre : la guirlande, le lierre, l’arche dorée, le halo — dessinés, ceux de la maquette', async () => {
  // Peints d'office : leurs calques et leurs plans, `ornements-peints.test.ts`. Dessinés, ce qui suit.
  const dessines = (paliers: number, autres: object = {}) => ({ ...Object.fromEntries(ORNEMENTS.slice(0, paliers).map(o => [o.key, 'dessin'])), ...autres })
  const deux = await rendre('Niche', { compagnon: 'loup', rang: 3, paliers: 2, ornements: dessines(2) })
  assert.match(deux, /class="orne orne-guirlande"/)
  assert.match(deux, /class="orne orne-lierre"/)
  assert.doesNotMatch(deux, /orne-arche|orne-halo|niche-halo|niche-cadre orne-or|orne-peint/, 'pas ce qu’il n’a pas atteint, ni rien de peint')
  const tous = await rendre('Niche', { compagnon: 'loup', rang: 3, paliers: 4, ornements: dessines(4, { lierre: 'cache' }) })
  assert.match(tous, /class="niche-halo"/, 'le halo, derrière lui')
  assert.match(tous, /class="niche-cadre orne-or"/, 'l’arche dorée')
  assert.match(tous, /class="orne orne-arche"/, 'et son étoile')
  assert.match(tous, /class="orne orne-guirlande"/)
  assert.doesNotMatch(tous, /orne-lierre/, 'caché : il ne se montre pas')
  for (const vue of [{ compagnon: 'loup', rang: 2 }, { compagnon: 'loup', rang: 3 }]) {
    assert.doesNotMatch(await rendre('Niche', vue), /class="orne |orne-peint|orne-or/, `avant le premier palier, rien : ${JSON.stringify(vue)}`)
  }
  // Les lampes scintillent, le halo respire : le mouvement réduit les arrête.
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const reduit = css.slice(css.indexOf('LES ORNEMENTS DE LA NICHE'))
  assert.match(reduit, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.orne-lampe[^@]*animation: none/)
})

test('sa fiche dit où il en est, après sa forme ultime aussi, et « Décorer » montre chaque ornement gagné peint, dessiné, ou caché d’un toucher', async () => {
  // Où il en est : sa forme suivante, puis le palier suivant de sa niche — la jauge ne s'arrête qu'à la légende.
  const { ouIlEnEst } = await import(client('components/Niche.tsx'))
  assert.deepEqual(ouIlEnEst({ compagnon: 'loup', rang: 2, justes: 320 }, 0), { part: 0.64, phrase: '320 sur 500 bonnes réponses avec lui : le loup des étoiles' })
  assert.deepEqual(ouIlEnEst({ compagnon: 'loup', rang: 3, justes: 1200 }, 0), { part: 0.8, phrase: '1200 sur 1500 bonnes réponses avec lui : une guirlande de petites lampes' })
  assert.deepEqual(ouIlEnEst({ compagnon: 'tortue', rang: 3, justes: 5000 }, 2), { part: 0.5, phrase: `5000 sur ${formatNumber(10000)} bonnes réponses avec elle : l’arche dorée et son étoile` })
  assert.deepEqual(ouIlEnEst({ compagnon: 'loup', rang: 3, justes: 30000 }, 4), { part: null, phrase: 'Légende : sa niche a tous ses ornements.' })
  // Et le titre de leur amitié, sous son nom.
  assert.match(await rendre('FicheDeLaNiche', { niche: { compagnon: 'loup', rang: 3, paliers: 1 }, onFermer: () => {} }), /<span class="niche-fiche-amitie">Amis pour la vie<\/span>/)

  // « Sa niche s'embellit », dans « Décorer » : ce qui l'attend, puis ses trois choix pour chaque ornement gagné.
  const embellit = (niche: { compagnon: string; rang: number; paliers?: number; ornements?: object }) =>
    rendre('SaNicheSEmbellit', { niche, c: compagnon(niche.compagnon), busy: false, onOrner: () => {} })
  const avant = await embellit({ compagnon: 'loup', rang: 2 })
  assert.match(avant, /Sa niche s’embellit/)
  assert.match(avant, /une guirlande de petites lampes à 1500 bonnes réponses avec lui/, 'annoncée avant sa forme ultime')
  const une = await embellit({ compagnon: 'loup', rang: 3, paliers: 1 })
  // Un nom fixe : le style montré se dit par aria-pressed (`design.test.ts`) ; le détail des choix, `ornements-peints.test.ts`.
  assert.equal(une.match(/class="niche-orne"/g)?.length, 1, 'seulement ce qu’il a gagné se règle')
  assert.equal(une.match(/<button type="button" class="niche-orne-style" aria-pressed="true"/g)?.length, 1)
  assert.match(une, /Amis pour la vie/)
  assert.match(une, /Complices · à 4000/, 'le suivant s’annonce')
  const cache = await embellit({ compagnon: 'tortue', rang: 3, paliers: 4, ornements: { guirlande: 'cache' } })
  assert.equal(cache.match(/class="niche-orne"/g)?.length, 4)
  assert.match(cache, /<button type="button" class="niche-orne-style" aria-pressed="true"[^>]*>(?:(?!<\/button>)[\s\S])*Caché/, 'la guirlande, cachée')
  assert.match(cache, /Légende/)
})

test('« Mon compagnon » a son bouton au profil et son écran, et la boutique mène à sa gestion', () => {
  const profil = readFileSync(new URL('../../client/src/views/ProfilApp.tsx', import.meta.url), 'utf8')
  assert.match(profil, /\{ id: 'compagnon', nom: 'Mon compagnon', groupe: 'Mon profil' \}/)
  assert.match(profil, /titre="Mon compagnon"/)
  const rayon = readFileSync(new URL('../../client/src/components/RayonDesCompagnons.tsx', import.meta.url), 'utf8')
  assert.match(rayon, /href="\/profil#compagnon"[^>]*>\s*Gérer ma niche/)
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
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

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses — une par jour. */
function confettis(banc: Banc, profileId: string, justes: number, jour = '2026-09-20') {
  enBase(banc, db =>
    db
      .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`)
      .run(profileId, jour, justes),
  )
}

/** Une série de campagne d'avant, ses `n` bonnes réponses données avec `compagnon` dans sa niche. */
function serieAvec(banc: Banc, profileId: string, id: string, n: number, compagnon: string) {
  enBase(banc, db => {
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 3, ?, 1, 2)`).run(id, profileId, n, n)
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
    db.transaction(() => {
      for (let i = 0; i < n; i++) reponse.run(id, i, `${id}-${i}`, compagnon)
    })()
  })
}

/** Une série retirée — ses bonnes réponses ne comptent plus. */
function retirer(banc: Banc, id: string) {
  enBase(banc, db => {
    db.prepare('DELETE FROM campagne_reponses WHERE serie_id = ?').run(id)
    db.prepare('DELETE FROM campagne_series WHERE id = ?').run(id)
  })
}

const lire = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
const laNiche = async (banc: Banc, cookie: string) => (await (await fetch(`${banc.url}/api/joueur/niche`, { headers: { Cookie: cookie } })).json()) as any
const reponse = async (r: Response) => ({ status: r.status, corps: (await r.json()) as any })
const adopter = (banc: Banc, cookie: string, corps: object) => ecrire(banc.url, '/api/joueur/compagnons', corps, cookie).then(reponse)
const regler = (banc: Banc, cookie: string, cle: string, corps: object) => ecrire(banc.url, `/api/joueur/compagnons/${cle}`, corps, cookie, 'PUT').then(reponse)
const porter = (banc: Banc, cookie: string, patch: object) => ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(reponse)

test('ses paliers se gagnent avec lui, se gardent — même quand une soirée retirée reprend des bonnes réponses — et ses ornements se montrent ou se cachent', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, 1000)
    assert.equal((await adopter(banc, cookie, { compagnon: 'loup' })).status, 200)

    // Sa forme ultime, puis la forme d'avant choisie pour sa niche.
    serieAvec(banc, alice, 's1', 600, 'loup')
    assert.equal((await regler(banc, cookie, 'loup', { montree: 1 })).status, 200)
    let fiche = await laNiche(banc, cookie)
    assert.deepEqual(fiche.niche, { compagnon: 'loup', rang: 3, montree: 1, justes: 600 })
    // Un ornement pas encore atteint est refusé en clair.
    const tot = await regler(banc, cookie, 'loup', { ornements: { guirlande: 'cache' } })
    assert.equal(tot.status, 400)
    assert.equal(tot.corps.error, 'Une guirlande de petites lampes : à 1500 bonnes réponses données avec lui')

    // 1 500 : la guirlande. La forme qu'il montre ne bouge pas — sa niche s'embellit, lui ne change pas.
    serieAvec(banc, alice, 's2', 900, 'loup')
    fiche = await laNiche(banc, cookie)
    assert.deepEqual(fiche.niche, { compagnon: 'loup', rang: 3, montree: 1, paliers: 1, justes: 1500 })
    assert.equal(enBase(banc, db => (db.prepare('SELECT paliers FROM profile_compagnons WHERE profile_id = ?').get(alice) as { paliers: number }).paliers), 1)

    // On choisit lesquels montrer.
    const cachee = await regler(banc, cookie, 'loup', { ornements: { guirlande: 'cache' } })
    assert.equal(cachee.status, 200, cachee.corps.error)
    assert.deepEqual(cachee.corps.profile.compagnons, [{ compagnon: 'loup', rang: 3, montree: 1, paliers: 1, ornements: { guirlande: 'cache' } }])
    for (const [ornements, erreur] of [
      [{ lierre: 'cache' }, 'Du lierre et des fleurs au rebord : à 4000 bonnes réponses données avec lui'],
      [{ dragon: 'cache' }, 'Cet ornement n’existe pas'],
      [{ guirlande: 'paillettes' }, 'Ce style d’ornement n’existe pas'],
      ['cache', 'Cet ornement n’existe pas'],
    ] as const) {
      const refus = await regler(banc, cookie, 'loup', { ornements })
      assert.equal(refus.status, 400, JSON.stringify(ornements))
      assert.equal(refus.corps.error, erreur)
    }
    // Retenu par le serveur, pour tous ses appareils : un réveil sur disque effacé le garde.
    await banc.redemarrer({ disqueEfface: true })
    assert.deepEqual((await lire(banc, cookie)).compagnons, [{ compagnon: 'loup', rang: 3, montree: 1, paliers: 1, ornements: { guirlande: 'cache' } }])
    // Dessinée, comme sur la maquette : retenu aussi.
    assert.deepEqual((await regler(banc, cookie, 'loup', { ornements: { guirlande: 'dessin' } })).corps.profile.compagnons, [
      { compagnon: 'loup', rang: 3, montree: 1, paliers: 1, ornements: { guirlande: 'dessin' } },
    ])
    // Peinte, elle reprend le style d'office : rien à retenir.
    assert.deepEqual((await regler(banc, cookie, 'loup', { ornements: { guirlande: 'feerique' } })).corps.profile.compagnons, [{ compagnon: 'loup', rang: 3, montree: 1, paliers: 1 }])
    assert.equal(enBase(banc, db => (db.prepare('SELECT ornements FROM profile_compagnons WHERE profile_id = ?').get(alice) as { ornements: string | null }).ornements), null)

    // La série d'où venaient ses bonnes réponses retirée : le palier reste, la jauge repart d'où il en est.
    retirer(banc, 's2')
    fiche = await laNiche(banc, cookie)
    assert.deepEqual(fiche.niche, { compagnon: 'loup', rang: 3, montree: 1, paliers: 1, justes: 600 })

    // Les paliers sont à lui : un autre compagnon installé dans la niche part de zéro.
    confettis(banc, alice, 1000, '2026-09-21')
    assert.equal((await adopter(banc, cookie, { compagnon: 'chat' })).status, 200)
    serieAvec(banc, alice, 's3', 1600, 'chat')
    fiche = await laNiche(banc, cookie)
    assert.deepEqual(
      fiche.compagnons.map((a: any) => [a.compagnon, a.paliers ?? 0, a.justes]),
      [
        ['loup', 1, 600],
        ['chat', 1, 1600],
      ],
    )
  }))

test('qui porte sa métamorphose la garde quand un palier tombe : seule une forme atteinte fait suivre son avatar', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, 1000)
    assert.equal((await adopter(banc, cookie, { compagnon: 'loup' })).status, 200)
    serieAvec(banc, alice, 's1', 600, 'loup')
    enBase(banc, db => db.prepare(`INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at) VALUES (?, 'cp:loup-louveteau', 'une-soiree', 1)`).run(alice))
    await banc.redemarrer()
    const porte = await porter(banc, cookie, { legendaire: 'cp:loup-tempete' })
    assert.equal(porte.status, 200, porte.corps.error)
    assert.equal((await regler(banc, cookie, 'loup', { montree: MONTREE_DE_LA_METAMORPHOSE })).status, 200)
    serieAvec(banc, alice, 's2', 1000, 'loup')
    const fiche = await laNiche(banc, cookie)
    assert.deepEqual(fiche.niche, { compagnon: 'loup', rang: 3, montree: MONTREE_DE_LA_METAMORPHOSE, eclat: true, paliers: 1, justes: 1600 })
    assert.equal((await lire(banc, cookie)).legendaire, 'cp:loup-tempete', 'le loup-tempête reste sur lui')
  }))

test('la carte que la salle ouvre montre le compagnon de sa niche, sous la forme qu’il y montre, avec son nom et ses ornements', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bruno = await inscrireProfil(banc.url, 'bruno', 'Bruno', '🐻')
    const alice = idDe(banc, 'alice')
    const carte = async (adresse: string, qui: string) => ((await (await fetch(`${banc.url}${adresse}`, { headers: { Cookie: qui } })).json()) as any).profil
    // Sans compagnon, rien : l'absence, pas « aucun compagnon ».
    assert.equal((await carte('/api/joueur/carte', cookie)).compagnon, undefined)
    confettis(banc, alice, 1000)
    assert.equal((await adopter(banc, cookie, { compagnon: 'loup' })).status, 200)
    serieAvec(banc, alice, 's1', 1500, 'loup')
    await laNiche(banc, cookie)
    assert.equal((await regler(banc, cookie, 'loup', { nom: 'Nox', montree: 2 })).status, 200)
    const sienne = await carte('/api/joueur/carte', cookie)
    assert.deepEqual(sienne.compagnon, { compagnon: 'loup', rang: 3, montree: 2, nom: 'Nox', paliers: 1 })
    // Celle qu'un ami ouvre, la même.
    assert.deepEqual((await carte(`/api/joueur/carte/${alice}`, bruno)).compagnon, sienne.compagnon)
  }))

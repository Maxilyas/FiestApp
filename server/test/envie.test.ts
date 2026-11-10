// « Mon envie » (le 10 novembre 2026, `shared/envie.ts`) : l'article de la
// boutique pour lequel un profil économise — un thème, un compagnon, un fond
// des savoirs, un objet du comptoir. Une à la fois, posée par
// `PUT /api/joueur/envie`. Elle ne donne rien et ne réserve rien : un choix,
// comme un titre, relu à chaque affichage. Achetée ou sortie de sa saison,
// elle ne part plus avec sa boutique — et rien ne s'efface en base.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ecrireEnvie, envieTenue, lireEnvie, ouEnEstLEnvie, prixDeLEnvie, refusDeLEnvie, PRIX_DES_OBJETS, type Envie } from '../../shared/envie'
import { PRIX_DES_THEMES, THEMES } from '../../shared/themes'
import { COMPAGNONS, COMPAGNONS_DE_LA_BOUTIQUE, PRIX_D_UN_COMPAGNON } from '../../shared/compagnons'
import { FONDS, PRIX_D_UN_FOND } from '../../shared/fonds'
import { PRIX_D_UN_SABLIER } from '../../shared/jour'
import { PRIX_D_UN_ECLAT } from '../../shared/profil'
import { PRIX_D_UNE_VIE } from '../../shared/sentiers'

const NE_SE_VEND_PAS = 'Cet article ne se vend pas à la boutique : choisis-en un autre.'
const RIEN = { themes: [], compagnons: [], fonds: [] }
/** Hors de toute saison. */
const JOUR = '2026-09-29'

const theme = (cle: string): Envie => ({ sorte: 'theme', cle })
const compagnon = (cle: string): Envie => ({ sorte: 'compagnon', cle })
const fond = (cle: string): Envie => ({ sorte: 'fond', cle })
const objet = (cle: string): Envie => ({ sorte: 'objet', cle })

// ── Les règles, pures ─────────────────────────────────────────────────────

test('une envie se lit du texte de la base comme de l’objet de la page, et rien d’autre n’en a la forme', () => {
  assert.deepEqual(lireEnvie('theme:aurore'), { sorte: 'theme', cle: 'aurore' })
  assert.deepEqual(lireEnvie('fond:table-de-jeux'), { sorte: 'fond', cle: 'table-de-jeux' })
  // De l'objet, la sorte et la clé seulement : ce qu'une page ajouterait ne va pas plus loin.
  assert.deepEqual(lireEnvie({ sorte: 'compagnon', cle: 'loup', prix: 1 }), { sorte: 'compagnon', cle: 'loup' })
  // Ce qui s'écrit se relit, pour chaque sorte.
  for (const e of [theme('cahier'), compagnon('chat'), fond('jazz'), objet('sablier')]) assert.deepEqual(lireEnvie(ecrireEnvie(e)), e)
  assert.equal(ecrireEnvie(theme('aurore')), 'theme:aurore')

  const refusees: unknown[] = [
    // Une sorte que la boutique ne vend pas.
    'gerbe:confettis',
    { sorte: 'avatar', cle: 'loup' },
    { sorte: 'Theme', cle: 'aurore' },
    // Une clé de catalogue : des minuscules, des chiffres, des traits d'union.
    'theme:Aurore',
    'theme:au rore',
    'theme:aurore;--',
    'objet:vie:deux',
    { sorte: 'theme', cle: '../aurore' },
    { sorte: 'theme', cle: 'a'.repeat(41) },
    { sorte: 'theme', cle: 42 },
    // Vide, ou à moitié.
    '',
    'theme',
    'theme:',
    ':aurore',
    {},
    { sorte: 'theme' },
    { cle: 'aurore' },
    [],
    null,
    undefined,
    42,
    true,
  ]
  for (const valeur of refusees) assert.equal(lireEnvie(valeur), null, JSON.stringify(valeur))
  assert.deepEqual(lireEnvie({ sorte: 'theme', cle: 'a'.repeat(40) }), { sorte: 'theme', cle: 'a'.repeat(40) }, 'quarante caractères passent encore')
})

test('son prix : celui de l’article, rien pour ce qui n’existe pas ou ne se vend pas', () => {
  // Un thème de chaque sorte : à vendre, de saison, offert, gagné.
  assert.equal(prixDeLEnvie(theme('cahier')), PRIX_DES_THEMES.commune)
  assert.equal(prixDeLEnvie(theme('aurore')), PRIX_DES_THEMES.legendaire)
  assert.equal(prixDeLEnvie(theme('halloween')), PRIX_DES_THEMES.rare, 'un thème de saison a son prix toute l’année : c’est sa saison qui le refuse')
  assert.equal(prixDeLEnvie(theme('ivoire')), null, 'offert')
  assert.equal(prixDeLEnvie(theme('velours')), null, 'offert')
  assert.equal(prixDeLEnvie(theme('babel')), null, 'il se gagne')
  assert.equal(prixDeLEnvie(theme('licorne-noire')), null, 'inconnu')
  // Tout le catalogue : un prix, sauf les offerts et ceux qui se gagnent.
  for (const t of THEMES) assert.equal(prixDeLEnvie(theme(t.key)), t.rarete === 'offert' || t.gagne ? null : PRIX_DES_THEMES[t.rarete], t.key)

  for (const c of COMPAGNONS_DE_LA_BOUTIQUE) assert.equal(prixDeLEnvie(compagnon(c.key)), PRIX_D_UN_COMPAGNON, c.key)
  assert.equal(prixDeLEnvie(compagnon('dragon')), null, 'inconnu')
  // On vise un compagnon, pas l'une de ses formes : elles ne s'achètent pas.
  assert.equal(prixDeLEnvie(compagnon(COMPAGNONS[0].formes[1].key.replace(/^cp:/, ''))), null)

  // Seuls les fonds des savoirs se vendent : ni le trésor du coffre, ni ceux d'une piste.
  for (const f of FONDS) assert.equal(prixDeLEnvie(fond(f.key)), f.savoir ? PRIX_D_UN_FOND : null, f.key)
  assert.equal(prixDeLEnvie(fond('jazz')), PRIX_D_UN_FOND)
  assert.equal(prixDeLEnvie(fond('dragon')), null, 'du trésor')
  assert.equal(prixDeLEnvie(fond('nuit')), null, 'il se gagne')
  // La sorte compte : « aurore » est un thème à vendre, et un fond qui se gagne.
  assert.equal(prixDeLEnvie(fond('aurore')), null)

  assert.deepEqual(PRIX_DES_OBJETS, { vie: PRIX_D_UNE_VIE, sablier: PRIX_D_UN_SABLIER, eclat: PRIX_D_UN_ECLAT })
  for (const [cle, prix] of Object.entries(PRIX_DES_OBJETS)) assert.equal(prixDeLEnvie(objet(cle)), prix, cle)
  assert.equal(prixDeLEnvie(objet('bombe')), null, 'inconnu')
})

// `PRIX_DES_OBJETS[cle]` lisait aussi ce dont tout objet hérite : « constructor »
// a la forme d'une clé de catalogue, son « prix » était une fonction, l'envie
// tenait, et `ouEnEstLEnvie` lui comptait une part `NaN`.
test('un objet du comptoir n’est que l’un des trois : rien de ce dont tout objet hérite ne passe pour un article', () => {
  const herites = Object.getOwnPropertyNames(Object.prototype)
  assert.ok(herites.includes('constructor'))
  for (const cle of herites) {
    assert.equal(prixDeLEnvie(objet(cle)), null, cle)
    assert.equal(refusDeLEnvie(objet(cle), RIEN, JOUR), NE_SE_VEND_PAS, cle)
    assert.equal(ouEnEstLEnvie(objet(cle), 100), null, cle)
  }
  // Celui-là passe la lecture : c'est le prix qui l'arrête.
  assert.deepEqual(lireEnvie('objet:constructor'), objet('constructor'))
})

test('une envie se refuse en clair : ce qui ne se vend pas, ce qu’il a déjà, un thème hors de sa saison', () => {
  // Elle tient : l'article existe, se vend ce jour-là, et il ne l'a pas.
  for (const e of [theme('cahier'), compagnon('loup'), fond('jazz'), objet('vie'), objet('sablier'), objet('eclat')]) assert.equal(refusDeLEnvie(e, RIEN, JOUR), null, ecrireEnvie(e))

  for (const e of [theme('ivoire'), theme('babel'), theme('licorne-noire'), compagnon('dragon'), fond('dragon'), fond('nuit'), objet('bombe')]) {
    assert.equal(refusDeLEnvie(e, RIEN, JOUR), NE_SE_VEND_PAS, ecrireEnvie(e))
  }

  // Déjà à lui — et seulement de la même sorte : un fond nommé comme un de ses thèmes se vise encore.
  const sien = { themes: ['velours', 'ivoire', 'cahier'], compagnons: ['loup'], fonds: ['jazz'] }
  assert.equal(refusDeLEnvie(theme('cahier'), sien, JOUR), 'Cahier d’écolier est déjà à toi.')
  assert.equal(refusDeLEnvie(compagnon('loup'), sien, JOUR), 'Ce compagnon est déjà à toi.')
  assert.equal(refusDeLEnvie(fond('jazz'), sien, JOUR), 'Ce fond est déjà à toi.')
  assert.equal(refusDeLEnvie(theme('carnet'), sien, JOUR), null)
  assert.equal(refusDeLEnvie(compagnon('chat'), sien, JOUR), null)
  assert.equal(refusDeLEnvie(fond('savane'), sien, JOUR), null)
  assert.equal(refusDeLEnvie(fond('cahier'), { ...sien, fonds: [] }, JOUR), NE_SE_VEND_PAS)
  // Un objet se rachète : on n'en « a » jamais assez pour ne plus en vouloir.
  assert.equal(refusDeLEnvie(objet('sablier'), sien, JOUR), null)

  // Hors de sa saison, le refus dit quand il revient.
  assert.equal(refusDeLEnvie(theme('halloween'), RIEN, JOUR), 'Halloween n’est en boutique que du 25 octobre au 1er novembre : choisis-en un autre.')
  assert.equal(refusDeLEnvie(theme('halloween'), RIEN, '2026-10-25'), null)
  assert.equal(refusDeLEnvie(theme('halloween'), RIEN, '2026-11-01'), null)
  assert.match(refusDeLEnvie(theme('halloween'), RIEN, '2026-11-02')!, /^Halloween n’est en boutique que /)
  // « que » s'élide devant la période : « que en février » se lisait sur trois thèmes de saison sur six.
  assert.equal(refusDeLEnvie(theme('carnaval'), RIEN, JOUR), 'Carnaval n’est en boutique qu’en février : choisis-en un autre.')
  assert.equal(refusDeLEnvie(theme('plage'), RIEN, JOUR), 'Plage n’est en boutique qu’en juillet et en août : choisis-en un autre.')
  assert.equal(refusDeLEnvie(theme('neige'), RIEN, JOUR), 'Neige n’est en boutique que du 20 au 26 décembre : choisis-en un autre.')
  for (const t of THEMES.filter(x => x.saison)) assert.doesNotMatch(refusDeLEnvie(theme(t.key), RIEN, '2026-03-15') ?? '', / que [aeiouy]/i, t.key)
  // Acheté pendant sa saison, il est à lui toute l'année : c'est ce que le refus dit.
  assert.equal(refusDeLEnvie(theme('halloween'), { ...RIEN, themes: ['halloween'] }, JOUR), 'Halloween est déjà à toi.')
})

test('l’envie qu’on lui montre : celle qu’il a posée, tant qu’elle tient', () => {
  assert.equal(envieTenue(null, RIEN, JOUR), null)
  assert.equal(envieTenue(undefined, RIEN, JOUR), null)
  assert.deepEqual(envieTenue(theme('cahier'), RIEN, JOUR), theme('cahier'))
  assert.equal(envieTenue(theme('cahier'), { ...RIEN, themes: ['cahier'] }, JOUR), null, 'achetée')
  assert.equal(envieTenue(theme('halloween'), RIEN, '2026-11-02'), null, 'sortie de sa saison')
  // Rien ne s'efface : la même envie se remontre quand sa saison revient.
  assert.deepEqual(envieTenue(theme('halloween'), RIEN, '2027-10-25'), theme('halloween'))
  assert.deepEqual(envieTenue(objet('eclat'), { themes: ['cahier'], compagnons: ['loup'], fonds: ['jazz'] }, JOUR), objet('eclat'))
})

test('où il en est : ce qu’elle coûte, ce qui manque, sa part économisée', () => {
  const cahier = theme('cahier')
  const prix = PRIX_DES_THEMES.commune
  assert.deepEqual(ouEnEstLEnvie(cahier, 0), { prix, manque: prix, part: 0 })
  assert.deepEqual(ouEnEstLEnvie(cahier, prix / 2), { prix, manque: prix / 2, part: 50 })
  // Une soirée retirée a fait passer son solde sous zéro : rien d'économisé, et sa dette à rattraper en plus.
  assert.deepEqual(ouEnEstLEnvie(cahier, -20), { prix, manque: prix + 20, part: 0 })
  // Au-dessus du prix : il l'a, pas plus.
  assert.deepEqual(ouEnEstLEnvie(cahier, prix), { prix, manque: 0, part: 100 })
  assert.deepEqual(ouEnEstLEnvie(cahier, prix + 500), { prix, manque: 0, part: 100 })
  // Jamais cent tant qu'il manque un confetti.
  assert.deepEqual(ouEnEstLEnvie(objet('eclat'), PRIX_D_UN_ECLAT - 1), { prix: PRIX_D_UN_ECLAT, manque: 1, part: 99 })
  assert.equal(ouEnEstLEnvie(theme('babel'), 5000), null, 'ce qui ne se vend pas n’a pas de prix')
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Le 29 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 29, 8, 0)

async function avecBanc(scenario: (banc: Banc, horloge: { t: number }) => Promise<void>) {
  const horloge = { t: DEBUT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
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

/** Ce que la colonne garde : `undefined` quand le profil n'a plus de ligne. */
const enColonne = (banc: Banc, profileId: string) =>
  enBase(banc, db => (db.prepare('SELECT envie FROM profiles WHERE id = ?').get(profileId) as { envie: string | null } | undefined)?.envie)

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, jour: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, ?, 1, 0)`)
      .run(profileId, jour, justes),
  )
}

const repondu = async (r: Response) => ({ status: r.status, cache: r.headers.get('cache-control'), corps: (await r.json()) as any })
/** Le corps tel quel : une page qui enverrait autre chose qu'une envie. */
const envoyer = (banc: Banc, cookie: string | undefined, corps: unknown) => ecrire(banc.url, '/api/joueur/envie', corps, cookie, 'PUT').then(repondu)
const poser = (banc: Banc, cookie: string | undefined, envie: Envie | null) => envoyer(banc, cookie, { envie })
const acheter = (banc: Banc, cookie: string, chemin: 'themes' | 'compagnons' | 'fonds' | 'eclat', corps: object) => ecrire(banc.url, `/api/joueur/${chemin}`, corps, cookie).then(repondu)
/** Sa boutique, telle que sa page la lit — ou son accueil. */
const boutique = async (banc: Banc, cookie: string, accueil = false) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi${accueil ? '?accueil' : ''}`, { headers: { Cookie: cookie } })).json()) as any).profile.boutique

test('poser son envie, la remplacer, la retirer : la route la rend, et sa boutique relue aussi', () =>
  avecBanc(async banc => {
    const sansProfil = await poser(banc, undefined, theme('cahier'))
    assert.equal(sansProfil.status, 401, 'sans profil, pas d’envie')
    assert.equal(sansProfil.corps.error, 'Connexion requise')

    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const [idAlice, idBob] = [idDe(banc, 'alice'), idDe(banc, 'bob')]
    // Sans envie, le champ est absent — pas même nul : `themes.test.ts` compare la boutique d'un profil neuf champ pour champ.
    assert.equal('envie' in (await boutique(banc, alice)), false)
    assert.equal(enColonne(banc, idAlice), null)

    // Posée sans un confetti : on économise pour elle.
    const posee = await poser(banc, alice, theme('cahier'))
    assert.equal(posee.status, 200, posee.corps.error)
    assert.equal(posee.cache, 'no-store')
    assert.deepEqual(posee.corps, { envie: { sorte: 'theme', cle: 'cahier' } })
    assert.deepEqual((await boutique(banc, alice)).envie, { sorte: 'theme', cle: 'cahier' })
    assert.deepEqual((await boutique(banc, alice, true)).envie, { sorte: 'theme', cle: 'cahier' }, 'son accueil la lit aussi')
    assert.equal(enColonne(banc, idAlice), 'theme:cahier')

    // Une à la fois : la nouvelle remplace l'ancienne.
    assert.deepEqual((await poser(banc, bob, fond('jazz'))).corps, { envie: { sorte: 'fond', cle: 'jazz' } })
    assert.deepEqual((await poser(banc, alice, compagnon('loup'))).corps, { envie: { sorte: 'compagnon', cle: 'loup' } })
    assert.deepEqual((await boutique(banc, alice)).envie, { sorte: 'compagnon', cle: 'loup' })
    assert.equal(enColonne(banc, idAlice), 'compagnon:loup')
    // De ce que la page envoie, la sorte et la clé seulement.
    assert.deepEqual((await envoyer(banc, alice, { envie: { sorte: 'objet', cle: 'sablier', prix: 1 }, porter: true })).corps, { envie: { sorte: 'objet', cle: 'sablier' } })
    assert.equal(enColonne(banc, idAlice), 'objet:sablier')

    // Relue après un redémarrage : elle vit dans la base permanente.
    await banc.redemarrer()
    assert.deepEqual((await boutique(banc, alice)).envie, { sorte: 'objet', cle: 'sablier' })

    // Retirée : la colonne se vide, la boutique ne la porte plus.
    const retiree = await poser(banc, alice, null)
    assert.equal(retiree.status, 200, retiree.corps.error)
    assert.deepEqual(retiree.corps, { envie: null })
    assert.equal('envie' in (await boutique(banc, alice)), false)
    assert.equal('envie' in (await boutique(banc, alice, true)), false)
    assert.equal(enColonne(banc, idAlice), null)
    // Retirer ce qu'on n'a pas posé n'est pas une erreur : un second onglet l'a déjà fait.
    assert.deepEqual((await poser(banc, alice, null)).corps, { envie: null })

    // Rien de tout cela n'a touché celle de Bob.
    assert.deepEqual((await boutique(banc, bob)).envie, { sorte: 'fond', cle: 'jazz' })
    assert.equal(enColonne(banc, idBob), 'fond:jazz')

    // Son profil supprimé, elle part avec sa ligne : rien d'autre ne la garde.
    await poser(banc, alice, theme('carnet'))
    const admin = await connexionAnimateur(banc.url)
    const suppression = await fetch(`${banc.url}/api/admin/profils/${idAlice}`, { method: 'DELETE', headers: { Cookie: admin, 'X-Requested-With': 'quizz' } })
    assert.equal(suppression.status, 200)
    assert.equal(enColonne(banc, idAlice), undefined)
    assert.equal(enBase(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profiles WHERE envie = 'theme:carnet'`).get() as { n: number }).n), 0)
    assert.equal(enColonne(banc, idBob), 'fond:jazz')
  }))

test('une envie qui ne tient pas se refuse en 400, en clair — et celle d’avant reste', () =>
  avecBanc(async (banc, horloge) => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 2000)
    assert.equal((await poser(banc, cookie, theme('carnet'))).status, 200)
    const refus = async (corps: unknown, message: string) => {
      const r = await envoyer(banc, cookie, corps)
      assert.equal(r.status, 400, JSON.stringify(corps))
      assert.equal(r.corps.error, message, JSON.stringify(corps))
      assert.equal(enColonne(banc, alice), 'theme:carnet', `${JSON.stringify(corps)} : l’envie d’avant reste`)
    }

    // Un article qui n'existe pas, ou qui ne se vend pas : offert, gagné, du trésor, hérité de tout objet.
    for (const e of [theme('licorne-noire'), theme('ivoire'), theme('babel'), compagnon('dragon'), fond('dragon'), fond('nuit'), objet('bombe'), objet('constructor')]) {
      await refus({ envie: e }, NE_SE_VEND_PAS)
    }
    // Ce qui n'a pas la forme d'une envie se refuse de la même phrase. Seul un `null` écrit en toutes lettres retire :
    // une page qui oublierait le champ n'efface pas son envie.
    for (const corps of [{}, { envie: undefined }, { envie: 'n’importe quoi' }, { envie: 42 }, { envie: [] }, { envie: { sorte: 'gerbe', cle: 'confettis' } }, { envie: { sorte: 'theme', cle: 'Aurore' } }, { envie: { sorte: 'theme' } }]) {
      await refus(corps, NE_SE_VEND_PAS)
    }

    // Hors de sa saison, le 29 septembre : le refus dit quand il revient.
    await refus({ envie: theme('halloween') }, 'Halloween n’est en boutique que du 25 octobre au 1er novembre : choisis-en un autre.')

    // Ce qu'il a déjà : un thème acheté, un compagnon adopté, un fond acheté.
    assert.equal((await acheter(banc, cookie, 'themes', { theme: 'cahier', porter: false })).status, 200)
    assert.equal((await acheter(banc, cookie, 'compagnons', { compagnon: 'loup' })).status, 200)
    assert.equal((await acheter(banc, cookie, 'fonds', { fond: 'jazz', porter: false })).status, 200)
    await refus({ envie: theme('cahier') }, 'Cahier d’écolier est déjà à toi.')
    await refus({ envie: compagnon('loup') }, 'Ce compagnon est déjà à toi.')
    await refus({ envie: fond('jazz') }, 'Ce fond est déjà à toi.')
    // Ses voisins de catalogue se visent toujours.
    assert.equal((await poser(banc, cookie, compagnon('chat'))).status, 200)
    assert.equal((await poser(banc, cookie, fond('savane'))).status, 200)

    // Le 26 octobre, Halloween est en boutique : l'envie tient.
    horloge.t = Date.UTC(2026, 9, 26, 9, 0)
    assert.deepEqual((await poser(banc, cookie, theme('halloween'))).corps, { envie: { sorte: 'theme', cle: 'halloween' } })
    assert.deepEqual((await boutique(banc, cookie)).envie, { sorte: 'theme', cle: 'halloween' })
    // Le 2 novembre, sa saison est passée : la boutique ne la montre plus — et rien ne s'est effacé.
    horloge.t = Date.UTC(2026, 10, 2, 9, 0)
    const apres = await boutique(banc, cookie)
    assert.equal(apres.jour, '2026-11-02')
    assert.equal('envie' in apres, false)
    assert.equal('envie' in (await boutique(banc, cookie, true)), false)
    assert.equal(enColonne(banc, alice), 'theme:halloween')
  }))

test('achetée, son envie ne part plus avec la boutique que rend l’achat ; un autre achat la laisse', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, '2026-09-20', 6000)

    // Un thème : celui qu'on n'a pas visé laisse l'envie, que la route d'achat rend avec sa boutique ; le sien l'ôte.
    assert.equal((await poser(banc, cookie, theme('cahier'))).status, 200)
    const autre = await acheter(banc, cookie, 'themes', { theme: 'carnet', porter: false })
    assert.equal(autre.status, 200, autre.corps.error)
    assert.deepEqual(autre.corps.boutique.envie, { sorte: 'theme', cle: 'cahier' })
    const leSien = await acheter(banc, cookie, 'themes', { theme: 'cahier', porter: false })
    assert.equal(leSien.status, 200, leSien.corps.error)
    assert.ok(leSien.corps.boutique.possedes.includes('cahier'))
    assert.equal('envie' in leSien.corps.boutique, false)
    assert.equal('envie' in (await boutique(banc, cookie)), false)
    // Une dérivation : rien ne s'est effacé, et rien n'avait à l'être.
    assert.equal(enColonne(banc, alice), 'theme:cahier')

    // Un compagnon.
    assert.equal((await poser(banc, cookie, compagnon('loup'))).status, 200)
    assert.deepEqual((await acheter(banc, cookie, 'fonds', { fond: 'savane', porter: false })).corps.boutique.envie, { sorte: 'compagnon', cle: 'loup' })
    const adopte = await acheter(banc, cookie, 'compagnons', { compagnon: 'loup' })
    assert.equal(adopte.status, 200, adopte.corps.error)
    assert.equal('envie' in adopte.corps.boutique, false)

    // Un fond des savoirs.
    assert.equal((await poser(banc, cookie, fond('jazz'))).status, 200)
    assert.deepEqual((await acheter(banc, cookie, 'compagnons', { compagnon: 'chat', installer: false })).corps.boutique.envie, { sorte: 'fond', cle: 'jazz' })
    const achete = await acheter(banc, cookie, 'fonds', { fond: 'jazz', porter: false })
    assert.equal(achete.status, 200, achete.corps.error)
    assert.equal('envie' in achete.corps.boutique, false)
    assert.equal('envie' in (await boutique(banc, cookie, true)), false)

    // Un objet du comptoir se rachète : son envie tient après l'achat, tant que la page ne la retire pas.
    assert.equal((await poser(banc, cookie, objet('eclat'))).status, 200)
    const eclat = await acheter(banc, cookie, 'eclat', {})
    assert.equal(eclat.status, 200, eclat.corps.error)
    assert.equal(eclat.corps.enReserve, 1)
    assert.deepEqual((await boutique(banc, cookie)).envie, { sorte: 'objet', cle: 'eclat' })
  }))

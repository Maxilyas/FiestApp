// Un légendaire offert (`Legendaire.offert`, le 26 novembre 2026 : « je voulais
// lui donner uniquement un légendaire en cadeau », le propriétaire, pour un
// anniversaire — le Grand Prix gardé pour une autre) : il ne se gagne pas, il
// s'offre du QG, à un seul profil, avec un mot que son accueil dit une fois.
// Il n'en existe qu'un exemplaire ; personne d'autre ne le voit à gagner, ni
// ne peut le porter ; un Grand Prix ne le met jamais en jeu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import type { ProfilDAccueil } from '../../shared/profil'
import type { JournalDuQg } from '../../shared/qg'
import {
  LEGENDAIRES,
  LEGENDAIRES_OFFERTS,
  PRIX_DES_GRANDS_PRIX,
  cleDuCadeau,
  estUneVoieRangee,
  legendaire,
  legendairesDebloques,
  legendairesVisibles,
  voiesDe,
} from '../../shared/legendaires'

const CADEAU = 'lg:jormungandr'

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))
const faire = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}, method = 'POST') =>
  ecrire(banc.url, chemin, corps, cookie, method).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const idDe = async (banc: Banc, cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string
const accueil = async (banc: Banc, cookie: string) => (await lire<{ profile: ProfilDAccueil }>(banc, cookie, '/api/joueur/moi?accueil')).corps.profile
const porter = (banc: Banc, cookie: string, cle: string) => faire(banc, cookie, '/api/joueur/moi', { legendaire: cle }, 'PUT')

test('le catalogue : un légendaire offert est secret, n’a que sa voie de cadeau, et ne se met jamais en jeu', () => {
  assert.deepEqual([...LEGENDAIRES_OFFERTS], [CADEAU])
  for (const cle of LEGENDAIRES_OFFERTS) {
    const l = legendaire(cle)!
    assert.ok(l.secret, `${cle} : secret, personne ne le voit à gagner`)
    assert.deepEqual(voiesDe(l), [{ hautFait: cleDuCadeau(cle), fois: 1 }], `${cle} : sa seule voie, le cadeau`)
    assert.ok(!PRIX_DES_GRANDS_PRIX.includes(cle), `${cle} : jamais le prix d'un Grand Prix`)
    assert.ok(estUneVoieRangee(cleDuCadeau(cle)), 'sa voie se tait sur l’étagère et au compte des badges')
  }
  // Ni dans l'album de qui ne l'a pas, ni dans ce qui dit « à gagner » ; à qui l'a, comme les autres.
  assert.ok(!legendairesVisibles([]).some(l => l.key === CADEAU))
  assert.ok(legendairesVisibles([CADEAU]).some(l => l.key === CADEAU))
  assert.deepEqual(
    legendairesDebloques(new Map([[cleDuCadeau(CADEAU), 1]])).filter(cle => LEGENDAIRES_OFFERTS.includes(cle)),
    [CADEAU],
  )
  assert.ok(LEGENDAIRES.some(l => l.key === CADEAU))
})

test('offrir un légendaire : il est à lui seul, son accueil le dit une fois avec le mot, et il le porte — un seul exemplaire', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [leaId, tomId] = [await idDe(banc, lea), await idDe(banc, tom)]

    // Avant : personne ne peut le porter.
    assert.equal((await porter(banc, lea, CADEAU)).status, 400)

    const refus = await faire(banc, admin, `/api/admin/profils/${leaId}/legendaire`, { legendaire: 'lg:phenix' })
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /ne s’offre pas/)

    const don = await faire(banc, admin, `/api/admin/profils/${leaId}/legendaire`, { legendaire: CADEAU, mot: '  Joyeux   anniversaire !  ' })
    assert.equal(don.status, 200, don.corps.error)
    assert.deepEqual([don.corps.legendaire, don.corps.mot], [CADEAU, 'Joyeux anniversaire !'])

    // Son accueil le lui dit, le mot compris.
    const annonces = (await accueil(banc, lea)).annonces ?? []
    assert.deepEqual(
      annonces.map(a => (a.sorte === 'legendaire' ? [a.sorte, a.legendaire, a.mot] : [a.sorte])),
      [['legendaire', CADEAU, 'Joyeux anniversaire !']],
    )
    // Et rien chez Tom.
    assert.ok(!((await accueil(banc, tom)).annonces ?? []).some(a => a.sorte === 'legendaire'))

    // Il le porte ; Tom, non.
    const porte = await porter(banc, lea, CADEAU)
    assert.equal(porte.status, 200, porte.corps.error)
    assert.equal(porte.corps.profile.legendaire, CADEAU)
    assert.equal((await porter(banc, tom, CADEAU)).status, 400)

    // Un seul exemplaire : ni à Tom, ni deux fois à Léa.
    const second = await faire(banc, admin, `/api/admin/profils/${tomId}/legendaire`, { legendaire: CADEAU })
    assert.equal(second.status, 400)
    assert.match(second.corps.error, /un exemplaire/)
    assert.match((await faire(banc, admin, `/api/admin/profils/${leaId}/legendaire`, { legendaire: CADEAU })).corps.error, /déjà/)

    // Le journal le note, sur son profil.
    const gestes = (await lire<JournalDuQg>(banc, admin, `/api/admin/gestes?cible=${leaId}`)).corps.gestes.map(g => g.resume)
    assert.deepEqual(gestes, ['Jörmungandr offert : Léa (@lea) — « Joyeux anniversaire ! »'])

    // Au réveil, il est toujours à elle : sa voie vit dans la base permanente.
    await banc.redemarrer()
    const encore = await porter(banc, lea, CADEAU)
    assert.equal(encore.status, 200, encore.corps.error)
    assert.equal(encore.corps.profile.legendaire, CADEAU)
  } finally {
    await banc.close()
  }
})

test('un légendaire offert : jamais à un suspendu, jamais à soi — et son profil supprimé, il peut s’offrir de nouveau', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [leaId, tomId] = [await idDe(banc, lea), await idDe(banc, tom)]

    assert.equal((await faire(banc, admin, `/api/admin/profils/${tomId}/suspendre`)).status, 200)
    assert.match((await faire(banc, admin, `/api/admin/profils/${tomId}/legendaire`, { legendaire: CADEAU })).corps.error, /Réactive/)

    // L'administrateur tient son espace avec son profil : il ne se l'offre pas, il n'en existe qu'un.
    const sien = await inscrireProfil(banc.url, 'antoine-joue', 'Antoine', '🦁')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, admin)).status, 200)
    const sienId = await idDe(banc, sien)
    assert.match((await faire(banc, admin, `/api/admin/profils/${sienId}/legendaire`, { legendaire: CADEAU })).corps.error, /pour soi/)

    // Offert à Léa, puis son profil supprimé : sa voie part avec lui, et il s'offre à Tom réactivé.
    assert.equal((await faire(banc, admin, `/api/admin/profils/${leaId}/legendaire`, { legendaire: CADEAU })).status, 200)
    assert.equal((await ecrire(banc.url, `/api/admin/profils/${leaId}`, {}, admin, 'DELETE')).status, 200)
    assert.equal((await faire(banc, admin, `/api/admin/profils/${tomId}/reactiver`)).status, 200)
    const don = await faire(banc, admin, `/api/admin/profils/${tomId}/legendaire`, { legendaire: CADEAU })
    assert.equal(don.status, 200, don.corps.error)
    // Suspendu, il avait perdu ses sessions : il se reconnecte.
    const tomRevenu = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: 'tom', password: 'motdepasse1' }), 'qz_joueur')
    assert.deepEqual(((await accueil(banc, tomRevenu)).annonces ?? []).map(a => a.sorte), ['legendaire'])
    void tom
  } finally {
    await banc.close()
  }
})

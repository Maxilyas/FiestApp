// La traversée par ses routes, sur un vrai serveur (`bancDuCabinet`) : un
// profil seulement, trois cartes pour partir, une seule en route ; aller vers
// une épreuve y entre — sa partie est une partie du Cabinet, à l'origine
// `traversee`, avec ses cartes et ce qu'elle vaut déjà à la traversée ; finie,
// elle se conclut à la lecture suivante ; le rang, les refus en mots, le
// cloisonnement, la relecture après un redémarrage ; le légendaire choisi au
// bout, rangé sur l'étagère. L'or, les cœurs et les gardiens en détail :
// `cabinet-traversee.test.ts`, en pur.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import { aLaMain, bancDuCabinet, enBase, fermerLesMagasins, jouer, jouerUnEclair, lire, ok, poster, type BancDuCabinet } from './cabinet-banc'
import { CABINET_SANS_PROFIL } from '../src/cabinet'
import { GESTE_PASSE_EN_ROUTE, TRAVERSEE_EN_ROUTE, TRAVERSEE_INTROUVABLE } from '../src/core/cabinet/magasin'
import * as B from '../../shared/cabinet/bareme'
import { lireLeDepart } from '../../shared/cabinet/lecture'
import {
  CHOISIS_TROIS_CARTES,
  EPREUVE_EN_COURS,
  PAS_PAR_LA,
  VERSION_DE_LA_TRAVERSEE,
  etatDeLaTraversee,
  idDEtape,
  tracerLaCarte,
  type DepartDeLaTraversee,
  type EtatDeLaTraversee,
  type GesteDeLaTraversee,
} from '../../shared/cabinet/traversee'
import type { PageDeLaTraversee, VueDeLaPartie, VueDeLaTraversee } from '../../shared/cabinet/vues'

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

let n = 0
const unProfil = () => inscrireProfil(b.banc.url, `voyageur${++n}`, `Voyageur ${n}`)
const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const laPage = (cookie: string | undefined) => lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee')
const commencer = (cookie: string) => poster<PageDeLaTraversee & { error?: string }>(b, cookie, '/api/cabinet/traversee', {})
const geste = (cookie: string, t: Pick<VueDeLaTraversee, 'id' | 'rang'>, g: Record<string, unknown>) =>
  poster<PageDeLaTraversee & { error?: string; page?: PageDeLaTraversee }>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: g })
/** Une traversée qui commence, ses trois cartes choisies : la page d'après. */
async function partir(cookie: string, cartes: string[]): Promise<PageDeLaTraversee> {
  const t = ok(await commencer(cookie), 'le départ').traversee!
  return ok(await geste(cookie, t, { quoi: 'cartes', cartes }), 'les cartes')
}

/**
 * Une traversée écrite à la main jusqu'à ce que `arret` dise stop : ses gestes rejoués par le pli, comme le serveur les aurait
 * écrits — ses épreuves conclues sans faute, chaque amélioration offerte à la première carte qui peut monter. Rend son départ.
 * À la version 1, comme celle du légendaire plus bas : une traversée commencée avant la version 2 se sert encore, à ses chiffres.
 */
function traverseeALaMain(profil: string, gardiens: [string, string, string], arret: (e: EtatDeLaTraversee) => boolean): DepartDeLaTraversee {
  let x = 1
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const depart: DepartDeLaTraversee = { v: 1, jour: '2026-10-24', actes: tracerLaCarte(hasard, gardiens, { epingle: ['Rome'], frise: ['Rome'] }) }
  const gestes: GesteDeLaTraversee[] = [{ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }]
  const etat = () =>
    etatDeLaTraversee(
      depart,
      gestes.map(geste => ({ geste, faitLe: 0 })),
    )
  let e = etat()
  let p = 0
  while (!arret(e)) {
    if (e.ameliorations > 0) gestes.push({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 3)!.cle })
    else {
      const ici = depart.actes[e.acte].etapes
      const suivantes = e.ou.sorte === 'gardien' ? [e.ou.etape] : ici.find(s => s.id === e.position)!.suivantes
      const etape = ici.find(s => s.id === (suivantes.find(id => ici.find(s => s.id === id)?.sorte === 'epreuve') ?? suivantes[0]))!
      if (etape.sorte === 'coffre' || etape.sorte === 'marchand') gestes.push({ quoi: 'aller', etape: etape.id })
      else {
        const partie = `fausse-${profil}-${++p}`
        gestes.push({ quoi: 'epreuve', etape: etape.id, partie }, { quoi: 'conclure', partie, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })) })
      }
    }
    e = etat()
  }
  assert.equal(e.ignores, 0)
  const id = `traversee-a-la-main-${profil}`
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  aLaMain(
    b.fichier,
    [
      `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(depart))}, 1)`,
      ...gestes.map((g, k) => `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, ${k + 1}, ${q(JSON.stringify(g))}, ${k + 2}, 'u${k}')`),
    ].join(';\n'),
  )
  return depart
}

test('la traversée : un profil seulement, ses gardiens d’abord, trois cartes pour partir, une seule en route', async () => {
  const anonyme = await laPage(undefined)
  assert.equal(anonyme.status, 401)
  assert.deepEqual(anonyme.corps, { error: CABINET_SANS_PROFIL })
  const cookie = await unProfil()
  const vide = ok(await laPage(cookie), 'la page')
  assert.equal(vide.traversee, null)
  assert.equal((await laPage(cookie)).entetes.get('cache-control'), 'no-store')
  // Elle naît devant ses trois gardiens, ses cartes à choisir.
  const neuve = ok(await commencer(cookie), 'le départ').traversee!
  assert.equal(neuve.ou.sorte, 'cartes')
  assert.equal(neuve.actes.length, B.ACTES_D_UNE_TRAVERSEE)
  assert.deepEqual(neuve.atteignables, [])
  for (const casse of [['parade'], ['parade', 'parade', 'cagnotte'], ['parade', 'cagnotte', 'bastion']]) {
    const r = await geste(cookie, neuve, { quoi: 'cartes', cartes: casse })
    assert.equal(r.status, 400, JSON.stringify(casse))
    assert.equal(r.corps.error, CHOISIS_TROIS_CARTES)
  }
  const page = ok(await geste(cookie, neuve, { quoi: 'cartes', cartes: ['coup-d-oeil', 'cagnotte', 'panacee'] }), 'les cartes')
  const t = page.traversee!
  assert.equal(t.rang, 2)
  assert.equal(t.coeurs, B.COEURS_DE_DEPART + B.COEURS_DE_LA_PANACEE[1])
  assert.equal(t.or, 0)
  assert.deepEqual(
    t.cartes.map(c => [c.cle, c.niveau]),
    [
      ['coup-d-oeil', 1],
      ['cagnotte', 1],
      ['panacee', 1],
    ],
  )
  assert.deepEqual(t.atteignables, [0, 1, 2].map(c => idDEtape(0, 1, c)))
  assert.ok(t.actes.every(a => a.gardien.startsWith('lg:')))
  // Sa version — la page en lit le barème —, et le marchand d'avance : un cœur, chaque carte à son prix, vers la carte +.
  assert.equal(t.v, VERSION_DE_LA_TRAVERSEE)
  const versLePlus = B.PRIX_DU_MARCHAND.amelioration
  assert.deepEqual(t.prix, { coeur: B.PRIX_DU_MARCHAND.coeur, cartes: { 'coup-d-oeil': versLePlus, cagnotte: versLePlus, panacee: versLePlus } })
  assert.deepEqual(t.offrables, ['coup-d-oeil', 'cagnotte', 'panacee'], 'une amélioration offerte les prendrait toutes')
  // Une seule en route : la base le recompte.
  const encore = await commencer(cookie)
  assert.equal(encore.status, 400)
  assert.equal(encore.corps.error, TRAVERSEE_EN_ROUTE)
  assert.equal(enBase(b.fichier, db => (db.prepare('SELECT COUNT(*) AS n FROM cabinet_traversees').get() as { n: number }).n) >= 1, true)
})

test('aller vers une épreuve y entre : sa partie, ses cartes, ce qu’elle vaut déjà ; quittée, elle se conclut et coûte ses cœurs', async () => {
  const cookie = await unProfil()
  const t = (await partir(cookie, ['coup-d-oeil', 'echange', 'panacee'])).traversee!
  // Un chemin qui ne part pas d'ici se refuse en mots.
  const loin = await geste(cookie, t, { quoi: 'aller', etape: idDEtape(0, 2, 0) })
  assert.equal(loin.status, 400)
  assert.equal(loin.corps.error, PAS_PAR_LA)
  const etape = t.actes[0].etapes.find(e => e.id === t.atteignables.find(id => t.actes[0].etapes.find(x => x.id === id)?.sorte === 'epreuve'))!
  // La carte se tire au hasard du serveur : un Quiz s'y ouvre sur l'un de ses thèmes au choix (`cabinet-quiz.test.ts`).
  const entree = ok(await geste(cookie, t, { quoi: 'aller', etape: etape.id, ...(etape.choix && { theme: 0 }) }), 'l’entrée').traversee!
  assert.equal(entree.ou.sorte, 'epreuve')
  const partie = entree.partie!
  assert.ok(partie, 'la page d’après porte sa partie')
  assert.equal(partie.origine, 'traversee')
  assert.equal(partie.jeu, etape.jeu)
  assert.equal(partie.carte, null, 'pas de carte-bonus : ses cartes')
  // Les deux cartes qui jouent dans une manche y passent, à la force de leur niveau ; la Panacée reste à la traversée.
  assert.deepEqual(
    partie.cartes?.map(c => [c.cle, c.pouvoir, c.force]),
    [
      ['coup-d-oeil', 'eclairer', 1],
      ['echange', 'changer', 1],
    ],
  )
  assert.equal(partie.traversee?.coeurs, entree.coeurs)
  assert.deepEqual(partie.traversee?.siTuQuittes, { coeurs: 3, perdue: false }, 'quitter compte les trois manches ratées')
  // Le départ en base : la version 3, l'épreuve et sa traversée, ses cartes — jamais une carte-bonus.
  const depart = enBase(b.fichier, db => lireLeDepart((db.prepare('SELECT cabinet FROM campagne_series WHERE id = ?').get(partie.id) as { cabinet: string }).cabinet))!
  assert.equal(depart.v, 3)
  assert.deepEqual(depart.traversee, { id: t.id, etape: etape.id, assaut: 0 })
  assert.equal(depart.payee, false)
  // Rien d'autre pendant l'épreuve.
  const ailleurs = await geste(cookie, entree, { quoi: 'abandonner' })
  assert.equal(ailleurs.corps.error, EPREUVE_EN_COURS)
  // Quittée d'emblée : la partie finie, la page suivante la conclut.
  ok(await jouer(b, cookie, partie as VueDeLaPartie, { quoi: 'quitter' }), 'quitter')
  const apres = ok(await laPage(cookie), 'la page d’après').traversee!
  assert.equal(apres.ou.sorte, 'carte')
  assert.equal(apres.epreuves, 1)
  assert.equal(apres.coeurs, entree.coeurs - 3)
  assert.equal(apres.derniere?.coeurs, 3)
  assert.equal(apres.partie, undefined)
  assert.equal(apres.rang, entree.rang + 1, 'le geste `conclure`, écrit par le serveur')
  // Le rang : un geste d'avant la conclusion est passé, et rend la page d'à présent.
  const passe = await geste(cookie, entree, { quoi: 'abandonner' })
  assert.equal(passe.status, 409)
  assert.equal(passe.corps.error, GESTE_PASSE_EN_ROUTE)
  assert.equal(passe.corps.page?.traversee?.rang, apres.rang)
})

test('une traversée se cloisonne au profil, se relit après un redémarrage, et s’abandonne', async () => {
  const cookie = await unProfil()
  const autre = await unProfil()
  const t = (await partir(cookie, ['parade', 'pourboire', 'coup-de-grace'])).traversee!
  const intruse = await geste(autre, t, { quoi: 'abandonner' })
  assert.equal(intruse.status, 404)
  assert.equal(intruse.corps.error, TRAVERSEE_INTROUVABLE)
  await b.banc.redemarrer()
  const relue = ok(await laPage(cookie), 'relue').traversee!
  assert.deepEqual(relue.actes, t.actes, 'la carte figée')
  assert.equal(relue.rang, t.rang)
  const finie = ok(await geste(cookie, relue, { quoi: 'abandonner' }), 'abandonner').traversee!
  assert.equal(finie.fin?.issue, 'abandonnee')
  assert.equal(enBase(b.fichier, db => (db.prepare('SELECT issue FROM cabinet_traversees WHERE id = ?').get(t.id) as { issue: string }).issue), 'abandonnee')
  // Une autre peut commencer.
  await partir(cookie, ['parade', 'pourboire', 'coup-de-grace'])
})

test('le gardien à terre avant la dernière manche : l’épreuve se quitte et se conclut à la lecture suivante, même sans « Quitter » de la page', async () => {
  // Le retour du propriétaire, le 1er novembre 2026 : « parfois, lorsque l'on réussit le défi, ça nous fait toujours “reprendre
  // l'épreuve” ». Le gardien tombé, les manches qui restent ne comptent plus : la page envoie « quitter » d'elle-même (« Le gardien
  // tombe ! ») — un autre geste encore en vol, le réseau, l'onglet fermé, et il ne partait pas : l'épreuve restait ouverte, et la
  // carte la proposait à reprendre.
  const cookie = await unProfil()
  const depart = traverseeALaMain(await idDe(cookie), ['lg:renard', 'lg:sphinx', 'lg:dragon'], e => e.ou.sorte === 'marchand')
  const gardien = depart.actes[0].etapes.find(s => s.sorte === 'gardien')!.id
  const devant = ok(await laPage(cookie), 'la page').traversee!
  assert.equal(devant.ou.sorte, 'marchand')
  let partie = ok(await geste(cookie, devant, { quoi: 'aller', etape: gardien }), 'l’assaut').traversee!.partie! as VueDeLaPartie
  assert.equal(partie.jeu, 'eclair', 'le premier assaut du Renard')
  // Deux manches parfaites : six étoiles, les six points de vie du gardien de l'acte I.
  partie = await jouerUnEclair(b, cookie, partie, 0)
  partie = ok(await jouer(b, cookie, partie, { quoi: 'ouvrir', manche: 1 }), 'la deuxième manche')
  partie = await jouerUnEclair(b, cookie, partie, 1)
  assert.equal(partie.traversee?.fin, 'vaincu', 'la page le dit : « Le gardien tombe ! »')
  assert.equal(partie.phase, 'revele', 'une manche reste, qui ne compte plus')
  // La page ne quitte pas : la lecture suivante le fait pour elle, et conclut l'épreuve.
  const apres = ok(await laPage(cookie), 'la page d’après').traversee!
  assert.equal(apres.partie, undefined, 'plus d’épreuve à reprendre')
  assert.notEqual(apres.ou.sorte, 'gardien')
  assert.equal(apres.derniere?.vaincu, true)
  assert.deepEqual(apres.vaincus, ['lg:renard'])
  // Le « quitter » de la page, arrivé après : la partie est finie, il est passé — rien ne se joue deux fois.
  const tardif = await jouer(b, cookie, partie, { quoi: 'quitter' })
  assert.equal(tardif.status, 409)
})

test('au bout des trois actes, le légendaire choisi se range sur son étagère', async () => {
  const cookie = await unProfil()
  const profil = await idDe(cookie)
  // Une traversée menée jusqu'au choix du légendaire, écrite à la main : ses gestes rejoués par le pli, comme le serveur les aurait écrits.
  let x = 1
  const hasard = () => ((x = (x * 16807) % 2147483647) / 2147483647)
  const gardiens: [string, string, string] = ['lg:renard', 'lg:sphinx', 'lg:dragon']
  const depart: DepartDeLaTraversee = { v: 1, jour: '2026-10-24', actes: tracerLaCarte(hasard, gardiens, { epingle: ['Rome'], frise: ['Rome'] }) }
  const gestes: GesteDeLaTraversee[] = [{ quoi: 'cartes', cartes: ['cagnotte', 'parade', 'panacee'] }]
  let e = etatDeLaTraversee(
    depart,
    gestes.map(geste => ({ geste, faitLe: 0 })),
  )
  const jouerAuPli = (g: GesteDeLaTraversee) => {
    gestes.push(g)
    e = etatDeLaTraversee(
      depart,
      gestes.map(geste => ({ geste, faitLe: 0 })),
    )
  }
  let p = 0
  while (e.ou.sorte !== 'legendaire') {
    if (e.ameliorations > 0) {
      jouerAuPli({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 3)!.cle })
      continue
    }
    const ici = depart.actes[e.acte].etapes
    const suivantes = e.ou.sorte === 'gardien' ? [e.ou.etape] : ici.find(s => s.id === e.position)!.suivantes
    const etape = ici.find(s => s.id === (suivantes.find(id => ici.find(s => s.id === id)?.sorte === 'epreuve') ?? suivantes[0]))!
    if (etape.sorte === 'coffre' || etape.sorte === 'marchand') {
      jouerAuPli({ quoi: 'aller', etape: etape.id })
      continue
    }
    const partie = `fausse-${++p}`
    jouerAuPli({ quoi: 'epreuve', etape: etape.id, partie })
    jouerAuPli({ quoi: 'conclure', partie, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })) })
  }
  assert.equal(e.ignores, 0)
  const id = 'traversee-ecrite-a-la-main'
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  aLaMain(
    b.fichier,
    [
      `INSERT INTO cabinet_traversees (id, profile_id, depart, commencee_le) VALUES (${q(id)}, ${q(profil)}, ${q(JSON.stringify(depart))}, 1)`,
      ...gestes.map((g, k) => `INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (${q(id)}, ${k + 1}, ${q(JSON.stringify(g))}, ${k + 2}, 'u${k}')`),
    ].join(';\n'),
  )
  const avant = ok(await laPage(cookie), 'la page').traversee!
  assert.equal(avant.ou.sorte, 'legendaire')
  assert.deepEqual(avant.vaincus, gardiens)
  const refus = await geste(cookie, avant, { quoi: 'legendaire', gardien: 'lg:kraken' })
  assert.equal(refus.status, 400)
  const page = ok(await geste(cookie, avant, { quoi: 'legendaire', gardien: 'lg:sphinx' }), 'le choix')
  assert.equal(page.traversee?.fin?.issue, 'gagnee')
  assert.equal(page.traversee?.fin?.legendaire, 'lg:sphinx')
  assert.ok(page.possedes.includes('lg:sphinx'), 'le Sphinx est à lui : un avatar comme un gardien réveillé')
  assert.equal(enBase(b.fichier, db => (db.prepare('SELECT legendaire FROM cabinet_traversees WHERE id = ?').get(id) as { legendaire: string }).legendaire), 'lg:sphinx')
})

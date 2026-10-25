// Le Cabinet de curiosités sur Turso : ce que chaque lot garde, et ce que la
// mémoire oublie. Deux magasins sur la même base sont deux serveurs pendant
// une mise en ligne, chacun sa mémoire : la base seule dit qui a gagné — un
// seul geste par rang, une seule partie en cours, un seul droit du jour (D9) —,
// et le perdant s'oublie, relit, et rend la vue de ce qui était déjà fait ou
// le refus juste, en mots. Une écriture que la base refuse (un `RAISE(ABORT)`,
// le gabarit d'`expedition-charge.test.ts`) ne laisse rien en mémoire : le même
// geste, rejoué au même rang, passe une fois.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DIX_HEURES, aLaMain, departEnBase, dossierDEssai, enBase, fermerLesMagasins, magasinDEssai, type MagasinDEssai } from './cabinet-banc'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { PartieLue } from '../src/core/cabinet/magasin'

after(fermerLesMagasins)

/** Deux serveurs sur la même base, l'horloge commune. */
async function deuxServeurs(): Promise<{ a: MagasinDEssai; b: MagasinDEssai; fichier: string; horloge: { t: number } }> {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const b = await magasinDEssai(fichier, horloge)
  return { a, b, fichier, horloge }
}

const repondreJuste = (fichier: string, p: PartieLue, rang: number) => {
  const q1 = (departEnBase(fichier, p.id).tirages[0] as PariTire).q1
  return { rang, geste: { quoi: 'repondre', manche: 0, reponse: { pari: { choix: q1.bonne } } } }
}

const compter = (fichier: string, sql: string, ...args: unknown[]) => enBase(fichier, db => (db.prepare(sql).get(...args) as { n: number }).n)

test('deux serveurs : une seule partie en cours — le second, devancé, relit et le dit', async () => {
  const { a, b, fichier } = await deuxServeurs()
  // L'autre serveur a son musée en mémoire, sans partie : il croit pouvoir partir.
  await b.cabinet.page('qui')
  const partie = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  await assert.rejects(b.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null }), { message: 'Ta partie au Pari t’attend : reprends-la ou quitte-la d’abord' })
  assert.equal(compter(fichier, "SELECT COUNT(*) AS n FROM campagne_series WHERE mode = 'cabinet'"), 1, 'une seule partie en base')
  // Relue, sa page dit la partie de l'autre serveur, au même rang.
  const page = await b.cabinet.page('qui')
  assert.equal(page.enCours?.id, partie.id)
  assert.equal(page.enCours?.etat.rang, 2)
})

test('deux serveurs : un seul geste par rang — le second relit la partie et rend la vue d’à présent', async () => {
  const { a, b, fichier, horloge } = await deuxServeurs()
  const partie = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  await b.cabinet.page('qui')
  horloge.t += 4_000
  const { rang, geste } = repondreJuste(fichier, partie, 2)
  const premier = await a.cabinet.geste('qui', partie.id, rang, geste)
  assert.ok('partie' in premier)
  // Le même geste, au même rang, par l'autre serveur — un double toucher, une réponse perdue puis rejouée.
  const second = await b.cabinet.geste('qui', partie.id, rang, geste)
  assert.ok('passe' in second, JSON.stringify(second))
  assert.equal(second.pourquoi, 'Ce geste est passé : ta partie a continué sans lui')
  assert.equal(second.passe.etat.rang, 3, 'la vue d’à présent : le rang suivant')
  assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', partie.id), 2, 'l’ouverture et une réponse')
  assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM campagne_reponses WHERE serie_id = ?', partie.id), 0, 'juste au premier coup : la pièce attend « Garder » ou « Parier »')
  // Puis la fin, d'un seul serveur aussi : quitter compte l'étoile gardée, une pièce, une fois.
  const fin = await b.cabinet.geste('qui', partie.id, 3, { quoi: 'quitter' })
  assert.ok('partie' in fin)
  assert.ok('passe' in (await a.cabinet.geste('qui', partie.id, 3, { quoi: 'quitter' })))
  assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM campagne_reponses WHERE serie_id = ?', partie.id), 1)
  assert.deepEqual(
    enBase(fichier, db => db.prepare('SELECT poussiere, partie FROM cabinet_profils WHERE profile_id = ?').get('qui')),
    { poussiere: 2, partie: null },
    'la poussière d’une libre payée, une fois',
  )
})

test('deux serveurs : un seul droit du jour — deux chasses, pas une de plus, recomptées par la base', async () => {
  const { a, b, fichier } = await deuxServeurs()
  await b.cabinet.page('qui')
  for (const oeuvre of ['lecon', 'lancee']) {
    const p = await a.cabinet.commencer('qui', { origine: 'chasse', oeuvre, carte: null })
    assert.ok('partie' in (await a.cabinet.geste('qui', p.id, 2, { quoi: 'quitter' })))
  }
  // Sa mémoire n'a vu aucune chasse : la base les recompte dans l'instruction même.
  await assert.rejects(b.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'corser', carte: null }), { message: 'Plus de chasse pour aujourd’hui : elles reviennent à minuit' })
  // La case de la visite de même : commencée par l'un, elle ne se rejoue pas par l'autre.
  const c = await magasinDEssai(fichier, { t: DIX_HEURES })
  await c.cabinet.page('qui')
  const visite = await a.cabinet.commencer('qui', { origine: 'visite', case: 0, carte: null })
  assert.ok('partie' in (await a.cabinet.geste('qui', visite.id, 2, { quoi: 'quitter' })))
  await assert.rejects(c.cabinet.commencer('qui', { origine: 'visite', case: 0, carte: null }), { message: 'Cette partie de la visite est déjà faite' })
  assert.equal(compter(fichier, "SELECT COUNT(*) AS n FROM campagne_series WHERE mode = 'cabinet'"), 3)
})

test('une écriture refusée par la base : rien ne reste en mémoire, et le même geste, au même rang, passe une fois', async () => {
  const { a, fichier, horloge } = await deuxServeurs()
  const partie = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  horloge.t += 3_000
  const { rang, geste } = repondreJuste(fichier, partie, 2)
  aLaMain(fichier, `CREATE TRIGGER panne_geste BEFORE INSERT ON cabinet_gestes BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`)
  try {
    await assert.rejects(a.cabinet.geste('qui', partie.id, rang, geste), (e: Error) => e.constructor !== Error, 'une erreur de la base, pas un refus à lire')
  } finally {
    aLaMain(fichier, 'DROP TRIGGER panne_geste')
  }
  const repris = await a.cabinet.geste('qui', partie.id, rang, geste)
  assert.ok('partie' in repris, JSON.stringify(repris))
  assert.equal(repris.partie.etat.rang, 3)
  assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', partie.id), 2)
  // Un départ refusé de même : la partie suivante part, une seule.
  assert.ok('partie' in (await a.cabinet.geste('qui', partie.id, 3, { quoi: 'quitter' })))
  aLaMain(fichier, `CREATE TRIGGER panne_partie BEFORE INSERT ON campagne_series BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`)
  try {
    await assert.rejects(a.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null }))
  } finally {
    aLaMain(fichier, 'DROP TRIGGER panne_partie')
  }
  const suivante = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null })
  assert.equal(compter(fichier, "SELECT COUNT(*) AS n FROM campagne_series WHERE mode = 'cabinet' AND finie_le IS NULL"), 1)
  assert.equal(enBase(fichier, db => (db.prepare('SELECT partie FROM cabinet_profils WHERE profile_id = ?').get('qui') as { partie: string }).partie), suivante.id)
})

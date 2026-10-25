// Le Cabinet de curiosités sur Turso : ce que chaque lot garde, et ce que la
// mémoire oublie. Deux magasins sur la même base sont deux serveurs pendant
// une mise en ligne, chacun sa mémoire : la base seule dit qui a gagné — un
// seul geste par rang, une seule partie en cours, un seul droit du jour (D9) —,
// et le perdant s'oublie, relit, et rend la vue de ce qui était déjà fait ou
// le refus juste, en mots ; un rang en avance sur sa mémoire la lui fait
// relire. Une écriture que la base refuse (un `RAISE(ABORT)`, le gabarit
// d'`expedition-charge.test.ts`) ne laisse rien en mémoire : le même geste,
// rejoué au même rang, passe une fois. La suppression d'un profil attend ce
// qui est en route, et les tas d'une liste de jouables neuve se préparent une
// catégorie par tour de boucle, jamais d'un bloc sous un départ.
//
// Puis par les routes, chaque aller-retour compté sur le fichier `file:` qui
// tient lieu de Turso (le gabarit d'`expedition-charge.test.ts`) : la page
// froide en coûte un, chaude aucun ; un départ un, deux si le journal n'est
// pas frais ; un geste un, son verdict compris ; la fin, son lot et le rituel
// de la campagne (la conception, § 2.9).
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  aLaMain,
  bancDuCabinet,
  commencer,
  departEnBase,
  dossierDEssai,
  enBase,
  fermerLesMagasins,
  jouer,
  jouerUnEclair,
  laPage,
  magasinDEssai,
  ok,
  ouvrir,
  pariDe,
  type MagasinDEssai,
} from './cabinet-banc'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import { ETOILES_DU_PARI, POUSSIERE_MIN, POUSSIERE_PAR_ETOILE } from '../../shared/cabinet/bareme'
import { CATEGORIES } from '../../shared/categories'
import { PARTIES_GARDEES, type PartieLue } from '../src/core/cabinet/magasin'
import { ProfileStore } from '../src/auth/profiles'

after(fermerLesMagasins)

ProfileStore.tirageEclat = () => false

/** Ce que la base permanente a servi pendant une mesure : chaque `execute` et chaque `batch` est un aller-retour. */
const compte = { actif: false, appels: 0 }
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = async function (this: unknown, ...args: unknown[]) {
    if (compte.actif) compte.appels++
    return origine.apply(this, args)
  }
}

async function mesurer<T>(travail: () => Promise<T>): Promise<{ appels: number; resultat: T }> {
  Object.assign(compte, { actif: true, appels: 0 })
  try {
    const resultat = await travail()
    return { appels: compte.appels, resultat }
  } finally {
    compte.actif = false
  }
}

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
  // Puis la fin, d'un seul serveur aussi : quitter compte les étoiles gardées, une pièce, une fois.
  const fin = await b.cabinet.geste('qui', partie.id, 3, { quoi: 'quitter' })
  assert.ok('partie' in fin)
  assert.ok('passe' in (await a.cabinet.geste('qui', partie.id, 3, { quoi: 'quitter' })))
  assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM campagne_reponses WHERE serie_id = ?', partie.id), 1)
  assert.deepEqual(
    enBase(fichier, db => db.prepare('SELECT poussiere, partie FROM cabinet_profils WHERE profile_id = ?').get('qui')),
    { poussiere: ETOILES_DU_PARI.garder * POUSSIERE_PAR_ETOILE, partie: null },
    'la poussière d’une libre payée, une fois : deux étoiles gardées, deux poussières chacune',
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

test('deux serveurs : un rang en avance sur la mémoire la relit, et le geste se joue sur l’état vrai', async () => {
  const { a, b, fichier } = await deuxServeurs()
  const partie = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  const t = departEnBase(fichier, partie.id).tirages[0] as PariTire
  // Le geste suivant passe par l'autre serveur : la première manche, ratée, est tranchée.
  const surB = await b.cabinet.geste('qui', partie.id, 2, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: (t.q1.bonne + 1) % 4 } } })
  assert.ok('partie' in surB)
  assert.equal(surB.partie.etat.rang, 3)
  // Le suivant revient au premier, au rang que la page tient de l'autre : sa mémoire en est restée au rang 2. Sans la
  // relire, il refusait le geste avec la vue de sa mémoire — la manche tranchée encore « à jouer », que la page reprenait.
  const surA = await mesurer(() => a.cabinet.geste('qui', partie.id, 3, { quoi: 'ouvrir', manche: 1 }))
  assert.ok('partie' in surA.resultat, JSON.stringify(surA.resultat))
  assert.equal(surA.resultat.partie.etat.rang, 4)
  assert.equal(surA.resultat.partie.etat.manches[0].fin, 'jugee')
  assert.equal(surA.appels, 2, 'sa relecture, puis le geste')
  assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', partie.id), 3)
  // Un rang en retard — le double toucher — ne relit rien : c'est la page qui est en retard.
  const double = await mesurer(() => a.cabinet.geste('qui', partie.id, 3, { quoi: 'ouvrir', manche: 1 }))
  assert.ok('passe' in double.resultat)
  assert.equal(double.resultat.passe.etat.rang, 4)
  assert.equal(double.appels, 0)
})

test('deux serveurs : une partie sortie de la mémoire, finie chez l’autre puis relue à la page, emporte son musée avec elle', async () => {
  // Deux cents parties en cours plus récentes l'ont poussée hors de la mémoire de ce serveur (`PARTIES_GARDEES`) ; son
  // musée, lui, y est resté (`MUSEES_GARDES`). L'autre la finit. Relue finie à la page, elle laissait son musée la croire
  // en cours : la page ne la montrait plus, et tout départ se refusait derrière elle, jusqu'au redémarrage.
  const { a, b } = await deuxServeurs()
  const p = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
  assert.equal((await b.cabinet.page('qui')).enCours?.id, p.id, 'ce serveur la garde, avec son musée')
  for (let i = 0; i < PARTIES_GARDEES; i++) await b.cabinet.commencer(`joueur-${i}`, { origine: 'libre', jeu: 'pari', carte: null })
  assert.ok('partie' in (await a.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })))
  const page = await b.cabinet.page('qui')
  assert.deepEqual([page.enCours, page.musee.enCours], [null, null], 'ni la page, ni son musée ne la disent en cours')
  assert.equal((await b.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null })).depart.jeu, 'eclair')
})

test('la fin rend la poussière au solde même quand la ligne du profil ne nomme plus sa partie, et ne rend que la sienne', async () => {
  // Un serveur qui ne relit pas une partie — le départ d'une version que l'autre serveur d'une mise en ligne connaît déjà
  // — rend la ligne du profil (`rendreLaPartieIllisible`) ; l'autre finit la partie. Gardée par `partie = ?`, la
  // poussière du bilan n'entrait plus au solde.
  const { a, fichier } = await deuxServeurs()
  const poussiere = () => enBase(fichier, db => db.prepare('SELECT poussiere, partie FROM cabinet_profils WHERE profile_id = ?').get('qui'))
  const visite = await a.cabinet.commencer('qui', { origine: 'visite', case: 0, carte: null })
  aLaMain(fichier, "UPDATE cabinet_profils SET partie = NULL WHERE profile_id = 'qui'")
  const fin = await a.cabinet.geste('qui', visite.id, 2, { quoi: 'quitter' })
  assert.ok('partie' in fin)
  assert.equal(fin.partie.bilan?.poussiere, POUSSIERE_MIN)
  assert.deepEqual(poussiere(), { poussiere: POUSSIERE_MIN, partie: null })
  // Une autre partie posée entre-temps sur la ligne y reste : la fin ne rend que la sienne.
  const chasse = await a.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'lecon', carte: null })
  aLaMain(fichier, "UPDATE cabinet_profils SET partie = 'une-autre' WHERE profile_id = 'qui'")
  assert.ok('partie' in (await a.cabinet.geste('qui', chasse.id, 2, { quoi: 'quitter' })))
  assert.deepEqual(poussiere(), { poussiere: 2 * POUSSIERE_MIN, partie: 'une-autre' })
})

test('la suppression d’un profil attend ce qui est en route : un départ, un geste qui finit, puis rien ne reste à son nom', async () => {
  const { a, fichier } = await deuxServeurs()
  const reste = (id: string) => ({
    profils: compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_profils WHERE profile_id = ?', id),
    series: compter(fichier, 'SELECT COUNT(*) AS n FROM campagne_series WHERE profile_id = ?', id),
    gestes: compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_gestes'),
    oeuvres: compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', id),
  })
  const supprimer = async (id: string) => {
    await a.cabinet.oublierProfil(id)
    await a.campagne.oublierProfil(id)
  }
  // Un départ authentifié avant que ses sessions tombent : sans le verrou, il recréait sa ligne derrière l'oubli, une
  // partie nommée qui n'existait plus, et un geste sans partie.
  const depart = a.cabinet.commencer('parti', { origine: 'libre', jeu: 'pari', carte: null })
  await Promise.all([depart, supprimer('parti')])
  assert.deepEqual(reste('parti'), { profils: 0, series: 0, gestes: 0, oeuvres: 0 })
  // Un geste qui finit une chasse gagnée : l'œuvre ne reste pas au nom d'un profil supprimé.
  let p = await a.cabinet.commencer('fini', { origine: 'chasse', oeuvre: 'lecon', carte: null })
  for (let k = 0; k < 3; k++) {
    const tire = departEnBase(fichier, p.id).tirages[k] as PariTire
    const joue = async (geste: Record<string, unknown>) => {
      const r = await a.cabinet.geste('fini', p.id, p.etat.rang, geste)
      assert.ok('partie' in r, JSON.stringify(r))
      p = r.partie
    }
    if (k > 0) await joue({ quoi: 'ouvrir', manche: k })
    await joue({ quoi: 'repondre', manche: k, reponse: { pari: { choix: tire.q1.bonne } } })
    await joue({ quoi: 'parier', manche: k })
    if (k === 2) break
    await joue({ quoi: 'repondre', manche: k, reponse: { pari: { choix: tire.q2.bonne } } })
  }
  const derniere = (departEnBase(fichier, p.id).tirages[2] as PariTire).q2.bonne
  const fin = a.cabinet.geste('fini', p.id, p.etat.rang, { quoi: 'repondre', manche: 2, reponse: { pari: { choix: derniere } } })
  const [gagnee] = await Promise.all([fin, supprimer('fini')])
  assert.ok('partie' in gagnee && gagnee.partie.bilan?.issue === 'gagnee-doree', JSON.stringify(gagnee))
  assert.deepEqual(reste('fini'), { profils: 0, series: 0, gestes: 0, oeuvres: 0 })
})

test('les tas d’une liste de jouables neuve se préparent une étape par tour de boucle — chaque catégorie, les tableaux, les frises —, même sous un départ', async () => {
  // La liste des jouables change d'identité — la réserve du jour, un retrait, une base relue — et ses tas avec. Préparés
  // une fois par processus, le départ suivant passait toute la base au crible d'un bloc, sur son chemin : près d'une
  // seconde sur la vraie base ici, dix fois plus au dixième de cœur de l'hébergeur.
  const { a } = await deuxServeurs()
  const porte = a.campagne.porte()
  const avant = { jouables: porte.jouables, deLaCategorie: porte.deLaCategorie, parIdDe: porte.parIdDe, evenementsDe: porte.evenementsDe }
  let liste = await avant.jouables()
  porte.jouables = async () => liste
  // Chaque catégorie passée au crible, et le tour de boucle où elle l'a été.
  let tour = 0
  let tourne = true
  const tic = () => {
    tour++
    if (tourne) setImmediate(tic)
  }
  setImmediate(tic)
  const cribles: number[] = []
  porte.deLaCategorie = (jouables, categorie) => (cribles.push(tour), avant.deLaCategorie(jouables, categorie))
  // Ce que le Détail et la Frise lisent de la base, au tour où ils l'ont lu : la question de chaque tableau (`parIdDe`,
  // `questionsDesTableaux`), puis les sujets qui font une frise (`parIdDe` et `evenementsDe`, `frisesDesSujets` — quinze
  // millisecondes sur la base livrée ici, dix fois plus chez l'hébergeur : sur le chemin d'un départ, on le verrait).
  const lus = { parIdDe: [] as number[], evenementsDe: [] as number[] }
  porte.parIdDe = jouables => (lus.parIdDe.push(tour), avant.parIdDe(jouables))
  porte.evenementsDe = jouables => (lus.evenementsDe.push(tour), avant.evenementsDe(jouables))
  /** Les étapes d'une préparation : chaque catégorie, la question des tableaux, les sujets des frises — chacune son tour. */
  const chacuneSonTour = () => {
    const [tableaux, sujets] = lus.parIdDe
    assert.deepEqual([lus.parIdDe.length, lus.evenementsDe], [2, [sujets]], 'les tableaux, puis les sujets, une fois chacun')
    const tours = [...cribles, tableaux, sujets]
    assert.equal(new Set(tours).size, CATEGORIES.length + 2, `chaque étape à son tour de boucle, jamais d'un bloc : ${tours.join(', ')}`)
  }
  try {
    // La page les prépare en fond ; le départ qui suit les trouve prêts.
    await a.cabinet.prechauffer()
    assert.equal(cribles.length, CATEGORIES.length)
    chacuneSonTour()
    const premier = await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
    assert.equal(cribles.length, CATEGORIES.length, 'prêts : le départ ne fait que tirer')
    assert.ok('partie' in (await a.cabinet.geste('qui', premier.id, 2, { quoi: 'quitter' })))
    // Le Détail et la Frise de même : ni la question d'un tableau, ni les sujets ne se refont sous leur départ.
    for (const jeu of ['detail', 'frise'] as const) {
      const p = await a.cabinet.commencer('qui', { origine: 'libre', jeu, carte: null })
      assert.deepEqual([cribles.length, lus.evenementsDe.length], [CATEGORIES.length, 1], `prêts : le départ ${jeu === 'detail' ? 'du Détail' : 'de la Frise'} ne fait que tirer`)
      if (jeu === 'detail') assert.equal(lus.parIdDe.length, 2, 'la question de chaque tableau, déjà lue')
      assert.ok('partie' in (await a.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })))
    }
    // Une liste neuve sans page : le départ attend leur préparation, qui rend la main entre deux étapes.
    liste = [...liste]
    cribles.length = 0
    lus.parIdDe.length = 0
    lus.evenementsDe.length = 0
    await a.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null })
    assert.equal(cribles.length, CATEGORIES.length)
    assert.equal(new Set(cribles).size, CATEGORIES.length, `chaque catégorie à son tour de boucle, jamais d'un bloc : ${cribles.join(', ')}`)
    chacuneSonTour()
  } finally {
    tourne = false
    Object.assign(porte, avant)
  }
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

test('par les routes : la page froide un aller-retour, chaude aucun ; un départ un ; un geste un, son verdict compris', async () => {
  // La fraîcheur des duels de la production : le banc les relit à chaque lecture, ce qui compterait un aller-retour de plus.
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000 })
  try {
    // Un premier joueur réveille ce que tout le serveur partage : la base, sa mesure, le journal des réponses.
    const chaud = await inscrireProfil(b.banc.url, 'chaud', 'Chaud')
    ok(await laPage(b, chaud), 'la page du premier')
    ok(await jouer(b, chaud, ok(await commencer(b, chaud, { origine: 'libre', jeu: 'pari', carte: null }), 'son départ'), { quoi: 'quitter' }), 'sa fin')

    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const froide = await mesurer(() => laPage(b, lea))
    assert.equal(froide.appels, 1, 'froide : son lot de lectures, le journal rattrapé au bout')
    assert.equal((await mesurer(() => laPage(b, lea))).appels, 0, 'chaude : rien')
    const depart = await mesurer(() => commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }))
    assert.equal(depart.appels, 1, 'le journal frais de la page : le lot du départ seul')
    let v = ok(depart.resultat, 'le départ')
    const t = pariDe(b, v.id, 0)
    const etapes: [string, () => Promise<unknown>, number][] = [
      ['juste au premier coup, sans pièce', async () => (v = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q1.bonne } } }), 'q1')), 1],
      ['parier', async () => (v = ok(await jouer(b, lea, v, { quoi: 'parier', manche: 0 }), 'parier')), 1],
      ['le verdict et ses deux pièces', async () => (v = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: t.q2.bonne } } }), 'q2')), 1],
      ['ouvrir la manche suivante', async () => (v = await ouvrir(b, lea, v, 1)), 1],
      ['la page, en pleine partie', () => laPage(b, lea), 0],
    ]
    for (const [quoi, faire, attendus] of etapes) assert.equal((await mesurer(faire)).appels, attendus, quoi)
    // La fin : son lot, l'expérience de ses justes, ses paliers — et le compagnon, s'il en a un.
    const fin = await mesurer(() => jouer(b, lea, v, { quoi: 'quitter' }))
    assert.equal(ok(fin.resultat, 'quitter').phase, 'finie')
    assert.equal(fin.appels, 3, 'la fin : son lot et l’expérience lue au bout, l’expérience créditée, ses paliers')
    // La fin a relu le journal au bout de son lot, après ses réponses : le départ suivant n'a rien à rattraper.
    const suivant = await mesurer(() => commencer(b, lea, { origine: 'libre', jeu: 'eclair', carte: null }))
    v = ok(suivant.resultat, 'le départ suivant')
    assert.equal(suivant.appels, 1)
    // Une fin sans bonne réponse ne lit pas l'expérience : son lot, et ses paliers, qui relisent le journal (`statsDe`) —
    // le départ d'après n'a rien à rattraper non plus.
    v = await jouerUnEclair(b, lea, v, 0, false)
    const sansJuste = await mesurer(() => jouer(b, lea, v, { quoi: 'quitter' }))
    assert.equal(ok(sansJuste.resultat, 'quitter').bilan?.total, 0)
    assert.equal(sansJuste.appels, 2, 'son lot, ses paliers')
    const apres = await mesurer(() => commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }))
    ok(apres.resultat, 'le départ d’après')
    assert.equal(apres.appels, 1)
  } finally {
    await b.banc.close()
  }
})

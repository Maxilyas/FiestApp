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
// étape par tour de boucle, jamais d'un bloc sous un départ : sur la base
// livrée, une tranche de questions au crible par tour, et rien à rejuger pour
// une liste neuve des mêmes questions. L'Éclair d'un fidèle ne parcourt pas
// les catégories qu'il a épuisées : on compte les questions qu'il examine.
//
// Puis par les routes, chaque aller-retour compté sur le fichier `file:` qui
// tient lieu de Turso (le gabarit d'`expedition-charge.test.ts`) : la page
// froide en coûte un, chaude aucun ; un départ un, deux si le journal n'est
// pas frais ; un geste un, son verdict compris ; la fin, son lot et le rituel
// de la campagne (la conception, § 2.9) — pas un de plus pour un compagnon
// dans la niche, ses soirées et le journal tenus en mémoire ; un achat, une dorure, un échange un
// chacun, rejoués aucun ; le cartel d'une partie et « Mes réponses » d'une
// partie finie un, par leur clé ; tes murs aucun, un si le journal a du retard
// — les dates des frises des sujets et de l'Expédition comprises, lues de la
// base jouable en mémoire ; et l'accueil, qui dit le musée de la mémoire
// seule : pas un aller-retour de plus.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { ecrire, inscrireProfil } from './banc'
import {
  DIX_HEURES,
  aLaMain,
  bancDuCabinet,
  baseDuCabinet,
  commencer,
  departEnBase,
  dossierDEssai,
  enBase,
  fermerLesMagasins,
  jouer,
  jouerUnEclair,
  jouerUneEpingle,
  laPage,
  magasinDEssai,
  ok,
  ouvrir,
  pariDe,
  piecesALaMain,
  questionDUneFrise,
  unPariParfait,
  type MagasinDEssai,
} from './cabinet-banc'
import { OEUVRES, OEUVRES_DE_DEPART } from '../../shared/cabinet/oeuvres'
import type { ProfilDAccueil } from '../../shared/profil'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { MursDuCabinet } from '../../shared/cabinet/vues'
import { ETOILES_DU_PARI, POUSSIERE_MIN, POUSSIERE_PAR_ETOILE } from '../../shared/cabinet/bareme'
import { prixDe } from '../../shared/cabinet/musee'
import { idDeLaFriseDeSujet } from '../../shared/cabinet/pieces'
import { PREFIXE_DE_LA_FRISE } from '../../shared/frise'
import { CATEGORIES } from '../../shared/categories'
import { JUSTES_DES_FORMES } from '../../shared/compagnons'
import { gainVide, releveVide } from '../../shared/profil'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import { motDeLaQuestion } from '../../shared/cabinet/jeux/mot'
import { PARTIES_GARDEES, type PartieLue } from '../src/core/cabinet/magasin'
import { vueDeLaPartie } from '../src/core/cabinet/vue'
import { contenuDuCabinet } from '../src/core/cabinet/contenu'
import { estUnQcmDuCabinet, motsDeLaCategorie, preparerLesTas, qcmDeLaCategorie, valeurDuFilet, valeursDeLaCategorie } from '../src/core/cabinet/tirages/tas'
import { tirerLePlan } from '../src/core/cabinet/tirages/index'
import { BaseDeLaCampagne, lireLaBase, QUESTIONS_PAR_TRANCHE, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { tableauxDuDetail } from '../src/core/details'
import { lignesDesFrises } from '../src/core/frises'
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

/** Une partie au Pari, chaque manche pariée et juste, jouée au magasin même : neuf étoiles, le cadre doré. */
async function unPariParfaitAu(m: MagasinDEssai, depart: PartieLue): Promise<PartieLue> {
  let p = depart
  const jouerAuMagasin = async (geste: Record<string, unknown>) => {
    const issue = await m.cabinet.geste('qui', p.id, p.etat.rang, geste)
    assert.ok('partie' in issue, JSON.stringify(issue))
    p = issue.partie
  }
  for (let k = 0; k < 3; k++) {
    const t = departEnBase(m.fichier, p.id).tirages[k] as PariTire
    if (k > 0) await jouerAuMagasin({ quoi: 'ouvrir', manche: k })
    await jouerAuMagasin({ quoi: 'repondre', manche: k, reponse: { pari: { choix: t.q1.bonne } } })
    await jouerAuMagasin({ quoi: 'parier', manche: k })
    await jouerAuMagasin({ quoi: 'repondre', manche: k, reponse: { pari: { choix: t.q2.bonne } } })
  }
  return p
}

test('deux serveurs : le bilan ne dit « Son cartel » que du cartel que la base a écrit, et la mémoire prend la ligne qu’elle rend', async () => {
  // Pendant une mise en ligne, ce serveur garde le musée d'avant : Prudence, une œuvre de départ, sans ligne. L'autre la dore en
  // jouant, et la ligne de Prudence naît avec le cartel de cette partie-là. Puis ici, une chasse de Prudence : la mémoire ne lui
  // voit aucun cartel, mais la base garde le premier (`serie_id = COALESCE(…)`) — le bilan promettait « Son cartel » d'une manche
  // que l'œuvre rouverte ne montrerait pas, et la mémoire nommait au cartel une partie que la base ne nomme pas.
  const { a, b } = await deuxServeurs()
  await b.cabinet.page('qui')
  const premiere = await unPariParfaitAu(a, await a.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'prudence', carte: null }))
  assert.deepEqual([vueDeLaPartie(premiere).bilan?.issue, vueDeLaPartie(premiere).bilan?.devientSonCartel], ['doree', true])
  const seconde = await unPariParfaitAu(b, await b.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'prudence', carte: null }))
  const bilan = vueDeLaPartie(seconde).bilan
  assert.ok(bilan?.cartel, 'sa partie a de quoi raconter')
  assert.equal(bilan.devientSonCartel, undefined, 'la base garde le cartel de la première')
  // Le cartel relu de la mémoire d'ici, sans aller-retour pour sa ligne : la partie que la base nomme.
  const lu = await b.cabinet.cartel('qui', 'prudence')
  assert.ok('cartel' in lu)
  assert.equal(lu.cartel.partie?.id, premiere.id)
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

// ── Les tas et le tirage, sur la base livrée ──────────────────────────────
//
// La base d'essai tient en quelques centaines de questions : ses tas se font
// en un tour quoi qu'on fasse. Les épreuves qui suivent lisent celle que le
// serveur sert, vingt-six mille questions, deux à trois mille par catégorie —
// lue une fois pour elles toutes.

let laBaseLivree: BaseDeLaCampagne | null = null
const baseLivree = () => (laBaseLivree ??= new BaseDeLaCampagne(lireLaBase().questions))

/** Les tours de boucle, comptés : un `setImmediate` qui se repose à chaque tour (le gabarit de l'épreuve des tas, plus haut). */
function compteurDeTours(): { tour: () => number; arreter: () => void } {
  let tour = 0
  let tourne = true
  const tic = () => {
    tour++
    if (tourne) setImmediate(tic)
  }
  setImmediate(tic)
  return { tour: () => tour, arreter: () => void (tourne = false) }
}

/**
 * Des questions sous un espion : chaque intitulé lu, et à quel tour de boucle.
 * Les trois cribles du Cabinet le lisent tous, et rien d'autre de la
 * préparation : les tableaux du Détail lisent les réponses d'une centaine de
 * questions, les frises leur date et leurs sujets. Des objets neufs, que rien
 * n'a encore jugés : la première préparation d'un processus.
 */
function sousLEspion(questions: readonly QuestionDeLaBase[], tour: () => number): { liste: QuestionDeLaBase[]; lues: Map<number, Set<QuestionDeLaBase>> } {
  const lues = new Map<number, Set<QuestionDeLaBase>>()
  const liste = questions.map(
    q =>
      new Proxy(q, {
        get(cible, cle, recepteur) {
          if (cle === 'texte') {
            let auTour = lues.get(tour())
            if (!auTour) lues.set(tour(), (auTour = new Set()))
            auTour.add(cible)
          }
          return Reflect.get(cible, cle, recepteur)
        },
      }),
  )
  return { liste, lues }
}

const lesIds = (qs: readonly QuestionDeLaBase[]) => qs.map(q => q.id)

test('les tas de la base livrée : une tranche de questions au crible par tour de boucle, et une liste neuve des mêmes questions n’en repasse aucune', async () => {
  // Une catégorie d'un seul tenant, c'était deux à trois mille questions aux trois cribles en un tour — 84 ms de boucle
  // figée ici, de l'ordre d'une seconde au dixième de cœur de l'hébergeur, douze fois à chaque réveil et à chaque liste de
  // jouables neuve, la réserve du jour chaque matin (la revue de sobriété du 25 octobre 2026). On compte les questions lues
  // à chaque tour, jamais le temps : une machine chargée n'y change rien.
  const { campagne } = await magasinDEssai(path.join(dossierDEssai(), 'tranches.db'), { t: DIX_HEURES }, baseLivree())
  const porte = campagne.porte()
  const jouables = await porte.jouables()
  // Ce que le disque donne une fois par processus, hors de la mesure.
  tableauxDuDetail()
  contenuDuCabinet()
  const compteur = compteurDeTours()
  const { liste, lues } = sousLEspion(jouables, compteur.tour)
  try {
    await preparerLesTas(porte, liste)
    const parTour = [...lues.values()].map(s => s.size)
    const jugees = parTour.reduce((n, k) => n + k, 0)
    assert.ok(jugees >= 20_000, `${jugees} questions lues seulement : les cribles n'ont pas tourné`)
    assert.ok(Math.max(...parTour) <= QUESTIONS_PAR_TRANCHE, `un tour de boucle passe ${Math.max(...parTour)} questions aux cribles, pour ${QUESTIONS_PAR_TRANCHE} par tranche`)

    // L'apport du matin, un retrait, une base relue : une liste neuve, faite des mêmes questions (`CampagneStore.jouables` les
    // filtre). Le verdict de chacune ne dépend que d'elle : gardé, il ne se refait pas, et la liste ne coûte qu'un filtre —
    // 0,3 à 1,1 ms par catégorie au lieu de 53 à 153 (la contre-expertise du même jour).
    const neuve = liste.filter((_, i) => i % 500 !== 7)
    lues.clear()
    await preparerLesTas(porte, neuve)
    assert.equal([...lues.values()].reduce((n, s) => n + s.size, 0), 0, 'une liste neuve des mêmes questions repasse au crible')
    // Et ses tas sont ceux que les cribles donnent, question pour question.
    for (const c of CATEGORIES) {
      const siennes = porte.deLaCategorie(neuve, c)
      assert.deepEqual(lesIds(qcmDeLaCategorie(porte, neuve, c)), lesIds(siennes.filter(estUnQcmDuCabinet)), `les QCM de ${c}`)
      assert.deepEqual(lesIds(motsDeLaCategorie(porte, neuve, c)), lesIds(siennes.filter(q => motDeLaQuestion(q) !== null)), `les mots de ${c}`)
      assert.deepEqual(lesIds(valeursDeLaCategorie(porte, neuve, c)), lesIds(siennes.filter(q => valeurDuFilet(q) !== null)), `les valeurs de ${c}`)
    }
  } finally {
    compteur.arreter()
  }
})

/** Ce que le joueur a vu, et chaque question que le tirage examine : `tirerPourUneEscale` demande sa fraîcheur à chacune. */
class VuesComptees extends Map<string, number> {
  lues = 0
  override get(k: string) {
    this.lues++
    return super.get(k)
  }
}

test('l’Éclair d’un joueur qui a épuisé six catégories tire dans les six autres, sans parcourir les épuisées', async () => {
  // Il tirait sa catégorie au hasard parmi les douze, avant de regarder ce qu'il avait vu : dans une catégorie épuisée,
  // chacune de ses places parcourait tout le tas — 7 658 questions examinées par départ contre 25 pour un joueur neuf (la
  // revue de sobriété du 25 octobre 2026), et cinq affirmations déjà vues quand six catégories l'attendaient.
  const { campagne } = await magasinDEssai(path.join(dossierDEssai(), 'eclair.db'), { t: DIX_HEURES }, baseLivree())
  const porte = campagne.porte()
  const [jouables, mesures] = await Promise.all([porte.jouables(), porte.mesures()])
  await preparerLesTas(porte, jouables)
  const epuisees = new Set<string>(CATEGORIES.slice(0, 6))
  // Toutes leurs questions vues il y a un mois, hors de la fenêtre de sept jours : vues, pas récentes.
  const ilYaUnMois = DIX_HEURES - 30 * 86_400_000
  const vuesEpuisees = jouables.filter(q => epuisees.has(q.meta.categorie)).map((q, i): [string, number] => [q.id, ilYaUnMois + i])
  const departs = (vues: readonly [string, number][]) =>
    Array.from({ length: 3 }, () => {
      const comptees = new VuesComptees(vues)
      comptees.lues = 0
      const plan = tirerLePlan('eclair', { porte, jouables, mesures, vues: comptees, maintenant: DIX_HEURES, hasard: Math.random }, 0)
      assert.ok(plan, 'rien à tirer')
      return { examinees: comptees.lues, categorie: (plan[0] as EclairTire).affirmations[0].question.categorie }
    })
  const neuf = departs([])
  const fidele = departs(vuesEpuisees)
  for (const d of fidele) assert.ok(!epuisees.has(d.categorie ?? ''), `l’Éclair pose ${d.categorie}, épuisée, quand six catégories l’attendent`)
  const moyenne = (ds: readonly { examinees: number }[]) => ds.reduce((n, d) => n + d.examinees, 0) / ds.length
  assert.ok(moyenne(fidele) <= 10 * moyenne(neuf), `l’Éclair du fidèle examine ${moyenne(fidele)} questions par départ, contre ${moyenne(neuf)} pour un joueur neuf`)
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

test('par les routes : la fin d’une partie, un compagnon dans la niche, coûte ce qu’elle coûte sans lui', async () => {
  // La luciole entre dans la niche à la première salle complète ; dès lors, chaque fin fait grandir le compagnon. Le rituel
  // relisait toutes ses soirées (`historiqueOf`, une ligne par soirée jouée) et rattrapait encore le journal des réponses,
  // que le lot de la fin et ses paliers venaient de relire après ses réponses : cinq allers-retours en série au lieu de
  // trois (la revue de sobriété du 25 octobre 2026), à chaque fin, dix fois par jour.
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000 })
  try {
    const ana = await inscrireProfil(b.banc.url, 'ana', 'Ana')
    const id = (await fetch(`${b.banc.url}/api/joueur/moi?leger`, { headers: { Cookie: ana } }).then(r => r.json() as Promise<{ profile: { id: string } }>)).profile.id
    // Sept œuvres de la salle de l'Érudit, achetées avant sa première page ; la Leçon, gagnée, la complète.
    aLaMain(b.fichier, ['plume', 'savoir-faire', 'memoire', 'bibliotheque', 'expose', 'encyclopedie', 'genie'].map(o => `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES ('${id}', '${o}', 'achat', 0);`).join('\n'))
    ok(await laPage(b, ana), 'sa page')
    const chasse = await unPariParfait(b, ana, ok(await commencer(b, ana, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse'))
    assert.ok(chasse.bilan?.gains?.compagnon, 'la luciole dans sa niche')
    // Deux fins ordinaires, chacune une bonne réponse : la seconde se compte — ce qui se garde l'est alors.
    let appels = 0
    for (let n = 0; n < 2; n++) {
      const v = await jouerUnEclair(b, ana, ok(await commencer(b, ana, { origine: 'libre', jeu: 'eclair', carte: null }), 'une libre'), 0)
      const fin = await mesurer(() => jouer(b, ana, v, { quoi: 'quitter' }))
      assert.equal(ok(fin.resultat, 'quitter').phase, 'finie')
      appels = fin.appels
    }
    assert.equal(appels, 3, 'la fin : son lot et l’expérience lue au bout, l’expérience créditée, ses paliers — son compagnon, de la mémoire')
  } finally {
    await b.banc.close()
  }
})

test('ce que la croissance d’un compagnon garde de ses soirées se défait à chaque soirée créditée : il grandit dès la fin suivante', async () => {
  // La fin d'une partie ne relit plus tout son historique pour son compagnon : ses soirées se gardent (`compagnonsDe`). Une
  // soirée créditée, d'un quiz ou de sa clôture, les oublie — sans quoi le compagnon attendait le redémarrage pour grandir
  // de ce qu'il avait trouvé en soirée.
  const profils = new ProfileStore(`file:${path.join(dossierDEssai(), 'profils.db')}`)
  await profils.init()
  try {
    const { profile } = await profils.register({ login: 'ana', password: 'motdepasse1', name: 'Ana', avatar: '🦊' })
    await profils.offrirUnCompagnon(profile.id, 'loup', DIX_HEURES)
    assert.equal(await profils.faireGrandir(profile.id), false, 'aucune bonne réponse avec lui encore : rien ne grandit, ses soirées se gardent')
    // Une soirée qui compte — jouée à plusieurs — et ses bonnes réponses données avec le loup.
    const soiree = (justes: number) => ({ spaceId: 'salon', gain: { ...gainVide(), reponses: justes }, releve: { ...releveVide(), compagnons: { loup: justes } }, xp: justes })
    await profils.creditSoiree({ profileId: profile.id, soireeId: 's1', ...soiree(JUSTES_DES_FORMES[1]) })
    assert.equal(await profils.faireGrandir(profile.id), true, 'sa deuxième forme, de la soirée créditée après coup')
    // Et la clôture d'une soirée entière, d'un seul lot.
    await profils.crediterSoireeEntiere('s2', 'salon', [{ profileId: profile.id, ...soiree(JUSTES_DES_FORMES[2] - JUSTES_DES_FORMES[1]) }])
    assert.equal(await profils.faireGrandir(profile.id), true, 'sa troisième, de la soirée close')
  } finally {
    profils.close()
  }
})

test('par les routes : acheter, dorer, changer de jeu, un aller-retour chacun ; le cartel d’une partie et « Mes réponses » d’une finie, un ; le reste, aucun', async () => {
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000 })
  try {
    const chaud = await inscrireProfil(b.banc.url, 'chaud', 'Chaud')
    ok(await laPage(b, chaud), 'la page du premier')
    ok(await jouer(b, chaud, ok(await commencer(b, chaud, { origine: 'libre', jeu: 'pari', carte: null }), 'son départ'), { quoi: 'quitter' }), 'sa fin')

    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const id = (await fetch(`${b.banc.url}/api/joueur/moi?leger`, { headers: { Cookie: lea } }).then(r => r.json() as Promise<{ profile: { id: string } }>)).profile.id
    // De la poussière d'or posée en base avant sa première page : le musée la lit à froid.
    aLaMain(b.fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${id}', 2000, 0, 0)`)
    ok(await laPage(b, lea), 'sa page froide')
    // Une chasse gagnée : la Leçon entre, son cartel garde une manche.
    let v = ok(await commencer(b, lea, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
    for (let k = 0; k < 3; k++) {
      if (k > 0) v = await ouvrir(b, lea, v, k)
      const t = pariDe(b, v.id, k)
      v = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { pari: { choix: t.q1.bonne } } }), 'q1')
      v = ok(await jouer(b, lea, v, { quoi: 'parier', manche: k as 0 | 1 | 2 }), 'parier')
      v = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: k as 0 | 1 | 2, reponse: { pari: { choix: t.q2.bonne } } }), 'q2')
    }
    assert.equal(v.bilan?.issue, 'gagnee-doree')
    const finie = v.id

    const poster = (chemin: string, corps: unknown) => ecrire(b.banc.url, chemin, corps, lea).then(async r => ({ status: r.status, corps: await r.json() }))
    const lire = (chemin: string) => fetch(`${b.banc.url}${chemin}`, { headers: { Cookie: lea, 'X-Requested-With': 'quizz' } }).then(async r => ({ status: r.status, corps: await r.json() }))
    const etapes: [string, () => Promise<{ status: number }>, number][] = [
      ['acheter', () => poster('/api/cabinet/oeuvre/bastion/achat', { prix: prixDe('bastion', 'achat') }), 1],
      ['acheter, rejoué : rien à écrire', () => poster('/api/cabinet/oeuvre/bastion/achat', { prix: prixDe('bastion', 'achat') }), 0],
      ['dorer une œuvre de départ', () => poster('/api/cabinet/oeuvre/prudence/dorure', { prix: prixDe('prudence', 'dorure') }), 1],
      ['dorer l’achetée', () => poster('/api/cabinet/oeuvre/bastion/dorure', { prix: prixDe('bastion', 'dorure') }), 1],
      ['changer de jeu', () => poster('/api/cabinet/visite/echange', { case: 0 }), 1],
      ['un refus que la mémoire dit sûr : le prix changé', () => poster('/api/cabinet/oeuvre/lancee/achat', { prix: 1 }), 0],
      ['le cartel d’une partie : sa ligne et ses gestes, par sa clé', () => lire('/api/cabinet/oeuvre/lecon'), 1],
      ['le cartel d’une œuvre achetée : la mémoire', () => lire('/api/cabinet/oeuvre/bastion'), 0],
      ['« Mes réponses » d’une partie finie, par sa clé', () => lire(`/api/cabinet/partie/${finie}`), 1],
      ['la page après tout cela', () => laPage(b, lea), 0],
    ]
    for (const [quoi, faire, attendus] of etapes) {
      const { appels, resultat } = await mesurer(faire)
      assert.ok(resultat.status === 200 || (quoi.startsWith('un refus') && resultat.status === 400), `${quoi} : ${resultat.status}`)
      assert.equal(appels, attendus, quoi)
    }
    const enCours = ok(await commencer(b, lea, { origine: 'libre', jeu: 'eclair', carte: null }), 'une libre')
    assert.equal((await mesurer(() => lire(`/api/cabinet/partie/${enCours.id}`))).appels, 0, '« Mes réponses » d’une partie en cours : la mémoire')
  } finally {
    await b.banc.close()
  }
})

test('par les routes : tes murs, aucun aller-retour quand le journal est frais, un pour le rattraper — rien ne s’écrit pour eux', async () => {
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000 })
  try {
    const chaud = await inscrireProfil(b.banc.url, 'chaud', 'Chaud')
    ok(await laPage(b, chaud), 'la page du premier')
    ok(await jouer(b, chaud, ok(await commencer(b, chaud, { origine: 'libre', jeu: 'pari', carte: null }), 'son départ'), { quoi: 'quitter' }), 'sa fin')

    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    ok(await laPage(b, lea), 'sa page')
    const murs = () => fetch(`${b.banc.url}/api/cabinet/murs`, { headers: { Cookie: lea, 'X-Requested-With': 'quizz' } }).then(async r => ({ status: r.status, corps: (await r.json()) as MursDuCabinet }))
    assert.equal((await mesurer(murs)).appels, 0, 'la page vient de rattraper le journal')
    // Une pièce écrite depuis : le journal se rattrape, d'un aller-retour — puis plus rien.
    const v = await jouerUneEpingle(b, lea, ok(await commencer(b, lea, { origine: 'libre', jeu: 'epingle', carte: null }), 'l’Épingle'), 0)
    const apres = await mesurer(murs)
    assert.equal(apres.appels, 1)
    assert.equal(apres.resultat.corps.lieux.length, 1, 'le lieu épinglé')
    assert.equal((await mesurer(murs)).appels, 0)
    assert.equal(compter(b.fichier, 'SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?', v.id), 2, 'l’ouverture et la réponse : les murs n’écrivent rien')
  } finally {
    await b.banc.close()
  }
})

test('par les routes : l’accueil dit son musée sans un aller-retour de plus — lu en mémoire, ou rien', async () => {
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000 })
  try {
    const chaud = await inscrireProfil(b.banc.url, 'chaud', 'Chaud')
    ok(await laPage(b, chaud), 'la page du premier')
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const accueil = () =>
      fetch(`${b.banc.url}/api/joueur/moi?accueil`, { headers: { Cookie: lea } }).then(async r => {
        assert.equal(r.status, 200)
        return ((await r.json()) as { profile: ProfilDAccueil }).profile
      })
    // La nuit close, son profil en mémoire : l'accueil d'un serveur réveillé depuis un moment.
    await accueil()
    const avant = await mesurer(accueil)
    // Son musée, le serveur ne l'a pas encore lu : l'accueil n'en dit rien, et ne le lit pas pour lui — la plupart des profils
    // qui ouvrent l'accueil n'ouvrent pas le Cabinet, et chacun aurait payé son lot froid à chaque réveil (le quota de Turso).
    assert.equal(avant.resultat.cabinet, undefined)
    ok(await laPage(b, lea), 'sa page')
    const apres = await mesurer(accueil)
    assert.deepEqual(apres.resultat.cabinet, { oeuvres: OEUVRES_DE_DEPART.length, sur: OEUVRES.length, aJouer: true })
    assert.equal(apres.appels, avant.appels, 'le musée en mémoire : pas un aller-retour de plus')
    // Sa visite faite, case par case — quittée, elle compte : la case se consomme au départ. La pastille s'éteint à la dernière.
    const cases = ok(await laPage(b, lea), 'sa page').visite.cases.length
    for (let k = 0; k < cases; k++) {
      ok(await jouer(b, lea, ok(await commencer(b, lea, { origine: 'visite', case: k, carte: null }), `la case ${k + 1}`), { quoi: 'quitter' }), 'quitter')
      assert.equal((await accueil()).cabinet?.aJouer, k < cases - 1, `après la case ${k + 1}`)
    }
    // Une œuvre gagnée en chasse : le compte la prend aussitôt, de la mémoire que la fin a tenue à jour.
    const gagnee = await unPariParfait(b, lea, ok(await commencer(b, lea, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse'))
    assert.equal(gagnee.bilan?.issue, 'gagnee-doree')
    await accueil()
    const ensuite = await mesurer(accueil)
    assert.deepEqual(ensuite.resultat.cabinet, { oeuvres: OEUVRES_DE_DEPART.length + 1, sur: OEUVRES.length, aJouer: false })
    assert.equal(ensuite.appels, avant.appels)
    // Le serveur redémarré n'a plus son musée : l'accueil se tait de nouveau, jusqu'à la prochaine page du Cabinet.
    await b.banc.redemarrer()
    assert.equal((await accueil()).cabinet, undefined)
    ok(await laPage(b, lea), 'sa page après le réveil')
    assert.deepEqual((await accueil()).cabinet, { oeuvres: OEUVRES_DE_DEPART.length + 1, sur: OEUVRES.length, aJouer: false })
  } finally {
    await b.banc.close()
  }
})

test('par les routes : tes murs datés par la base jouable — une frise d’un sujet, une de l’Expédition — ne coûtent pas un aller-retour de plus', async () => {
  // La base jouable, ses événements datés rangés une fois par liste : celle que la porte garde pour le tirage, jamais relue
  // pour les murs. Des questions sous l'identifiant de lignes des frises — celles du banc ne datent rien.
  const lignes = lignesDesFrises().slice(0, 5)
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000, baseDeLaCampagne: baseDuCabinet(8, lignes.map((l, k) => questionDUneFrise(l.id, 1600 + 50 * k))) })
  try {
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const id = (await fetch(`${b.banc.url}/api/joueur/moi?leger`, { headers: { Cookie: lea } }).then(r => r.json() as Promise<{ profile: { id: string } }>)).profile.id
    const [q0, q1, q2, q3, q4] = lignes.map(l => l.id)
    piecesALaMain(b.fichier, id, [
      { id: `${PREFIXE_DE_LA_FRISE}${[q0, q1, q2, q3].join('+')}`, mode: 'expedition', le: DIX_HEURES - 3 * 86_400_000 },
      { id: idDeLaFriseDeSujet([q3, q4]), mode: 'cabinet', le: DIX_HEURES - 2 * 86_400_000 },
    ])
    // Écrites derrière le dos du serveur : le journal les lit au réveil.
    await b.banc.redemarrer()
    ok(await laPage(b, lea), 'sa page')
    // Un départ a lu la base jouable, et sa fin a rattrapé le journal : rien à relire, les événements datés compris.
    ok(await jouer(b, lea, ok(await commencer(b, lea, { origine: 'libre', jeu: 'pari', carte: null }), 'son départ'), { quoi: 'quitter' }), 'quitter')
    const murs = () => fetch(`${b.banc.url}/api/cabinet/murs`, { headers: { Cookie: lea, 'X-Requested-With': 'quizz' } }).then(async r => ({ status: r.status, corps: (await r.json()) as MursDuCabinet }))
    const apres = await mesurer(murs)
    assert.equal(apres.appels, 0, 'ni la base jouable ni ses événements ne se relisent pour les murs')
    assert.deepEqual(
      apres.resultat.corps.dates.map(d => [d.libelle, d.de]),
      lignes.map((l, k) => [l.evenement, k < 3 ? 'expedition' : 'cabinet']),
    )
    assert.equal((await mesurer(murs)).appels, 0)
  } finally {
    await b.banc.close()
  }
})

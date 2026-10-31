// Le Cabinet de curiosités sur Turso : ce que chaque lot garde, et ce que la
// mémoire oublie. Deux magasins sur la même base sont deux serveurs pendant
// une mise en ligne, chacun sa mémoire : la base seule dit qui a gagné — un
// seul geste par rang, une seule partie en cours, un seul droit du jour
// (« Chaque lot d'écriture est gardé par son geste »,
// `docs/architecture/decisions.md`) —, et le perdant s'oublie, relit, et
// rend la vue de ce qui était déjà fait ou
// le refus juste, en mots ; un rang en avance sur sa mémoire la lui fait
// relire. Une écriture que la base refuse (un `RAISE(ABORT)`, le gabarit
// d'`expedition-charge.test.ts`) ne laisse rien en mémoire : le même geste,
// rejoué au même rang, passe une fois. La suppression d'un profil attend ce
// qui est en route, et les tas d'une liste de jouables neuve se préparent une
// étape par tour de boucle, jamais d'un bloc sous un départ : sur la base
// livrée, une tranche de questions au crible par tour, et rien à rejuger pour
// une liste neuve des mêmes questions ; ce que le disque donne, chacun son
// tour. L'Éclair d'un fidèle ne parcourt pas les catégories qu'il a épuisées :
// on compte les questions qu'il examine ; et sa passe à ses marches se prépare
// avec les tas, une mesure neuve en fond — on compte les mesures lues. Ce que
// la fin d'une partie garde des soirées de chacun pour son compagnon s'oublie
// à chaque soirée qui change, et une page relit ce que l'autre serveur a
// crédité.
//
// Puis par les routes, chaque aller-retour compté sur le fichier `file:` qui
// tient lieu de Turso (le gabarit d'`expedition-charge.test.ts`) : la page
// froide en coûte un, chaude aucun ; un départ un, deux si le journal n'est
// pas frais ; un geste un, son verdict compris ; la fin, son lot et le rituel
// de la campagne, que sa porte tient (`ecrireDesReponses` : l'expérience, les
// paliers, le compagnon, comptés par `porte-de-la-campagne.test.ts`) — pas un
// de plus pour un compagnon dans la niche, ses soirées et le journal tenus en
// mémoire ; un achat, une dorure, un échange un chacun, rejoués aucun ; le
// cartel d'une partie et « Mes réponses » d'une
// partie finie un, par leur clé ; tes murs aucun, un si le journal a du retard
// — les dates des frises des sujets et de l'Expédition comprises, lues de la
// base jouable en mémoire ; et l'accueil, qui dit la traversée de la mémoire
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
  lire,
  magasinDEssai,
  ok,
  ouvrir,
  pariDe,
  piecesALaMain,
  poster,
  questionDUneFrise,
  unPariParfait,
  type MagasinDEssai,
} from './cabinet-banc'
import { OEUVRES } from '../../shared/cabinet/oeuvres'
import type { ProfilDAccueil } from '../../shared/profil'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import type { MursDuCabinet, PageDeLaTraversee, VueDeLaTraversee } from '../../shared/cabinet/vues'
import { ETOILES_DU_PARI, POUSSIERE_MIN, POUSSIERE_PAR_ETOILE } from '../../shared/cabinet/bareme'
import { prixDe } from '../../shared/cabinet/musee'
import { idDeLaFriseDeSujet } from '../../shared/cabinet/pieces'
import { PREFIXE_DE_LA_FRISE } from '../../shared/frise'
import { CATEGORIES } from '../../shared/categories'
import { compagnon, JUSTES_DES_FORMES } from '../../shared/compagnons'
import { gainVide, releveVide } from '../../shared/profil'
import type { EclairTire } from '../../shared/cabinet/jeux/eclair'
import { motDeLaQuestion } from '../../shared/cabinet/jeux/mot'
import { PARTIES_GARDEES, type PartieLue } from '../src/core/cabinet/magasin'
import { vueDeLaPartie } from '../src/core/cabinet/vue'
import { contenuDuCabinet } from '../src/core/cabinet/contenu'
import { estUnQcmDuCabinet, LECTURES_DU_DISQUE, motsDeLaCategorie, preparerLesTas, qcmDeLaCategorie, valeurDuFilet, valeursDeLaCategorie } from '../src/core/cabinet/tirages/tas'
import { tirerLePlan } from '../src/core/cabinet/tirages/index'
import { ENJEU_ORDINAIRE } from '../../shared/cabinet/partie'
import { BaseDeLaCampagne, lireLaBase, QUESTIONS_PAR_TRANCHE, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { tableauxDuDetail } from '../src/core/details'
import { lignesDesFrises } from '../src/core/frises'
import { ProfileStore } from '../src/auth/profiles'
import { rendreLaMain } from '../src/core/tourniquet'
import type { MesureDUneQuestion } from '../../shared/campagne'

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
  // Deux chasses au Pari, chacune répondue faux puis quittée : le plancher de la poussière ne se paie qu'à une partie
  // répondue (le 26 octobre 2026).
  const ratee = async (p: PartieLue) => {
    const q1 = (departEnBase(fichier, p.id).tirages[0] as PariTire).q1
    assert.ok('partie' in (await a.cabinet.geste('qui', p.id, 2, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: (q1.bonne + 1) % q1.reponses.length } } })))
  }
  const premiere = await a.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'lecon', carte: null })
  await ratee(premiere)
  aLaMain(fichier, "UPDATE cabinet_profils SET partie = NULL WHERE profile_id = 'qui'")
  const fin = await a.cabinet.geste('qui', premiere.id, 3, { quoi: 'quitter' })
  assert.ok('partie' in fin)
  assert.equal(fin.partie.bilan?.poussiere, POUSSIERE_MIN)
  assert.deepEqual(poussiere(), { poussiere: POUSSIERE_MIN, partie: null })
  // Une autre partie posée entre-temps sur la ligne y reste : la fin ne rend que la sienne.
  const chasse = await a.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'lecon', carte: null })
  await ratee(chasse)
  aLaMain(fichier, "UPDATE cabinet_profils SET partie = 'une-autre' WHERE profile_id = 'qui'")
  assert.ok('partie' in (await a.cabinet.geste('qui', chasse.id, 3, { quoi: 'quitter' })))
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

test('ce que le Détail et la Frise lisent du disque une fois par processus a chacun son tour de boucle, après les catégories', async () => {
  // Les tableaux du Détail, puis le contenu neuf, dont les juges passent sur chaque entrée — une quarantaine de
  // millisecondes : à la suite l'un de l'autre, un bloc de plus sous le premier départ d'un processus. Lus une fois par
  // processus, ils ne se voient pas d'une épreuve à l'autre : on épie les lectures que la préparation reçoit.
  const { a } = await deuxServeurs()
  const porte = a.campagne.porte()
  // Une liste neuve : chaque catégorie se refait, à son tour.
  const jouables = [...(await porte.jouables())]
  const compteur = compteurDeTours()
  const cribles: number[] = []
  const lues: [string, number][] = []
  try {
    await preparerLesTas({ ...porte, deLaCategorie: (j, c) => (cribles.push(compteur.tour()), porte.deLaCategorie(j, c)) }, jouables, [
      () => lues.push(['tableaux', compteur.tour()]),
      () => lues.push(['contenu', compteur.tour()]),
    ])
  } finally {
    compteur.arreter()
  }
  assert.deepEqual(lues.map(([quoi]) => quoi), ['tableaux', 'contenu'])
  const [[, tableaux], [, contenu]] = lues
  assert.ok(tableaux > Math.max(...cribles) && contenu > tableaux, `les catégories aux tours ${cribles.join(', ')}, les tableaux au ${tableaux}, le contenu au ${contenu}`)
  // Et ce sont celles que le magasin lui laisse : les tableaux du Détail, le contenu neuf.
  assert.deepEqual(LECTURES_DU_DISQUE, [tableauxDuDetail, contenuDuCabinet])
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
      const plan = tirerLePlan('eclair', { porte, jouables, mesures, vues: comptees, maintenant: DIX_HEURES, hasard: Math.random, enjeu: ENJEU_ORDINAIRE, leurres: new Map() }, 0)
      assert.ok(plan, 'rien à tirer')
      return { examinees: comptees.lues, categorie: (plan[0] as EclairTire).affirmations[0].question.categorie }
    })
  const neuf = departs([])
  const fidele = departs(vuesEpuisees)
  for (const d of fidele) assert.ok(!epuisees.has(d.categorie ?? ''), `l’Éclair pose ${d.categorie}, épuisée, quand six catégories l’attendent`)
  const moyenne = (ds: readonly { examinees: number }[]) => ds.reduce((n, d) => n + d.examinees, 0) / ds.length
  assert.ok(moyenne(fidele) <= 10 * moyenne(neuf), `l’Éclair du fidèle examine ${moyenne(fidele)} questions par départ, contre ${moyenne(neuf)} pour un joueur neuf`)
})

/** Une mesure des difficultés dont on compte les lectures, tour de boucle par tour : la marche d'une question en lit une. */
class MesureLue extends Map<string, MesureDUneQuestion> {
  readonly parTour = new Map<number, number>()
  constructor(
    mesure: ReadonlyMap<string, MesureDUneQuestion>,
    private readonly tour: () => number,
  ) {
    super(mesure)
  }
  override get(k: string) {
    const t = this.tour()
    this.parTour.set(t, (this.parTour.get(t) ?? 0) + 1)
    return super.get(k)
  }
  /** Ses lectures, toutes ensemble. */
  lues(): number {
    return [...this.parTour.values()].reduce((n, k) => n + k, 0)
  }
}

test('l’Éclair à ses marches se prépare avec les tas, et une mesure neuve se refait en fond, une catégorie par tour : jamais sur le chemin d’un départ', async () => {
  // L'Éclair range ses catégories par ce qu'il leur reste de QCM jamais vus à ses marches, et la marche d'une question suit
  // la mesure, relue toutes les dix minutes. Gardée par mesure, la passe sur les vingt-cinq mille QCM de la base se faisait
  // sur le chemin du premier départ qui trouvait la neuve, sous le verrou du profil — de l'ordre de 60 à 150 ms au dixième
  // de cœur de l'hébergeur (la relecture du lot, le 26 octobre 2026). On compte les mesures lues, jamais le temps.
  const { campagne } = await magasinDEssai(path.join(dossierDEssai(), 'eclair-mesure.db'), { t: DIX_HEURES }, baseLivree())
  const porte = campagne.porte()
  const jouables = await porte.jouables()
  const compteur = compteurDeTours()
  const avant = porte.mesures
  let courante = new MesureLue(await avant(), compteur.tour)
  porte.mesures = async () => courante
  const qcm = CATEGORIES.map(c => qcmDeLaCategorie(porte, jouables, c).length)
  const auPlusParTour = (m: MesureLue, depuis: number) => Math.max(...[...m.parTour].filter(([t]) => t > depuis).map(([, n]) => n))
  /** Un départ d'un joueur neuf : ce qu'il lit de la mesure, rien que les questions qu'il examine. */
  const unDepart = () => {
    const lues = courante.lues()
    assert.ok(tirerLePlan('eclair', { porte, jouables, mesures: courante, vues: new Map(), maintenant: DIX_HEURES, hasard: Math.random, enjeu: ENJEU_ORDINAIRE, leurres: new Map() }, 0), 'rien à tirer')
    return courante.lues() - lues
  }
  /** La passe faite en fond : chacun de ses QCM lu une fois, le dernier tour compris. */
  const laPasseEnFond = async (lues: number) => {
    for (let k = 0; k < 100 && courante.lues() < lues + qcm.reduce((n, x) => n + x, 0); k++) await rendreLaMain()
    return courante.lues() - lues
  }
  try {
    // Une liste neuve : les tas, puis l'Éclair à ses marches pour la mesure qu'il y a, chaque catégorie à son tour.
    const debut = compteur.tour()
    await preparerLesTas(porte, jouables)
    assert.ok(courante.lues() >= qcm.reduce((n, x) => n + x, 0), `la préparation n’a lu que ${courante.lues()} mesures`)
    assert.ok(auPlusParTour(courante, debut) <= Math.max(...qcm), `un tour de boucle lit ${auPlusParTour(courante, debut)} mesures, pour ${Math.max(...qcm)} QCM dans la plus grande catégorie`)
    const pret = unDepart()
    assert.ok(pret <= 1_000, `prête, la passe de l’Éclair se refait sous le départ : ${pret} mesures lues`)

    // La mesure des dix minutes suivantes : le départ prend la passe d'avant, la neuve se fait derrière lui.
    courante = new MesureLue(courante, compteur.tour)
    const sousLeDepart = unDepart()
    assert.ok(sousLeDepart <= 1_000, `une mesure neuve fait passer l’Éclair sur tous ses QCM sous le départ : ${sousLeDepart} mesures lues`)
    const tour = compteur.tour()
    const enFond = await laPasseEnFond(courante.lues())
    assert.ok(enFond >= qcm.reduce((n, x) => n + x, 0), `la passe neuve, en fond, n’a lu que ${enFond} mesures`)
    assert.ok(auPlusParTour(courante, tour) <= Math.max(...qcm), `un tour de boucle lit ${auPlusParTour(courante, tour)} mesures`)
    // Faite : le départ suivant ne lit que ce qu'il tire, et rien ne repart derrière lui.
    assert.ok(unDepart() <= 1_000)
    const apres = courante.lues()
    for (let k = 0; k < 20; k++) await rendreLaMain()
    assert.equal(courante.lues(), apres, 'la passe repart pour une mesure déjà faite')
  } finally {
    compteur.arreter()
    porte.mesures = avant
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

test('la visite ne se fige qu’avec la dépense qui passe : refusée par la base, ni l’achat ni la dorure n’écrivent la visite ; acceptée, une écriture', async () => {
  // La deuxième tablée (le 26 octobre 2026, `regressions-serveur-2`) : le gel partait dans le lot de la dépense sans
  // dépendre d'elle. La mémoire d'ici en retard — l'autre serveur d'une mise en ligne vient de dépenser la même poussière —,
  // la base refusait l'achat et figeait quand même la visite d'un musée que le magasin oubliait, faux, l'instant d'après.
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'gel.db')
  const { cabinet } = await magasinDEssai(fichier, horloge)
  // Chaque écriture de la visite d'un profil, qu'elle change la ligne ou non.
  aLaMain(fichier, `CREATE TABLE gels (profil TEXT); CREATE TRIGGER gel AFTER UPDATE OF visites ON cabinet_profils BEGIN INSERT INTO gels VALUES (NEW.profile_id); END;`)
  const gels = (profil: string) => compter(fichier, 'SELECT COUNT(*) AS n FROM gels WHERE profil = ?', profil)
  const visites = (profil: string) => enBase(fichier, db => (db.prepare('SELECT visites FROM cabinet_profils WHERE profile_id = ?').get(profil) as { visites: string | null }).visites)
  const lecon = OEUVRES.find(o => o.cle === 'lecon')!
  const depenses = [
    { profil: 'ivy', sorte: 'achat' as const, cle: lecon.cle, faire: (prix: number) => cabinet.acheter('ivy', lecon.cle, prix) },
    { profil: 'zoe', sorte: 'dorure' as const, cle: 'prudence', faire: (prix: number) => cabinet.dorer('zoe', 'prudence', prix) },
  ]
  for (const d of depenses) {
    const prix = prixDe(d.cle, d.sorte)
    assert.ok(prix !== null, `${d.cle} : un prix à payer`)
    aLaMain(fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${d.profil}', ${prix}, 0, 0);`)
    assert.equal((await cabinet.page(d.profil)).visite.figee, false, `${d.sorte} : rien n’a encore figé la visite`)
    // L'autre serveur dépense la même poussière : la mémoire d'ici ne le sait pas.
    aLaMain(fichier, `UPDATE cabinet_profils SET poussiere = 0 WHERE profile_id = '${d.profil}';`)
    await assert.rejects(d.faire(prix), (e: Error) => e.constructor === Error, `${d.sorte} : la base la refuse, et le refus se dit en mots`)
    assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', d.profil), 0, `${d.sorte} : rien de payé`)
    assert.deepEqual(JSON.parse(visites(d.profil) ?? '[]'), [], `${d.sorte}, que la base refuse : la visite figée quand même`)
    assert.equal(gels(d.profil), 0, `${d.sorte}, que la base refuse : une écriture de la visite`)
    // Rendue, la poussière la paie : la visite se fige avec elle, d'une seule écriture.
    aLaMain(fichier, `UPDATE cabinet_profils SET poussiere = ${prix} WHERE profile_id = '${d.profil}';`)
    await d.faire(prix)
    assert.equal(compter(fichier, 'SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', d.profil), 1, `${d.sorte} : rien de payé, la poussière rendue`)
    assert.equal((JSON.parse(visites(d.profil) ?? '[]') as { jour: string }[])[0]?.jour, '2026-10-24', `${d.sorte}, que la base accepte : la visite du jour figée`)
    assert.equal(gels(d.profil), 1, `${d.sorte}, que la base accepte : une écriture de la visite, pas plus`)
  }
})

test('un jour déjà compté à la série ne réécrit pas la ligne du profil : une écriture par jour, à sa première manche répondue', async () => {
  // La deuxième tablée (le 26 octobre 2026, `regressions-serveur-3`) : l'instruction de la série n'avait pas de garde sur
  // le jour, et la réécrivait à l'identique à chaque visite ou chasse répondue — jusqu'à cinq lignes écrites par jour et par
  // joueur au quota de Turso, pour rien.
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'serie.db')
  const { cabinet } = await magasinDEssai(fichier, horloge)
  // Chaque écriture de la série, qu'elle la change ou non.
  aLaMain(fichier, `CREATE TABLE series (serie INTEGER); CREATE TRIGGER serie AFTER UPDATE OF serie, serie_jour, serie_record ON cabinet_profils BEGIN INSERT INTO series VALUES (NEW.serie); END;`)
  const unJourDeChasses = async (chasses: number) => {
    for (let k = 0; k < chasses; k++) {
      let p = await cabinet.commencer('ana', { origine: 'chasse', oeuvre: 'lecon', carte: null })
      const t = p.depart.tirages[0] as PariTire
      horloge.t += 3_000
      const r = await cabinet.geste('ana', p.id, p.etat.rang, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: (t.q1.bonne + 1) % 4 } } })
      assert.ok('partie' in r, JSON.stringify(r))
      p = r.partie
      const q = await cabinet.geste('ana', p.id, p.etat.rang, { quoi: 'quitter' })
      assert.ok('partie' in q, `chasse ${k + 1} : ${JSON.stringify(q)}`)
    }
  }
  const ligne = () => enBase(fichier, db => db.prepare("SELECT serie, serie_jour AS jour FROM cabinet_profils WHERE profile_id = 'ana'").get())
  const ecritures = () => compter(fichier, 'SELECT COUNT(*) AS n FROM series')
  await unJourDeChasses(2)
  assert.deepEqual(ligne(), { serie: 1, jour: '2026-10-24' }, 'le jour compte une fois')
  assert.equal(ecritures(), 1, 'la seconde chasse répondue du jour a réécrit la série à l’identique')
  // Le lendemain, sa première manche répondue la prolonge : une écriture de plus, une seule.
  horloge.t = DIX_HEURES + 24 * 3_600_000
  await unJourDeChasses(2)
  assert.deepEqual(ligne(), { serie: 2, jour: '2026-10-25' }, 'la veille la prolonge')
  assert.equal(ecritures(), 2, 'une écriture par jour compté')
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

/** Une soirée qui compte — jouée à plusieurs — et ses bonnes réponses données avec le loup. */
const soireeAvecLeLoup = (justes: number) => ({ spaceId: 'salon', gain: { ...gainVide(), reponses: justes }, releve: { ...releveVide(), compagnons: { loup: justes } }, xp: justes })

test('ce que la croissance d’un compagnon garde de ses soirées se défait à chaque soirée créditée, retirée ou remise au barème : il grandit dès la fin suivante, et rien de plus', async () => {
  // La fin d'une partie ne relit plus tout son historique pour son compagnon : ses soirées se gardent (`faireGrandir`). Une
  // soirée créditée, d'un quiz ou de sa clôture, les oublie — sans quoi le compagnon attendait le redémarrage pour grandir
  // de ce qu'il avait trouvé en soirée. Une soirée retirée aussi — un invité exclu, un essai effacé : gardée, elle nourrissait
  // encore le compagnon, qui pouvait atteindre une forme sur une soirée qui n'existait plus, et ne la reperdait jamais.
  const profils = new ProfileStore(`file:${path.join(dossierDEssai(), 'profils.db')}`)
  await profils.init()
  try {
    const { profile } = await profils.register({ login: 'ana', password: 'motdepasse1', name: 'Ana', avatar: '🦊' })
    await profils.offrirUnCompagnon(profile.id, 'loup', DIX_HEURES)
    assert.equal(await profils.faireGrandir(profile.id), false, 'aucune bonne réponse avec lui encore : rien ne grandit, ses soirées se gardent')
    await profils.creditSoiree({ profileId: profile.id, soireeId: 's1', ...soireeAvecLeLoup(JUSTES_DES_FORMES[1]) })
    assert.equal(await profils.faireGrandir(profile.id), true, 'sa deuxième forme, de la soirée créditée après coup')
    // Et la clôture d'une soirée entière, d'un seul lot.
    await profils.crediterSoireeEntiere('s2', 'salon', [{ profileId: profile.id, ...soireeAvecLeLoup(JUSTES_DES_FORMES[2] - JUSTES_DES_FORMES[1]) }])
    assert.equal(await profils.faireGrandir(profile.id), true, 'sa troisième, de la soirée close')
    // Remise au barème, sa ligne se relit — un format d'avant a pu changer de forme : un aller-retour, puis plus rien.
    await profils.remettreAuBareme(profile.id, 's1')
    assert.equal((await mesurer(() => profils.faireGrandir(profile.id))).appels, 1, 'remise au barème, la ligne se relit')
    assert.equal((await mesurer(() => profils.faireGrandir(profile.id))).appels, 0, 'relue, elle se garde')
    // Une soirée retirée : sa forme reste, mais ses bonnes réponses ne comptent plus vers la suivante. Le quiz du jour en
    // apporte juste assez pour la forme ultime si la soirée retirée comptait encore — pas assez sans elle.
    await profils.retirerSoiree(profile.id, 's2')
    profils.compagnonsDuJour = async () => ({ loup: JUSTES_DES_FORMES[3] - JUSTES_DES_FORMES[2] })
    assert.equal(await profils.faireGrandir(profile.id), false, 'la soirée retirée nourrit encore son compagnon')
    // Et une soirée effacée en entier, de même.
    await profils.retirerSoireeEntiere('s1', 'salon')
    profils.compagnonsDuJour = async () => ({ loup: JUSTES_DES_FORMES[3] - JUSTES_DES_FORMES[1] })
    assert.equal(await profils.faireGrandir(profile.id), false, 'la soirée effacée nourrit encore son compagnon')
  } finally {
    profils.close()
  }
})

test('deux serveurs : une soirée créditée par l’autre se voit à la page suivante d’ici — la niche, la forme qu’on porte —, et la fin d’une partie la sait ensuite', async () => {
  // Gardées pour toutes les lectures, ses soirées taisaient aux pages ce que l'autre serveur d'une mise en ligne avait crédité
  // — il garde les sockets de la soirée, la page du téléphone vient ici : la niche gardait l'ancienne jauge, et porter la
  // forme que la salle venait d'annoncer était refusé, jusqu'au redémarrage (la relecture du lot, le 26 octobre 2026). Une
  // page relit son historique ; ce qu'elle relit, la fin d'une partie le garde.
  const fichier = `file:${path.join(dossierDEssai(), 'profils-a-deux.db')}`
  const ici = new ProfileStore(fichier)
  const ailleurs = new ProfileStore(fichier)
  await ici.init()
  await ailleurs.init()
  try {
    const { profile } = await ici.register({ login: 'ana', password: 'motdepasse1', name: 'Ana', avatar: '🦊' })
    await ici.offrirUnCompagnon(profile.id, 'loup', DIX_HEURES)
    const rec = (await ici.byId(profile.id))!
    // Ici, sa niche lue, puis la fin d'une partie : ses soirées se gardent.
    assert.equal((await ici.compagnonsDe(rec))[0].justes, 0)
    assert.equal(await ici.faireGrandir(profile.id), false)
    // L'autre serveur crédite une soirée, et la forme qu'elle ouvre se porte ici (`PUT /api/joueur/moi`).
    await ailleurs.byId(profile.id)
    await ailleurs.creditSoiree({ profileId: profile.id, soireeId: 's1', ...soireeAvecLeLoup(JUSTES_DES_FORMES[1]) })
    await ici.update(profile.id, { legendaire: compagnon('loup')!.formes[1].key })
    assert.deepEqual(
      (await ici.compagnonsDe(rec)).map(a => [a.justes, a.rang]),
      [[JUSTES_DES_FORMES[1], 1]],
      'la niche lit ce que la base a',
    )
    // Une soirée de plus, à une bonne réponse de la forme suivante, lue par la page ; le quiz du jour donne la dernière :
    // la fin de sa partie la fait grandir, de ce que la page vient de relire.
    await ailleurs.creditSoiree({ profileId: profile.id, soireeId: 's2', ...soireeAvecLeLoup(JUSTES_DES_FORMES[2] - JUSTES_DES_FORMES[1] - 1) })
    assert.equal((await ici.compagnonsDe(rec))[0].justes, JUSTES_DES_FORMES[2] - 1)
    ici.compagnonsDuJour = async () => ({ loup: 1 })
    assert.equal(await ici.faireGrandir(profile.id), true, 'la fin ne sait pas ce que la page vient de relire')
  } finally {
    ici.close()
    ailleurs.close()
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

test('par les routes : l’accueil dit sa traversée sans un aller-retour de plus — lue en mémoire, ou rien', async () => {
  const b = await bancDuCabinet({ fraicheurDesDuelsMs: 3_600_000 })
  const traversee = (cookie: string) => lire<PageDeLaTraversee>(b, cookie, '/api/cabinet/traversee')
  const geste = (cookie: string, t: Pick<VueDeLaTraversee, 'id' | 'rang'>, g: Record<string, unknown>) =>
    poster<PageDeLaTraversee>(b, cookie, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: g })
  try {
    const chaud = await inscrireProfil(b.banc.url, 'chaud', 'Chaud')
    ok(await traversee(chaud), 'la page du premier')
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    const accueil = () =>
      fetch(`${b.banc.url}/api/joueur/moi?accueil`, { headers: { Cookie: lea } }).then(async r => {
        assert.equal(r.status, 200)
        return ((await r.json()) as { profile: ProfilDAccueil }).profile
      })
    // La nuit close, son profil en mémoire : l'accueil d'un serveur réveillé depuis un moment.
    await accueil()
    const avant = await mesurer(accueil)
    // Sa traversée, le serveur ne l'a pas encore lue : l'accueil n'en dit rien, et ne la lit pas pour lui — la plupart des
    // profils qui ouvrent l'accueil n'ouvrent pas le Cabinet, et chacun aurait payé son lot froid à chaque réveil (le quota de Turso).
    assert.equal(avant.resultat.cabinet, undefined)
    // Lue, mais jamais partie : rien à dire non plus.
    ok(await traversee(lea), 'sa page')
    assert.equal((await accueil()).cabinet, undefined)
    // Partie, ses cartes choisies : son acte et ses cœurs, de la mémoire seule.
    const neuve = ok(await poster<PageDeLaTraversee>(b, lea, '/api/cabinet/traversee', {}), 'le départ').traversee!
    const partie = ok(await geste(lea, neuve, { quoi: 'cartes', cartes: ['coup-d-oeil', 'cagnotte', 'panacee'] }), 'les cartes').traversee!
    await accueil()
    const apres = await mesurer(accueil)
    assert.deepEqual(apres.resultat.cabinet, { acte: 1, coeurs: partie.coeurs })
    assert.equal(apres.appels, avant.appels, 'la traversée en mémoire : pas un aller-retour de plus')
    // Le serveur redémarré ne l'a plus : l'accueil se tait de nouveau, jusqu'à la prochaine page du Cabinet.
    await b.banc.redemarrer()
    assert.equal((await accueil()).cabinet, undefined)
    const relue = ok(await traversee(lea), 'sa page après le réveil').traversee!
    assert.deepEqual((await accueil()).cabinet, { acte: 1, coeurs: partie.coeurs })
    // Abandonnée : plus de voyage à dire.
    ok(await geste(lea, relue, { quoi: 'abandonner' }), 'abandonner')
    assert.equal((await accueil()).cabinet, undefined)
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

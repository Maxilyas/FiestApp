// La poussière d'or du Cabinet de curiosités, par ses routes : acheter une
// œuvre qui manque, dorer le cadre d'une œuvre qu'il a, changer le jeu d'une
// case de la visite, lire le cartel d'une œuvre, relire une partie (« Mes
// réponses ») — et ce que la base garde seule : le solde vérifié dans
// l'instruction même (jamais sous zéro, même par deux serveurs), le prix
// montré par la page, un achat rejoué qui ne paie pas deux fois, un échange
// par jour, et la case échangée qui part à son jeu neuf ; rien ne se dépense
// pendant qu'une partie attend, sans que la visite trahisse l'œuvre qu'elle
// vise. Puis ce que la poussière ne touche pas : ni les confettis, ni
// l'économie du QG (D15). « Retenter » et les cinq libres payées, comptés par
// la base, ont leur place ici aussi : ce sont des droits du jour, comme
// l'échange. Et les fonctions mêmes de la page (`api.cabinet`, chargées dans
// Node) lisent ce que ces routes rendent. Le pli, la visite et les refus en
// mots ont leurs épreuves pures (`cabinet-regles.test.ts`) ; les allers-retours
// de chaque route, `cabinet-charge.test.ts` ; le plan de chaque instruction,
// `cabinet-index.test.ts`.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { connexionAnimateur, inscrireProfil } from './banc'
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
  jouerUnPari,
  laPage,
  lire,
  magasinDEssai,
  ok,
  poster,
  unPariParfait,
  type BancDuCabinet,
} from './cabinet-banc'
import { LIBRES_QUI_PAIENT, PRIX_D_UNE_DORURE, PRIX_D_UNE_OEUVRE } from '../../shared/cabinet/bareme'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, oeuvre, type CleDOeuvre } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { poussieresDites } from '../../shared/cabinet/musee'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import { JEUX } from '../../shared/cabinet/jeux/regle'
import type { Cartel, PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import type { PageDeLEconomie } from '../../shared/qgEconomie'
import { CABINET_SANS_PROFIL } from '../src/cabinet'
import { cartelDe } from '../src/core/cabinet/vue'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

let b: BancDuCabinet
before(async () => {
  b = await bancDuCabinet()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const compter = (sql: string, ...args: unknown[]) => enBase(b.fichier, db => (db.prepare(sql).get(...args) as { n: number }).n)

/**
 * De la poussière d'or posée en base, derrière le dos du serveur — gagnée
 * partie après partie, il en faudrait des dizaines. Avant sa première page du
 * Cabinet : le musée se lit alors à froid, et la voit.
 */
const donnerALaMain = (fichier: string, profil: string, poussiere: number) =>
  aLaMain(
    fichier,
    `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${profil}', ${poussiere}, 0, 0)
     ON CONFLICT (profile_id) DO UPDATE SET poussiere = ${poussiere}`,
  )

/** Une joueuse neuve qui a de la poussière d'or. */
async function avecDeLaPoussiere(login: string, poussiere: number): Promise<{ cookie: string; id: string }> {
  const cookie = await inscrireProfil(b.banc.url, login, login.toUpperCase())
  const id = await idDe(cookie)
  donnerALaMain(b.fichier, id, poussiere)
  return { cookie, id }
}

const acheter = (cookie: string | undefined, cle: string, prix: unknown) => poster<PageDuCabinet>(b, cookie, `/api/cabinet/oeuvre/${cle}/achat`, { prix })
const dorer = (cookie: string | undefined, cle: string, prix: unknown) => poster<PageDuCabinet>(b, cookie, `/api/cabinet/oeuvre/${cle}/dorure`, { prix })
const echanger = (cookie: string | undefined, k: unknown) => poster<PageDuCabinet>(b, cookie, '/api/cabinet/visite/echange', { case: k })
const leCartel = (cookie: string | undefined, cle: string) => lire<Cartel>(b, cookie, `/api/cabinet/oeuvre/${cle}`)
const laPartie = (cookie: string | undefined, id: string) => lire<VueDeLaPartie>(b, cookie, `/api/cabinet/partie/${id}`)

const oeuvreVue = (p: PageDuCabinet, cle: string) => p.salles.flatMap(s => s.oeuvres).find(o => o.cle === cle)!
const prixDAchat = (cle: string) => PRIX_D_UNE_OEUVRE[oeuvre(cle)!.rarete]
const prixDeDorure = (cle: string) => PRIX_D_UNE_DORURE[oeuvre(cle)!.rarete]

/** Des œuvres qui manquent à un profil neuf : des communes, et une épique ; une commune qui se trouve au Pari. */
const manquantes = OEUVRES.filter(o => !OEUVRES_DE_DEPART.includes(o.cle))
const [communeA, communeB, communeC] = manquantes.filter(o => o.rarete === 'commun').map(o => o.cle)
const epique = manquantes.find(o => o.rarete === 'epique')!.cle
const communeDuPari = manquantes.find(o => o.rarete === 'commun' && JEU_DE_L_OEUVRE[o.cle] === 'pari')!.cle

const refus = <T>(r: { status: number; corps: T }) => [r.status, r.corps]

/** Le solde tel que la base le compte : la poussière gagnée, moins chaque prix payé. */
const soldeEnBase = (fichier: string, profil: string) =>
  enBase(fichier, db =>
    db
      .prepare('SELECT p.poussiere - (SELECT COALESCE(SUM(COALESCE(prix, 0) + COALESCE(prix_dorure, 0)), 0) FROM cabinet_oeuvres WHERE profile_id = p.profile_id) AS solde FROM cabinet_profils p WHERE profile_id = ?')
      .get(profil),
  )

// ── Acheter ───────────────────────────────────────────────────────────────

test('acheter : le prix montré, le solde vérifié, et rejoué il ne paie pas deux fois', async () => {
  const lea = await avecDeLaPoussiere('lea', 700)
  const prix = prixDAchat(communeA)
  assert.equal(ok(await laPage(b, lea.cookie), 'la page').poussiere, 700)
  assert.equal(oeuvreVue(ok(await laPage(b, lea.cookie), 'la page'), communeA).prix, prix, 'le prix que la page montre')

  // Le prix qu'elle a montré, et pas un autre : changé depuis, il se refuse plutôt que de payer ce qu'il n'a pas vu.
  assert.deepEqual(refus(await acheter(lea.cookie, communeA, prix + 1)), [400, { error: `Le prix a changé : ${poussieresDites(prix)}. Réessaie.` }])
  assert.deepEqual(refus(await acheter(lea.cookie, communeA, String(prix))), [400, { error: `Le prix a changé : ${poussieresDites(prix)}. Réessaie.` }])

  const achetee = await acheter(lea.cookie, communeA, prix)
  assert.equal(achetee.entetes.get('cache-control'), 'no-store')
  const page = ok(achetee, 'l’achat')
  assert.equal(page.poussiere, 700 - prix, 'la page d’après : le solde, moins son prix')
  assert.deepEqual([oeuvreVue(page, communeA).possedee, oeuvreVue(page, communeA).origine], [true, 'achat'])
  assert.equal(page.maintenant, b.horloge.t, 'l’heure du serveur, que la page mesure')
  const ligne = () => enBase(b.fichier, db => db.prepare('SELECT origine, prix, gagnee_le FROM cabinet_oeuvres WHERE profile_id = ? AND oeuvre = ?').get(lea.id, communeA))
  assert.deepEqual(ligne(), { origine: 'achat', prix, gagnee_le: b.horloge.t }, 'le prix payé s’écrit avec la ligne')

  // Rejoué — la réponse perdue en route, l'écriture qui attend le réveil (`auReveil`) — : la page, rien de payé deux fois.
  assert.equal(ok(await acheter(lea.cookie, communeA, prix), 'rejoué').poussiere, 700 - prix)
  await b.banc.redemarrer()
  assert.equal(ok(await acheter(lea.cookie, communeA, prix), 'rejoué après un redémarrage').poussiere, 700 - prix)
  assert.equal(compter('SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?', lea.id), 1)
  assert.deepEqual(ligne(), { origine: 'achat', prix, gagnee_le: DIX_HEURES })

  // Ce qui ne s'achète pas, en mots.
  assert.deepEqual(refus(await acheter(lea.cookie, epique, prixDAchat(epique))), [400, { error: `Il te manque ${poussieresDites(prixDAchat(epique) - (700 - prix))}` }])
  assert.deepEqual(refus(await acheter(lea.cookie, 'prudence', prixDAchat('prudence'))), [400, { error: 'Elle est déjà à toi' }])
  assert.deepEqual(refus(await acheter(lea.cookie, 'lg:phenix', 400)), [400, { error: 'Un gardien ne s’achète pas : il se réveille' }])
  assert.deepEqual(refus(await acheter(lea.cookie, 'nulle-part', 200)), [400, { error: 'Cette œuvre n’est pas au Cabinet' }])
  // Sans profil, le Cabinet le dit.
  assert.deepEqual(refus(await acheter(undefined, communeB, prixDAchat(communeB))), [401, { error: CABINET_SANS_PROFIL }])
  assert.equal(ok(await laPage(b, lea.cookie), 'la page').poussiere, 700 - prix)
})

test('le solde ne passe jamais sous zéro : deux serveurs, chacun sa mémoire, la base seule tranche', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const autre = await magasinDEssai(fichier, horloge)
  const prix = prixDAchat(communeA)
  donnerALaMain(fichier, 'qui', prix + prix / 2)
  // Les deux serveurs ont son musée en mémoire : chacun croit qu'il a de quoi acheter.
  assert.equal((await a.cabinet.page('qui')).musee.profil?.poussiere, prix + prix / 2)
  await autre.cabinet.page('qui')
  await a.cabinet.acheter('qui', communeA, prix)
  // L'autre, devancé : sa mémoire dit assez, la base non — il relit, et le dit en mots.
  await assert.rejects(autre.cabinet.acheter('qui', communeB, prix), { message: `Il te manque ${poussieresDites(prix / 2)}` })
  const solde = () => soldeEnBase(fichier, 'qui')
  assert.deepEqual(solde(), { solde: prix / 2 })
  // Le même achat, rejoué par l'autre serveur : il le trouve fait, et ne paie rien.
  assert.equal((await autre.cabinet.acheter('qui', communeA, prix)).musee.oeuvres.get(communeA)?.prix, prix)
  assert.deepEqual(solde(), { solde: prix / 2 })

  // Et l'inverse : sa mémoire dit trop peu, quand l'autre serveur vient de lui faire gagner de la poussière. Il relit
  // avant de refuser, et l'achat passe.
  aLaMain(fichier, "UPDATE cabinet_profils SET poussiere = poussiere + 1000 WHERE profile_id = 'qui'")
  await a.cabinet.acheter('qui', epique, prixDAchat(epique))
  assert.deepEqual(solde(), { solde: prix / 2 + 1000 - prixDAchat(epique) })
})

// ── Dorer ─────────────────────────────────────────────────────────────────

test('dorer : une œuvre de départ prend sa ligne, une achetée garde la sienne ; jamais deux fois', async () => {
  // De quoi acheter une commune et dorer deux cadres, pas un de plus.
  const achat = prixDAchat(communeB)
  const initiale = achat + prixDeDorure('prudence') + prixDeDorure(communeB) + prixDeDorure('concentration') / 2
  const tom = await avecDeLaPoussiere('tom', initiale)
  ok(await acheter(tom.cookie, communeB, achat), 'l’achat')
  const lignes = () =>
    enBase(b.fichier, db => db.prepare('SELECT oeuvre, origine, prix, doree_le, dorure, prix_dorure FROM cabinet_oeuvres WHERE profile_id = ? ORDER BY oeuvre').all(tom.id))

  // Une œuvre de départ n'a pas de ligne : la sienne naît pour son cadre doré, d'origine « départ ».
  const prudence = prixDeDorure('prudence')
  assert.equal(oeuvreVue(ok(await laPage(b, tom.cookie), 'la page'), 'prudence').prix, prudence, 'le prix de sa dorure, que la page montre')
  assert.deepEqual(refus(await dorer(tom.cookie, 'prudence', prixDAchat('prudence'))), [400, { error: `Le prix a changé : ${poussieresDites(prudence)}. Réessaie.` }])
  let page = ok(await dorer(tom.cookie, 'prudence', prudence), 'dorer Prudence')
  assert.equal(oeuvreVue(page, 'prudence').doree, true)
  assert.equal(page.poussiere, initiale - achat - prudence)
  // L'achetée garde son origine et son prix ; sa dorure s'écrit à côté.
  page = ok(await dorer(tom.cookie, communeB, prixDeDorure(communeB)), 'dorer l’achetée')
  assert.equal(page.poussiere, initiale - achat - prudence - prixDeDorure(communeB))
  assert.deepEqual(lignes(), [
    { oeuvre: communeB, origine: 'achat', prix: achat, doree_le: b.horloge.t, dorure: 'poussiere', prix_dorure: prixDeDorure(communeB) },
    { oeuvre: 'prudence', origine: 'depart', prix: null, doree_le: b.horloge.t, dorure: 'poussiere', prix_dorure: prudence },
  ].sort((x, y) => (x.oeuvre < y.oeuvre ? -1 : 1)))

  // Rejouée, elle ne paie rien de plus.
  assert.equal(ok(await dorer(tom.cookie, 'prudence', prudence), 'rejouée').poussiere, page.poussiere)
  assert.equal(lignes().length, 2)
  // Ce qui ne se dore pas, en mots.
  assert.deepEqual(refus(await dorer(tom.cookie, communeC, prixDeDorure(communeC))), [400, { error: 'Elle n’est pas encore à toi : gagne-la ou achète-la d’abord' }])
  assert.deepEqual(refus(await dorer(tom.cookie, 'lg:chouette', 100)), [400, { error: 'Un gardien ne s’achète pas : il se réveille' }])
  // Plus assez : ce qu'il manque.
  assert.deepEqual(refus(await dorer(tom.cookie, 'concentration', prixDeDorure('concentration'))), [400, { error: `Il te manque ${poussieresDites(prixDeDorure('concentration') / 2)}` }])
})

test('une œuvre dorée en jouant ne se dore pas à la poussière', async () => {
  const ana = await avecDeLaPoussiere('ana', 500)
  const chasse = ok(await commencer(b, ana.cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  const fin = await unPariParfait(b, ana.cookie, chasse)
  assert.equal(fin.bilan?.issue, 'gagnee-doree')
  assert.deepEqual(refus(await dorer(ana.cookie, 'lecon', prixDeDorure('lecon'))), [400, { error: 'Son cadre est déjà doré' }])
})

test('deux serveurs : chaque garde de la dépense tient dans la base même, la mémoire de l’autre en retard', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const autre = await magasinDEssai(fichier, horloge)
  const prix = prixDAchat(communeA)
  const initiale = 2 * prix + 1000
  donnerALaMain(fichier, 'qui', initiale)
  await a.cabinet.page('qui')
  await autre.cabinet.page('qui')
  const ligne = (cle: string) =>
    enBase(fichier, db => db.prepare('SELECT origine, serie_id, prix, doree_le, dorure, prix_dorure FROM cabinet_oeuvres WHERE profile_id = ? AND oeuvre = ?').get('qui', cle))

  // Le même achat sur les deux : l'autre croit l'œuvre à acheter, et assez pour deux. La clé de la ligne refuse la
  // seconde (`ON CONFLICT DO NOTHING`) — sans elle, une erreur de la base, un 500 — ; il relit, la trouve achetée,
  // et rend la page sans rien payer de plus.
  await a.cabinet.acheter('qui', communeA, prix)
  const page = await autre.cabinet.acheter('qui', communeA, prix)
  assert.equal(page.musee.oeuvres.get(communeA)?.origine, 'achat')
  assert.deepEqual(soldeEnBase(fichier, 'qui'), { solde: initiale - prix })

  // Son cadre doré en jouant chez l'autre — ici à la main — : la dorure à la poussière se refuse sans rien payer, et la
  // dorure de la partie reste la sienne (`doree_le IS NULL`).
  aLaMain(fichier, `UPDATE cabinet_oeuvres SET doree_le = 1, dorure = 'partie', serie_doree = 'ailleurs' WHERE profile_id = 'qui' AND oeuvre = '${communeA}'`)
  await assert.rejects(a.cabinet.dorer('qui', communeA, prixDeDorure(communeA)), { message: 'Son cadre est déjà doré' })
  assert.deepEqual(ligne(communeA), { origine: 'achat', serie_id: null, prix, doree_le: 1, dorure: 'partie', prix_dorure: null })
  assert.deepEqual(soldeEnBase(fichier, 'qui'), { solde: initiale - prix })

  // Une œuvre de départ qui a déjà sa ligne chez l'autre — le cartel d'un double — prend sa dorure sur cette ligne,
  // son cartel gardé ; dorée en jouant là-bas, elle se refuse de même.
  aLaMain(
    fichier,
    `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, serie_id) VALUES ('qui', 'prudence', 'depart', 1, 'un-double');
     INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure, serie_doree) VALUES ('qui', 'echange', 'depart', 1, 1, 'partie', 'ailleurs')`,
  )
  await a.cabinet.dorer('qui', 'prudence', prixDeDorure('prudence'))
  assert.deepEqual(ligne('prudence'), { origine: 'depart', serie_id: 'un-double', prix: null, doree_le: horloge.t, dorure: 'poussiere', prix_dorure: prixDeDorure('prudence') })
  await assert.rejects(a.cabinet.dorer('qui', 'echange', prixDeDorure('echange')), { message: 'Son cadre est déjà doré' })
  assert.deepEqual(soldeEnBase(fichier, 'qui'), { solde: initiale - prix - prixDeDorure('prudence') })

  // Une œuvre gagnée chez l'autre, que cette mémoire dit encore manquante : « pas encore à toi » se relit une fois, et
  // la dorure passe.
  aLaMain(fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES ('qui', '${communeB}', 'partie', 1)`)
  await a.cabinet.dorer('qui', communeB, prixDeDorure(communeB))
  assert.equal((ligne(communeB) as { dorure: string }).dorure, 'poussiere')
  assert.deepEqual(soldeEnBase(fichier, 'qui'), { solde: initiale - prix - prixDeDorure('prudence') - prixDeDorure(communeB) })
})

// ── Pendant une partie ────────────────────────────────────────────────────

test('pendant une partie, rien ne s’achète ni ne se dore — ni l’œuvre qu’elle met en jeu, ni une autre : une case de la visite ne trahit pas la sienne', async () => {
  const paul = await avecDeLaPoussiere('paul', 2000)
  const attend = 'Ta partie au Pari t’attend : reprends-la ou quitte-la d’abord'
  // Achetée en pleine chasse, la Leçon entrait sans la partie : arrivée au seuil, la chasse se disait « Pas assez
  // d'étoiles cette fois… L'œuvre reste à gagner. ». La dépense attend la fin, comme un départ.
  const chasse = ok(await commencer(b, paul.cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  assert.deepEqual(refus(await acheter(paul.cookie, 'lecon', prixDAchat('lecon'))), [400, { error: attend }])
  assert.deepEqual(refus(await acheter(paul.cookie, communeA, prixDAchat(communeA))), [400, { error: attend }])
  assert.deepEqual(refus(await dorer(paul.cookie, 'prudence', prixDeDorure('prudence'))), [400, { error: attend }])
  // Ce qui ne se ferait jamais garde son refus à lui.
  assert.deepEqual(refus(await acheter(paul.cookie, 'prudence', prixDAchat('prudence'))), [400, { error: 'Elle est déjà à toi' }])
  assert.deepEqual(refus(await dorer(paul.cookie, communeA, prixDeDorure(communeA))), [400, { error: 'Elle n’est pas encore à toi : gagne-la ou achète-la d’abord' }])
  const fin = await unPariParfait(b, paul.cookie, chasse)
  assert.deepEqual([fin.bilan?.issue, fin.bilan?.oeuvre], ['gagnee-doree', 'lecon'], 'la Leçon entre en jouant, sans rien payer')
  const apres = ok(await laPage(b, paul.cookie), 'la page')
  assert.equal(apres.poussiere, 2000 + fin.bilan!.poussiere)
  // Finie, la poussière se dépense.
  assert.equal(ok(await acheter(paul.cookie, communeA, prixDAchat(communeA)), 'l’achat, la partie finie').poussiere, apres.poussiere - prixDAchat(communeA))

  // En visite : l'œuvre que la case met en jeu ne se nomme pas (invariant 1). Refusée pour elle seule, son achat
  // l'aurait dite ; elle se refuse dans les mêmes mots que toute autre.
  const rose = await avecDeLaPoussiere('rose', 2000)
  const visite = ok(await commencer(b, rose.cookie, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const cible = departEnBase(b.fichier, visite.id).cible as CleDOeuvre
  assert.ok(cible && !OEUVRES_DE_DEPART.includes(cible), 'une œuvre à gagner')
  const autre = manquantes.find(o => o.cle !== cible)!.cle
  const attendLaVisite = `Ta partie ${JEUX[visite.jeu].a} t’attend : reprends-la ou quitte-la d’abord`
  for (const cle of [cible, autre]) assert.deepEqual(refus(await acheter(rose.cookie, cle, prixDAchat(cle))), [400, { error: attendLaVisite }], cle)
  const quittee = ok(await jouer(b, rose.cookie, visite, { quoi: 'quitter' }), 'quitter')
  assert.equal(ok(await acheter(rose.cookie, cible, prixDAchat(cible)), 'l’achat, la visite quittée').poussiere, 2000 + quittee.bilan!.poussiere - prixDAchat(cible))
})

test('deux serveurs : une partie commencée chez l’autre retient la dépense, que cette mémoire ne la connaisse pas encore', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const autre = await magasinDEssai(fichier, horloge)
  donnerALaMain(fichier, 'qui', 2000)
  await autre.cabinet.page('qui')
  // L'autre ne sait rien de la chasse : sa règle laisse passer, la base non (`partie IS NULL`) — il relit, et le dit.
  const chasse = await a.cabinet.commencer('qui', { origine: 'chasse', oeuvre: 'lecon', carte: null })
  await assert.rejects(autre.cabinet.acheter('qui', 'lecon', prixDAchat('lecon')), { message: 'Ta partie au Pari t’attend : reprends-la ou quitte-la d’abord' })
  await assert.rejects(autre.cabinet.dorer('qui', 'prudence', prixDeDorure('prudence')), { message: 'Ta partie au Pari t’attend : reprends-la ou quitte-la d’abord' })
  assert.equal(enBase(fichier, db => (db.prepare('SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = ?').get('qui') as { n: number }).n), 0, 'rien d’acheté ni de doré')
  assert.deepEqual(soldeEnBase(fichier, 'qui'), { solde: 2000 })
  // Quittée, sa poussière au solde : la dépense passe.
  const fin = await a.cabinet.geste('qui', chasse.id, chasse.etat.rang, { quoi: 'quitter' })
  assert.ok('partie' in fin)
  await a.cabinet.acheter('qui', 'lecon', prixDAchat('lecon'))
  assert.deepEqual(soldeEnBase(fichier, 'qui'), { solde: 2000 + fin.partie.bilan!.poussiere - prixDAchat('lecon') })
})

test('une partie d’un jour d’avant ne retient pas la poussière : la dépense la clôt d’abord, comme la page et le départ', async () => {
  const jo = await avecDeLaPoussiere('jo', 1000)
  const hier = ok(await commencer(b, jo.cookie, { origine: 'libre', jeu: 'pari', carte: null }), 'la libre d’hier')
  b.horloge.t += 24 * 3_600_000
  try {
    const page = ok(await acheter(jo.cookie, communeA, prixDAchat(communeA)), 'l’achat du lendemain')
    assert.equal(page.enCours, null)
    assert.equal(oeuvreVue(page, communeA).possedee, true)
    assert.equal(ok(await laPartie(jo.cookie, hier.id), 'la partie d’hier').bilan?.lendemain, true, 'close par le serveur, comme « Quitter »')
  } finally {
    b.horloge.t = DIX_HEURES
  }
})

// ── Échanger ──────────────────────────────────────────────────────────────

test('changer le jeu d’une case de la visite : une fois par jour, une case pas jouée, et la visite figée tient d’un réveil à l’autre', async () => {
  const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
  const avant = ok(await laPage(b, zoe), 'la page').visite
  assert.deepEqual(avant.echange, { possible: true })
  const page = ok(await echanger(zoe, 1), 'l’échange')
  const apres = page.visite
  const neuf = apres.cases[1].jeu
  assert.ok(JEUX_PRETS.includes(neuf) && !avant.cases.some(c => c.jeu === neuf), `un jeu livré qui n’était pas de la visite : ${neuf}`)
  assert.deepEqual(apres.cases[1].enJeu, avant.cases[1].enJeu, 'l’œuvre en jeu reste')
  assert.deepEqual([apres.cases[0], apres.cases[2]], [avant.cases[0], avant.cases[2]], 'les autres cases ne bougent pas')
  assert.deepEqual(apres.echange, { possible: false, refus: 'Tu as déjà changé un jeu aujourd’hui' })
  assert.deepEqual(refus(await echanger(zoe, 2)), [400, { error: 'Tu as déjà changé un jeu aujourd’hui' }])

  // Figée en base : un redémarrage la relit telle quelle, et la case part à son jeu neuf.
  await b.banc.redemarrer()
  assert.deepEqual(ok(await laPage(b, zoe), 'la page relue').visite, apres)
  const partie = ok(await commencer(b, zoe, { origine: 'visite', case: 1, carte: null }), 'la case échangée')
  assert.equal(partie.jeu, neuf)
  ok(await jouer(b, zoe, partie, { quoi: 'quitter' }), 'quitter')

  // Une case déjà jouée ne s'échange pas ; une case qui n'existe pas non plus.
  const eva = await inscrireProfil(b.banc.url, 'eva', 'Éva')
  const jouee = ok(await commencer(b, eva, { origine: 'visite', case: 0, carte: null }), 'la case 0')
  ok(await jouer(b, eva, jouee, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual(refus(await echanger(eva, 0)), [400, { error: 'Cette partie de la visite est déjà jouée' }])
  assert.deepEqual(refus(await echanger(eva, 7)), [400, { error: 'Choisis une partie de la visite' }])
  assert.deepEqual(refus(await echanger(eva, '1')), [400, { error: 'Choisis une partie de la visite' }])
  assert.deepEqual(refus(await echanger(undefined, 1)), [401, { error: CABINET_SANS_PROFIL }])
  ok(await echanger(eva, 2), 'une case pas jouée')

  // Le lendemain, un échange de plus.
  b.horloge.t += 24 * 3_600_000
  try {
    assert.deepEqual(ok(await laPage(b, zoe), 'le lendemain').visite.echange, { possible: true })
  } finally {
    b.horloge.t = DIX_HEURES
  }
})

test('deux serveurs : un seul échange par jour, et pas sur une case que l’autre a commencée', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const autre = await magasinDEssai(fichier, horloge)
  await autre.cabinet.page('qui')
  await a.cabinet.echanger('qui', 0)
  await assert.rejects(autre.cabinet.echanger('qui', 1), { message: 'Tu as déjà changé un jeu aujourd’hui' })
  const visites = enBase(fichier, db => JSON.parse((db.prepare('SELECT visites FROM cabinet_profils WHERE profile_id = ?').get('qui') as { visites: string }).visites))
  assert.equal(visites[0].echange, 0, 'l’échange de la case 0, une fois')

  await autre.cabinet.page('deux')
  const p = await a.cabinet.commencer('deux', { origine: 'visite', case: 2, carte: null })
  assert.ok('partie' in (await a.cabinet.geste('deux', p.id, p.etat.rang, { quoi: 'quitter' })))
  await assert.rejects(autre.cabinet.echanger('deux', 2), { message: 'Cette partie de la visite est déjà jouée' })
  // Sa mémoire relue, il sait : la case commencée là-bas, et l'échange encore possible ailleurs.
  await autre.cabinet.echanger('deux', 1)
})

test('deux serveurs : une case échangée chez l’autre part à son jeu neuf, jamais au jeu que la mémoire lui donnait', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const autre = await magasinDEssai(fichier, horloge)
  // L'autre fige la visite en jouant sa case 0 : sa mémoire la garde telle quelle.
  const p = await autre.cabinet.commencer('qui', { origine: 'visite', case: 0, carte: null })
  assert.ok('partie' in (await autre.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })))
  const avant = (await autre.cabinet.page('qui')).visite.cases[1].jeu
  // Celui-ci change le jeu de la case 1, en base.
  const neuf = (await a.cabinet.echanger('qui', 1)).visite.cases[1].jeu
  assert.notEqual(neuf, avant)
  // L'autre la commence sur sa mémoire d'avant : la base dit la case à un autre jeu, il relit, et la partie part au
  // jeu que la visite figée lui donne — celui que la page de l'autre serveur montrait.
  const partie = await autre.cabinet.commencer('qui', { origine: 'visite', case: 1, carte: null })
  assert.equal(partie.depart.jeu, neuf)
  assert.equal(departEnBase(fichier, partie.id).jeu, neuf)
})

// ── Le cartel ─────────────────────────────────────────────────────────────

test('le cartel : la manche que la partie lui a gardée, relue par le même pli ; sinon ce qui l’a fait entrer', async () => {
  const max = await avecDeLaPoussiere('max', 1000)
  // Une chasse gagnée sans faute : la Leçon entre, son cartel garde une manche.
  const chasse = ok(await commencer(b, max.cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  const fin = await unPariParfait(b, max.cookie, chasse)
  const garde = fin.bilan?.cartel
  assert.ok(garde, 'la partie garde une manche')
  const lu = await leCartel(max.cookie, 'lecon')
  assert.equal(lu.entetes.get('cache-control'), 'no-store')
  const cartel = ok(lu, 'le cartel de la Leçon')
  const tirage = departEnBase(b.fichier, chasse.id).tirages[garde.manche] as PariTire
  assert.deepEqual(cartel, {
    oeuvre: 'lecon',
    origine: 'partie',
    doree: true,
    partie: {
      id: chasse.id,
      jeu: 'pari',
      jour: 'le 24 octobre 2026',
      total: 9,
      issue: 'gagnee-doree',
      sujet: garde.sujet,
      reponse: garde.reponse,
      anecdote: garde.anecdote,
    },
  })
  // La question telle que la partie l'a lue — pariée, la difficile —, sa bonne réponse, « Le savais-tu ? ».
  assert.deepEqual(
    { sujet: garde.sujet, reponse: garde.reponse, anecdote: garde.anecdote },
    { sujet: tirage.q2.texte, reponse: tirage.q2.reponses[tirage.q2.bonne], anecdote: tirage.q2.anecdote },
  )
  // Relu après un redémarrage : le même, par le même pli (invariant 14).
  await b.banc.redemarrer()
  assert.deepEqual(ok(await leCartel(max.cookie, 'lecon'), 'relu'), cartel)

  // Les cartels d'office : offerte, achetée — et une achetée rejouée pour sa dorure prend la manche de sa partie.
  const offerte = ok(await leCartel(max.cookie, 'coup-d-oeil'), 'une œuvre de départ')
  assert.deepEqual([offerte.origine, offerte.doree, offerte.partie], ['depart', false, undefined])
  assert.match(offerte.dit ?? '', /^Offerte à ton arrivée\./)
  ok(await acheter(max.cookie, communeDuPari, prixDAchat(communeDuPari)), 'l’achat')
  const achetee = ok(await leCartel(max.cookie, communeDuPari), 'l’achetée')
  assert.deepEqual([achetee.origine, achetee.doree, achetee.partie], ['achat', false, undefined])
  assert.match(achetee.dit ?? '', /^Achetée avec ta poussière d’or\. Rejoue-la/)
  const dorure = ok(await commencer(b, max.cookie, { origine: 'chasse', oeuvre: communeDuPari, carte: null }), 'la chasse pour la dorer')
  assert.equal((await unPariParfait(b, max.cookie, dorure)).bilan?.issue, 'doree')
  const rejouee = ok(await leCartel(max.cookie, communeDuPari), 'l’achetée, dorée en jouant')
  // Son cartel dit ce que la partie lui a fait : la dorer, pas la gagner — achetée, elle l'était déjà.
  assert.deepEqual([rejouee.origine, rejouee.doree, rejouee.partie?.id, rejouee.partie?.issue, rejouee.dit], ['achat', true, dorure.id, 'doree', undefined])

  // Une œuvre qui n'est pas à lui n'a pas de cartel ; une clé inconnue non plus ; sans profil, le Cabinet le dit.
  assert.deepEqual(refus(await leCartel(max.cookie, epique)), [404, { error: 'Elle n’est pas encore à toi : gagne-la ou achète-la d’abord' }])
  assert.deepEqual(refus(await leCartel(max.cookie, 'nulle-part')), [404, { error: 'Cette œuvre n’est pas au Cabinet' }])
  assert.deepEqual(refus(await leCartel(undefined, 'lecon')), [401, { error: CABINET_SANS_PROFIL }])
})

test('le cartel d’une œuvre gagnée sans rien à raconter dit le jour où elle est entrée, pas celui de sa partie', () => {
  // Gagnée à 0 h 30 le 25 à Paris : sa partie a pu partir la veille, ou attendre que la page d'un autre jour la close.
  // La ligne ne garde que l'heure de son entrée (`gagnee_le`) : la phrase dit donc l'entrée, jamais « gagnée le 24 ».
  const entree = Date.UTC(2026, 9, 24, 22, 30)
  const ligne = { oeuvre: communeA, origine: 'partie', gagneeLe: entree, saison: null, serieId: null, prix: null, doreeLe: null, dorure: null, prixDorure: null, serieDoree: null } as const
  assert.equal(
    cartelDe({ oeuvre: communeA, ligne, partie: null }).dit,
    'Entrée dans ton musée le 25 octobre 2026, gagnée en jouant. Rejoue-la pour dorer son cadre : elle gardera ici ce que tu auras appris.',
  )
  assert.equal(cartelDe({ oeuvre: communeA, ligne: { ...ligne, doreeLe: entree, dorure: 'partie' }, partie: null }).dit, 'Entrée dans ton musée le 25 octobre 2026, gagnée en jouant.')
})

// ── « Mes réponses » ──────────────────────────────────────────────────────

test('« Mes réponses » : une partie finie relue, chaque manche révélée ; celle en cours, comme la page la dit ; celle d’un autre, introuvable', async () => {
  const ines = await inscrireProfil(b.banc.url, 'ines', 'Inès')
  let v = ok(await commencer(b, ines, { origine: 'libre', jeu: 'pari', carte: null }), 'commencer')
  v = await jouerUnPari(b, ines, v, 0, 'garder')
  const fin = ok(await jouer(b, ines, v, { quoi: 'quitter' }), 'quitter')
  const relue = await laPartie(ines, fin.id)
  assert.equal(relue.entetes.get('cache-control'), 'no-store')
  // La même vue que la fin, par le même pli — sauf ce que la fin seule sait : ce qu'elle a rapporté.
  const { gains, ...sansGains } = fin.bilan!
  assert.ok(gains)
  assert.deepEqual(ok(relue, 'relue'), { ...fin, bilan: sansGains })
  assert.ok(ok(relue, 'relue').manches[0].revelation, 'chaque manche tranchée, révélée')
  await b.banc.redemarrer()
  assert.deepEqual(ok(await laPartie(ines, fin.id), 'relue après un redémarrage'), { ...fin, bilan: sansGains })

  // En cours : la vue que la page dit, au même instant.
  const enCours = ok(await commencer(b, ines, { origine: 'libre', jeu: 'eclair', carte: null }), 'une autre')
  assert.deepEqual(ok(await laPartie(ines, enCours.id), 'en cours'), ok(await laPage(b, ines), 'la page').enCours)

  // Celle d'un autre profil, ou qui n'existe pas : introuvable (invariant 3).
  const noe = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  for (const [qui, id] of [
    [noe, fin.id],
    [noe, enCours.id],
    [ines, 'nulle-part'],
  ] as const) {
    assert.deepEqual(refus(await laPartie(qui, id)), [404, { error: 'Cette partie est introuvable' }])
  }
  assert.deepEqual(refus(await laPartie(undefined, fin.id)), [401, { error: CABINET_SANS_PROFIL }])
  ok(await jouer(b, ines, enCours, { quoi: 'quitter' }), 'quitter')
})

// ── Les droits du jour ────────────────────────────────────────────────────

test('« Retenter » : après une visite manquée, une chasse au jeu de la visite, pour cette œuvre seulement', async () => {
  const sam = await inscrireProfil(b.banc.url, 'sam', 'Sam')
  const { visite } = ok(await laPage(b, sam), 'la page')
  const partie = ok(await commencer(b, sam, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const cible = departEnBase(b.fichier, partie.id).cible as CleDOeuvre
  assert.ok(cible, 'une œuvre à gagner')
  // Quittée sans une étoile : manquée. Retenter ne vaut que pour son œuvre.
  ok(await jouer(b, sam, partie, { quoi: 'quitter' }), 'quitter : manquée')
  const autreOeuvre = manquantes.find(o => o.cle !== cible && JEUX_PRETS.includes(JEU_DE_L_OEUVRE[o.cle]))!.cle
  assert.deepEqual(refus(await commencer(b, sam, { origine: 'chasse', oeuvre: autreOeuvre, carte: null, retente: true })), [
    400,
    { error: 'Retenter ne sert qu’après une visite manquée de cette œuvre' },
  ])
  const retente = ok(await commencer(b, sam, { origine: 'chasse', oeuvre: cible, carte: null, retente: true }), 'retenter')
  assert.equal(retente.jeu, visite.cases[0].jeu, 'au jeu de la visite, pas à celui de l’œuvre')
  assert.equal(departEnBase(b.fichier, retente.id).retente, true)
  ok(await jouer(b, sam, retente, { quoi: 'quitter' }), 'quitter')
  assert.equal(ok(await laPage(b, sam), 'la page').chasses.restent, 1, 'retenter prend une chasse')
})

test('les cinq libres qui paient se comptent par la base, même jouées sur deux serveurs', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const a = await magasinDEssai(fichier, horloge)
  const autre = await magasinDEssai(fichier, horloge)
  await autre.cabinet.page('qui')
  const libre = async (m: typeof a) => {
    const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: null })
    assert.ok('partie' in (await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })))
    return departEnBase(fichier, p.id).payee
  }
  const payees: boolean[] = []
  for (let i = 0; i < 3; i++) payees.push(await libre(a))
  // L'autre n'en a vu aucune : la base les recompte dans l'insertion même.
  for (let i = 0; i < 3; i++) payees.push(await libre(autre))
  assert.deepEqual(payees, [...Array(LIBRES_QUI_PAIENT).fill(true), false])
})

// ── Par les fonctions mêmes de la page ────────────────────────────────────

test('par les fonctions mêmes de la page (`api.cabinet`) contre le vrai serveur : l’achat, la dorure, l’échange, le cartel, « Mes réponses »', async () => {
  const hugo = await avecDeLaPoussiere('hugo', 1000)
  const avantFetch = globalThis.fetch
  const avantWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  // Le module de la page lit son adresse à l'import (`state.ts`) et parle au serveur par des adresses relatives, avec
  // son cookie : le banc les lui prête, le temps de l'épreuve.
  Object.assign(globalThis, { window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })
  globalThis.fetch = ((u: string, init: RequestInit = {}) => avantFetch(`${b.banc.url}${u}`, { ...init, headers: { ...(init.headers as object), Cookie: hugo.cookie } })) as typeof fetch
  try {
    const { api } = await import(new URL('../../client/src/api.ts', import.meta.url).href)
    // L'achat et la dorure rendent la page d'après, telle que la page la lit (`PageDuCabinet`).
    const prix = prixDAchat(communeA)
    const achetee = (await api.cabinet.acheter(communeA, prix)) as PageDuCabinet
    assert.deepEqual([achetee.poussiere, oeuvreVue(achetee, communeA).possedee], [1000 - prix, true])
    const doree = (await api.cabinet.dorer(communeA, prixDeDorure(communeA))) as PageDuCabinet
    assert.deepEqual([doree.poussiere, oeuvreVue(doree, communeA).doree], [1000 - prix - prixDeDorure(communeA), true])
    // Un refus du serveur reste un refus, ses mots tels quels.
    await assert.rejects(api.cabinet.acheter(communeB, prix + 1), { message: `Le prix a changé : ${poussieresDites(prix)}. Réessaie.` })
    // L'échange, la page d'après.
    const avant = doree.visite
    const echangee = (await api.cabinet.echanger(2)) as PageDuCabinet
    assert.notEqual(echangee.visite.cases[2].jeu, avant.cases[2].jeu)
    assert.equal(echangee.visite.echange.possible, false)
    // Le cartel, tel que la page le lit (`Cartel`).
    const cartel = (await api.cabinet.oeuvre(communeA)) as Cartel
    assert.deepEqual([cartel.oeuvre, cartel.origine, cartel.doree], [communeA, 'achat', true])
    assert.equal(cartel.dit, 'Achetée avec ta poussière d’or.', 'doré, il ne promet plus rien')
    // « Mes réponses » : une partie commencée et quittée par la page, relue.
    const partie = (await api.cabinet.commencer({ origine: 'libre', jeu: 'eclair', carte: null })) as VueDeLaPartie
    const { partie: finie } = (await api.cabinet.geste(partie.id, partie.rang, { quoi: 'quitter' })) as { partie: VueDeLaPartie }
    const relue = (await api.cabinet.partie(partie.id)) as VueDeLaPartie
    assert.deepEqual([relue.id, relue.phase, relue.bilan?.total], [partie.id, 'finie', finie.bilan?.total])
  } finally {
    globalThis.fetch = avantFetch
    if (avantWindow) Object.defineProperty(globalThis, 'window', avantWindow)
    else delete (globalThis as Record<string, unknown>).window
  }
})

// ── Ce que la poussière ne touche pas ─────────────────────────────────────

test('la poussière d’or ne sort jamais du Cabinet : ni les confettis du joueur, ni l’économie du QG', async () => {
  const admin = await connexionAnimateur(b.banc.url)
  const leo = await avecDeLaPoussiere('leo', 1000)
  const etat = async () => {
    const economie = (await lire<PageDeLEconomie>(b, admin, '/api/admin/economie')).corps
    const fiche = (await lire(b, admin, `/api/admin/profils/${leo.id}`)).corps
    return { achats: economie.aujourdhui.achats, depenses: economie.depenses, achatsParSorte: economie.aujourdhui.achatsParSorte, confettis: fiche.confettis }
  }
  const avant = await etat()
  ok(await acheter(leo.cookie, communeA, prixDAchat(communeA)), 'l’achat')
  ok(await dorer(leo.cookie, communeA, prixDeDorure(communeA)), 'la dorure')
  ok(await dorer(leo.cookie, 'echange', prixDeDorure('echange')), 'la dorure d’une œuvre de départ')
  assert.deepEqual(await etat(), avant)
  assert.equal(compter('SELECT COUNT(*) AS n FROM profile_achats WHERE profile_id = ?', leo.id), 0, 'rien dans les achats de la boutique')
})

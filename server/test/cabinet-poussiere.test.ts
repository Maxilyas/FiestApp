// La poussière d'or du Cabinet de curiosités, par ses routes : acheter une
// œuvre qui manque, dorer le cadre d'une œuvre qu'il a, changer le jeu d'une
// case de la visite, lire le cartel d'une œuvre, relire une partie (« Mes
// réponses ») — et ce que la base garde seule : le solde vérifié dans
// l'instruction même (jamais sous zéro, même par deux serveurs), le prix
// montré par la page, un achat rejoué qui ne paie pas deux fois, un échange
// par jour, et la case échangée qui part à son jeu neuf ; rien ne se dépense
// pendant qu'une partie attend, sans que la visite trahisse l'œuvre qu'elle
// vise. Puis ce que la poussière ne touche pas : ni les confettis, ni
// l'économie du QG (D15). « Retenter » — par la case manquée, jamais par
// l'œuvre — et les cinq libres payées, comptés par la base, ont leur place ici
// aussi : ce sont des droits du jour, comme l'échange ; et ce que le bilan d'une
// libre en dit. Et les fonctions mêmes de la page (`api.cabinet`, chargées dans
// Node) lisent ce que ces routes rendent. Le pli, la visite et les refus en
// mots ont leurs épreuves pures (`cabinet-regles.test.ts`) ; les allers-retours
// de chaque route, `cabinet-charge.test.ts` ; le plan de chaque instruction,
// `cabinet-index.test.ts`. Ce que la page en montre — le cartel, la visite et
// les jeux libres pendant une partie — se rend ici aussi, sur ce que ces routes
// rendent : les écrans écrits à la main ont leurs épreuves
// (`cabinet-ecran.test.ts`). La fiche d'une œuvre, qui disait d'avance le refus
// d'un achat, d'une dorure ou d'une chasse, a quitté la page avec le musée (le
// 31 octobre 2026) : ses refus, le serveur les dit toujours.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import React from 'react'
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
  ouvrir,
  poster,
  unPariParfait,
  type BancDuCabinet,
} from './cabinet-banc'
import { LIBRES_QUI_PAIENT, PRIX_D_UNE_DORURE, PRIX_D_UNE_OEUVRE } from '../../shared/cabinet/bareme'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART, oeuvre, type CleDOeuvre } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import {
  CASE_DEJA_FAITE,
  CHOISIS_UNE_CASE,
  LA_VISITE_A_CHANGE,
  LE_JEU_PROPOSE_A_CHANGE,
  PLUS_DE_CHASSE,
  RETENTER_SANS_VISITE_MANQUEE,
  SON_OEUVRE_EST_A_TOI,
  laPartieAttend,
  poussieresDites,
} from '../../shared/cabinet/musee'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import { JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
import { minuitDe } from '../../shared/qg'
import type { Cartel, PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import type { PageDeLEconomie } from '../../shared/qgEconomie'
import { CABINET_SANS_PROFIL } from '../src/cabinet'
import { cartelDe } from '../src/core/cabinet/vue'
import { ProfileStore } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant tout écran rendu.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

/** Un écran de la page, rendu en HTML sur ce que le serveur a rendu. */
async function ecranDeLaPage(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}
/** Ce qu'on lit d'un rendu : son texte, sans balises, les espaces insécables en espaces. */
const texteDe = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/[  ⁠]/g, ' ')
    .replace(/\s+/g, ' ')
/** Les boutons d'un écran rendu : leur texte, ceux qui sont en sourdine. */
const enSourdine = (html: string) => [...html.matchAll(/<button ([^>]*)>(.*?)<\/button>/g)].filter(([, a]) => /aria-disabled="true"/.test(a)).map(([, , t]) => texteDe(t).trim())

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
/**
 * L'échange d'une case ; `jeu`, celui que la page a nommé (« Changer pour Le Filet »), et `jour`, celui de la visite qu'elle a
 * lue — absents, une page d'avant, qui ne les envoyait pas.
 */
const echanger = (cookie: string | undefined, k: unknown, jeu?: unknown, jour?: unknown) =>
  poster<PageDuCabinet>(b, cookie, '/api/cabinet/visite/echange', { case: k, ...(jeu !== undefined && { jeu }), ...(jour !== undefined && { jour }) })
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
  // La page que le serveur rend pendant la chasse le dit, dans les mots du refus : la partie qui attend.
  const pendant = ok(await laPage(b, paul.cookie), 'la page pendant la chasse')
  assert.equal(pendant.enCours?.id, chasse.id)
  assert.equal(laPartieAttend(pendant.enCours!.jeu), attend)
  // Ni un autre départ : la visite et les jeux libres mettent les leurs en sourdine, la raison dite une fois — celle du refus que
  // le serveur rend au départ demandé quand même.
  const jouerPendant = await ecranDeLaPage('views/cabinet/Visite', 'Visite', { page: pendant, busy: false, onJouer: () => {}, onEchanger: () => {} })
  const jouables = [...jouerPendant.matchAll(/>Jouer<\/button>/g)].length
  assert.ok(jouables > 0, 'des cases à jouer')
  assert.equal(enSourdine(jouerPendant).filter(t => t === 'Jouer').length, jouables)
  assert.equal([...texteDe(jouerPendant).matchAll(new RegExp(attend, 'g'))].length, 1)
  const libresPendant = await ecranDeLaPage('views/cabinet/Visite', 'JouerLibrement', { page: pendant, onJouer: () => {} })
  assert.equal(enSourdine(libresPendant).length, [...libresPendant.matchAll(/class="cab-jeu"/g)].length)
  assert.equal([...texteDe(libresPendant).matchAll(new RegExp(attend, 'g'))].length, 1)
  assert.deepEqual(refus(await commencer(b, paul.cookie, { origine: 'libre', jeu: 'pari', carte: null })), [400, { error: attend }])
  const fin = await unPariParfait(b, paul.cookie, chasse)
  assert.deepEqual([fin.bilan?.issue, fin.bilan?.oeuvre], ['gagnee-doree', 'lecon'], 'la Leçon entre en jouant, sans rien payer')
  const apres = ok(await laPage(b, paul.cookie), 'la page')
  assert.equal(apres.poussiere, 2000 + fin.bilan!.poussiere)
  // La partie finie, la visite répond, sans raison.
  const jouerApres = await ecranDeLaPage('views/cabinet/Visite', 'Visite', { page: apres, busy: false, onJouer: () => {}, onEchanger: () => {} })
  assert.ok(!enSourdine(jouerApres).includes('Jouer'), 'la visite répond')
  assert.doesNotMatch(texteDe(jouerApres), new RegExp(attend))
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
  // L'échange dit le jeu qu'il donnera : « Changer de jeu » partait à l'aveugle, et Ophélie, au Détail qu'elle ne savait pas
  // jouer, n'a pas osé (la tablée du 26 octobre 2026). C'est le jeu que la case prend, quelle que soit la case.
  assert.ok(avant.echange.possible, 'un échange possible')
  const promis = avant.echange.possible ? avant.echange.jeu : null
  assert.deepEqual(avant.echange, { possible: true, jeu: promis })
  const page = ok(await echanger(zoe, 1), 'l’échange')
  const apres = page.visite
  const neuf = apres.cases[1].jeu
  assert.equal(neuf, promis, 'la case prend le jeu que la page a dit')
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

  // Une case déjà jouée ne s'échange pas — dans les mots mêmes de son départ refusé : une case commencée n'a qu'une phrase —,
  // une case qui n'existe pas non plus.
  const eva = await inscrireProfil(b.banc.url, 'eva', 'Éva')
  const jouee = ok(await commencer(b, eva, { origine: 'visite', case: 0, carte: null }), 'la case 0')
  ok(await jouer(b, eva, jouee, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual(refus(await echanger(eva, 0)), [400, { error: CASE_DEJA_FAITE }])
  assert.deepEqual(refus(await commencer(b, eva, { origine: 'visite', case: 0, carte: null })), [400, { error: CASE_DEJA_FAITE }])
  assert.equal(CASE_DEJA_FAITE, 'Cette partie de la visite est déjà faite')
  assert.deepEqual(refus(await echanger(eva, 7)), [400, { error: 'Choisis une partie de la visite' }])
  assert.deepEqual(refus(await echanger(eva, '1')), [400, { error: 'Choisis une partie de la visite' }])
  assert.deepEqual(refus(await echanger(undefined, 1)), [401, { error: CABINET_SANS_PROFIL }])
  ok(await echanger(eva, 2), 'une case pas jouée')

  // Le lendemain, un échange de plus.
  b.horloge.t += 24 * 3_600_000
  try {
    const lendemain = ok(await laPage(b, zoe), 'le lendemain').visite
    assert.equal(lendemain.echange.possible, true)
    // Le jeu promis n'est pas de la visite du jour. Ceux des deux jours d'avant passent après (`jeuDeLEchange`) — mais la
    // veille d'hier, sans partie, prend les premiers de son ordre, que la page ne voit pas : les neuf jeux pris, le promis peut
    // être d'hier ; la règle s'éprouve seule (`cabinet-regles.test.ts`).
    const jeuPromis = lendemain.echange.possible ? lendemain.echange.jeu : null
    assert.ok(jeuPromis !== null && JEUX_PRETS.includes(jeuPromis) && !lendemain.cases.some(c => c.jeu === jeuPromis), `${jeuPromis}`)
  } finally {
    b.horloge.t = DIX_HEURES
  }
})

test('l’échange garde le jeu que la page a nommé : la visite changée entre la page et le geste, il se refuse en mots — une page d’avant, sans jeu, échange comme avant', async () => {
  // La page dit « Changer pour Le Filet » à 23 h 59, confirmé après minuit : le jour neuf propose un autre jeu, et l'échange
  // l'aurait donné sans le dire — le seul du jour, dépensé sur un jeu qu'on ne lui avait pas montré (la relecture du lot
  // la-partie-et-la-visite). La page envoie donc le jeu qu'elle a nommé, et le serveur le compare au sien.
  const theo = await inscrireProfil(b.banc.url, 'theo', 'Théo')
  try {
    // Le premier soir où le jeu proposé change à minuit : chaque jour tire son ordre des jeux.
    let veille: CleDeJeu | null = null
    let lendemain: CleDeJeu | null = null
    for (let jour = 1; veille === lendemain; jour++) {
      assert.ok(jour <= 10, 'dix soirs sans que le jeu proposé change à minuit')
      const minuit = minuitDe(DIX_HEURES + jour * 24 * 3_600_000)
      b.horloge.t = minuit - 30_000
      const avant = ok(await laPage(b, theo), 'la page de la veille').visite.echange
      b.horloge.t = minuit + 30_000
      const apres = ok(await laPage(b, theo), 'la page d’après minuit').visite.echange
      assert.ok(avant.possible && apres.possible)
      ;[veille, lendemain] = [avant.jeu, apres.jeu]
    }
    // La page de la veille, restée ouverte, nomme son jeu : refusé en mots, rien d'écrit — l'échange du jour reste à prendre.
    assert.deepEqual(refus(await echanger(theo, 1, veille)), [400, { error: LE_JEU_PROPOSE_A_CHANGE }])
    assert.deepEqual(ok(await laPage(b, theo), 'la page relue').visite.echange, { possible: true, jeu: lendemain })
    // Un jeu qui n'en est pas un ne passe pas davantage.
    assert.deepEqual(refus(await echanger(theo, 1, 'constructor')), [400, { error: LE_JEU_PROPOSE_A_CHANGE }])
    // La page relue nomme le jeu du jour : il passe, et la case le prend.
    const echangee = ok(await echanger(theo, 1, lendemain), 'l’échange du jeu nommé')
    assert.equal(echangee.visite.cases[1].jeu, lendemain)
    // Une page d'avant n'envoyait pas de jeu : rien ne se compare, l'échange passe comme avant (invariant 12) — l'épreuve du dessus,
    // `changer le jeu d’une case`, le joue sans lui. Les refus de la règle passent devant : déjà changé aujourd'hui.
    assert.deepEqual(refus(await echanger(theo, 2, lendemain)), [400, { error: 'Tu as déjà changé un jeu aujourd’hui' }])
  } finally {
    b.horloge.t = DIX_HEURES
  }
})

test('l’échange garde aussi le jour que la page a montré : à minuit, le même jeu proposé sur une case qui a changé se refuse en mots', async () => {
  // La page de 23 h 59 dit « Changer Le Détail pour Le Pari ? », confirmée après minuit. Le jeu proposé reste souvent le même
  // d'un jour à l'autre, quand la case, elle, a changé de jeu et d'œuvre : comparé seul, il laissait passer l'échange du jour
  // neuf sur une case qu'on n'avait pas montrée — La Réplique devenait Le Pari, sur une autre œuvre (la relecture du lot
  // r3-suite). La page envoie donc aussi le jour de la visite qu'elle a lue, et le serveur le compare au sien.
  const mia = await inscrireProfil(b.banc.url, 'mia', 'Mia')
  const id = await idDe(mia)
  try {
    // La nuit où le jeu proposé reste et où une case change de jeu : une sur sept, pour un profil qui n'a pas joué (14 %, mesuré
    // sur vingt mille graines) ; cent cinquante nuits sans elle, moins d'une fois sur dix milliards.
    let trouvee: { jeu: CleDeJeu; k: number; veille: PageDuCabinet['visite']; lendemain: PageDuCabinet['visite'] } | null = null
    for (let jour = 1; trouvee === null; jour++) {
      assert.ok(jour <= 150, 'cent cinquante nuits sans que le jeu proposé reste quand une case change')
      const minuit = minuitDe(DIX_HEURES + jour * 24 * 3_600_000)
      b.horloge.t = minuit - 30_000
      const veille = ok(await laPage(b, mia), 'la page de la veille').visite
      b.horloge.t = minuit + 30_000
      const lendemain = ok(await laPage(b, mia), 'la page d’après minuit').visite
      assert.ok(veille.echange.possible && lendemain.echange.possible)
      const k = veille.cases.findIndex((c, i) => lendemain.cases[i] !== undefined && lendemain.cases[i].jeu !== c.jeu)
      if (veille.echange.jeu === lendemain.echange.jeu && k >= 0) trouvee = { jeu: veille.echange.jeu, k, veille, lendemain }
    }
    const { jeu, k, veille, lendemain } = trouvee
    assert.notEqual(veille.jour, lendemain.jour)
    // La page de la veille, restée ouverte, nomme son jeu — encore celui du jour neuf — et son jour : refusé en mots, rien d'écrit,
    // pas même la visite figée ; l'échange du jour reste à prendre, sur la visite qu'il n'a pas encore vue.
    assert.deepEqual(refus(await echanger(mia, k, jeu, veille.jour)), [400, { error: LA_VISITE_A_CHANGE }])
    assert.equal(compter(`SELECT COUNT(*) AS n FROM cabinet_profils WHERE profile_id = ? AND visites <> '[]'`, id), 0, 'rien d’écrit')
    assert.deepEqual(ok(await laPage(b, mia), 'la page relue').visite, lendemain)
    // La page relue nomme le jour neuf : l'échange passe, sur la case qu'elle montre, l'œuvre en jeu du jour neuf gardée.
    const echangee = ok(await echanger(mia, k, jeu, lendemain.jour), 'l’échange de la page relue').visite
    assert.equal(echangee.cases[k].jeu, jeu)
    assert.deepEqual(echangee.cases[k].enJeu, lendemain.cases[k].enJeu)
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
  await assert.rejects(autre.cabinet.echanger('deux', 2), { message: CASE_DEJA_FAITE })
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
  // À l'écran : ce que la partie lui a appris en la gagnant, et la partie qui l'a fait entrer.
  const ecran = async (c: Cartel) => texteDe(await ecranDeLaPage('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'lu', cartel: c } }))
  const gagnee = await ecran(cartel)
  assert.match(gagnee, /Ce que tu as appris en la gagnant/)
  assert.match(gagnee, new RegExp(`Gagnée ${JEUX.pari.a} · 9 sur 9`))

  // Les cartels d'office : offerte, achetée — et une achetée jouée pour sa dorure prend la manche de sa partie.
  const offerte = ok(await leCartel(max.cookie, 'coup-d-oeil'), 'une œuvre de départ')
  assert.deepEqual([offerte.origine, offerte.doree, offerte.partie], ['depart', false, undefined])
  assert.match(offerte.dit ?? '', /^Offerte à ton arrivée\./)
  ok(await acheter(max.cookie, communeDuPari, prixDAchat(communeDuPari)), 'l’achat')
  const achetee = ok(await leCartel(max.cookie, communeDuPari), 'l’achetée')
  assert.deepEqual([achetee.origine, achetee.doree, achetee.partie], ['achat', false, undefined])
  // « Joue-la à son jeu », jamais « Rejoue-la » : achetée, elle n'a jamais été jouée (`cabinet-mots-du-musee.test.ts`).
  assert.match(achetee.dit ?? '', /^Achetée avec ta poussière d’or\. Joue-la à son jeu pour dorer son cadre/)
  const dorure = ok(await commencer(b, max.cookie, { origine: 'chasse', oeuvre: communeDuPari, carte: null }), 'la chasse pour la dorer')
  const doreeEnJouant = await unPariParfait(b, max.cookie, dorure)
  assert.equal(doreeEnJouant.bilan?.issue, 'doree')
  // Achetée, elle n'avait pas de cartel : la partie qui la dore devient le sien, et le bilan le dit (`devientSonCartel`).
  assert.equal(doreeEnJouant.bilan?.devientSonCartel, true)
  const rejouee = ok(await leCartel(max.cookie, communeDuPari), 'l’achetée, dorée en jouant')
  // Son cartel dit ce que la partie lui a fait : la dorer, pas la gagner — achetée, elle l'était déjà.
  assert.deepEqual([rejouee.origine, rejouee.doree, rejouee.partie?.id, rejouee.partie?.issue, rejouee.dit], ['achat', true, dorure.id, 'doree', undefined])
  // À l'écran aussi : ce qu'elle lui a appris en la dorant — pas « en la gagnant ».
  const doree = await ecran(rejouee)
  assert.match(doree, /Ce que tu as appris en la dorant/)
  assert.match(doree, new RegExp(`Dorée ${JEUX.pari.a} · ${rejouee.partie!.total} sur 9`))
  assert.doesNotMatch(doree, /gagn/i)

  // Une œuvre qui n'est pas à lui n'a pas de cartel ; une clé inconnue non plus ; sans profil, le Cabinet le dit.
  assert.deepEqual(refus(await leCartel(max.cookie, epique)), [404, { error: 'Elle n’est pas encore à toi : gagne-la ou achète-la d’abord' }])
  assert.deepEqual(refus(await leCartel(max.cookie, 'nulle-part')), [404, { error: 'Cette œuvre n’est pas au Cabinet' }])
  assert.deepEqual(refus(await leCartel(undefined, 'lecon')), [401, { error: CABINET_SANS_PROFIL }])
})

test('gagnée avec son cartel, puis dorée en jouant : l’œuvre garde le premier, et ni le bilan ni la page ne disent l’autre', async () => {
  const { cookie } = await avecDeLaPoussiere('nina', 0)
  const cle = communeDuPari
  // Gagnée sans cadre doré — parier juste, garder, parier juste : huit étoiles —, d'une partie qui raconte : son cartel.
  let v = ok(await commencer(b, cookie, { origine: 'chasse', oeuvre: cle, carte: null }), 'la chasse')
  v = await jouerUnPari(b, cookie, v, 0)
  v = await jouerUnPari(b, cookie, await ouvrir(b, cookie, v, 1), 1, 'garder')
  const gagnee = await jouerUnPari(b, cookie, await ouvrir(b, cookie, v, 2), 2)
  assert.equal(gagnee.bilan?.issue, 'gagnee')
  assert.ok(gagnee.bilan?.cartel, 'sa partie a de quoi raconter')
  // Le bilan dit si la fin a fait de la partie le cartel de son œuvre : gagnée, oui ; la page n'y dit « Son cartel » que là.
  assert.equal(gagnee.bilan?.devientSonCartel, true)
  const avant = ok(await laPage(b, cookie), 'la page, gagnée')
  const premier = ok(await leCartel(cookie, cle), 'son cartel')
  assert.deepEqual([premier.doree, premier.partie?.id, premier.partie?.issue], [false, gagnee.id, 'gagnee'])
  const offerte = ok(await leCartel(cookie, 'coup-d-oeil'), 'le cartel d’une œuvre de départ')

  // Rejouée pour sa dorure, parfaite : son cadre se dore, et la partie a sa manche à raconter, elle aussi.
  const chasse = ok(await commencer(b, cookie, { origine: 'chasse', oeuvre: cle, carte: null }), 'la chasse pour la dorer')
  const pendant = ok(await laPage(b, cookie), 'la page pendant la chasse')
  const doree = await unPariParfait(b, cookie, chasse)
  assert.equal(doree.bilan?.issue, 'doree')
  const raconte = doree.bilan?.cartel
  assert.ok(raconte && raconte.sujet !== premier.partie!.sujet, 'deux parties, deux manches')
  // L'œuvre garde le cartel de la partie qui l'a gagnée : le serveur ne remplace pas le premier.
  const garde = ok(await leCartel(cookie, cle), 'son cartel, dorée')
  assert.deepEqual([garde.doree, garde.partie?.id, garde.partie?.issue, garde.partie?.sujet], [true, gagnee.id, 'gagnee', premier.partie!.sujet])
  // Le bilan le savait : la fin n'a pas écrit son cartel — et « Mes réponses », que la fin seule renseigne, ne le dit jamais.
  assert.equal(doree.bilan?.devientSonCartel, undefined)
  assert.equal(ok(await laPartie(cookie, gagnee.id), '« Mes réponses »').bilan?.devientSonCartel, undefined)
  // Le bilan ne promet pas « Son cartel » d'une manche que l'œuvre rouverte ne montrera pas : il dit ce que la partie a appris.
  const bilan = texteDe(await ecranDeLaPage('views/cabinet/Bilan', 'BilanDeLaPartie', { vue: doree, ecran: null, onMusee: () => {} }))
  assert.doesNotMatch(bilan, /Son cartel/)
  // Un texte du contenu tel que `texteDe` le lit : son apostrophe droite y devient la typographique.
  const lu = (s: string) => texteDe(s.replace(/'/g, '’')).trim()
  assert.ok(bilan.includes(`Ce que tu as appris en la dorant ${lu(raconte.sujet)}`), bilan)
  const rouverte = texteDe(await ecranDeLaPage('views/cabinet/Cartel', 'CartelDeLOeuvre', { lu: { etat: 'lu', cartel: garde } }))
  assert.ok(rouverte.includes(`Ce que tu as appris en la gagnant ${lu(premier.partie!.sujet)}`), rouverte)

  // La page, gardant les cartels qu'elle a lus : la page d'après les dément — le cadre doré que le cartel lu n'avait pas, la
  // partie qui attendait et n'attend plus (elle a pu doubler une œuvre sans rien changer de ce que la page montre) —, et la page
  // relue sans rien de neuf les laisse tenir.
  // Le module de la page, chargé dans Node : le typage du serveur ne lit pas le JSX, sa signature se dit ici.
  type Gardes = Record<string, { etat: 'lu'; cartel: Cartel }>
  const { cartelsQuiTiennent } = (await import(new URL('../../client/src/views/cabinet/Cartel.tsx', import.meta.url).href)) as {
    cartelsQuiTiennent: (cartels: Gardes, avant: PageDuCabinet | null, apres: PageDuCabinet) => Gardes
  }
  const apres = ok(await laPage(b, cookie), 'la page, dorée')
  assert.deepEqual(cartelsQuiTiennent({ [cle]: { etat: 'lu', cartel: premier } }, avant, apres), {}, 'dorée depuis')
  const deDepart = { 'coup-d-oeil': { etat: 'lu' as const, cartel: offerte } }
  assert.equal(cartelsQuiTiennent(deDepart, avant, apres), deDepart, 'rien de changé pour elle')
  assert.deepEqual(cartelsQuiTiennent(deDepart, pendant, apres), {}, 'la partie qui attendait est finie')
  const relus = { [cle]: { etat: 'lu' as const, cartel: garde }, ...deDepart }
  assert.equal(cartelsQuiTiennent(relus, apres, ok(await laPage(b, cookie), 'la page relue')), relus)
})

test('plus de chasse : le serveur dit son refus, dans son ordre', async () => {
  const { cookie } = await avecDeLaPoussiere('ugo', 0)
  for (let n = 0; n < 2; n++) ok(await jouer(b, cookie, ok(await commencer(b, cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'une chasse'), { quoi: 'quitter' }), 'quitter')
  const page = ok(await laPage(b, cookie), 'la page sans chasse')
  assert.equal(page.chasses.restent, 0)
  // Coup d'œil, à elle, se trouve à l'Épingle ; le serveur compte d'abord les chasses (`cadreDuDepart`). Tant que l'Épingle n'était
  // pas livrée, le refus des chasses passait devant celui du jeu : depuis que les neuf le sont, la règle seule le garde, pure
  // (`cabinet-regles.test.ts`), et le serveur rend celui des chasses.
  assert.equal(JEU_DE_L_OEUVRE['coup-d-oeil'], 'epingle')
  const depart = await commencer(b, cookie, { origine: 'chasse', oeuvre: 'coup-d-oeil', carte: null })
  assert.equal(depart.status, 400)
  const { error } = depart.corps as unknown as { error: string }
  assert.equal(error, PLUS_DE_CHASSE)
  // La fiche de l'œuvre, qui le disait d'avance sous « La jouer », a quitté la page avec le musée (le 31 octobre 2026).
})

test('le cartel d’une œuvre gagnée sans rien à raconter dit le jour où elle est entrée, pas celui de sa partie', () => {
  // Gagnée à 0 h 30 le 25 à Paris : sa partie a pu partir la veille, ou attendre que la page d'un autre jour la close.
  // La ligne ne garde que l'heure de son entrée (`gagnee_le`) : la phrase dit donc l'entrée, jamais « gagnée le 24 ».
  const entree = Date.UTC(2026, 9, 24, 22, 30)
  const ligne = { oeuvre: communeA, origine: 'partie', gagneeLe: entree, saison: null, serieId: null, prix: null, doreeLe: null, dorure: null, prixDorure: null, serieDoree: null } as const
  assert.equal(
    cartelDe({ oeuvre: communeA, ligne, partie: null }).dit,
    'Entrée dans ton musée le 25 octobre 2026, gagnée en jouant. Joue-la à son jeu pour dorer son cadre : elle gardera ici ce que tu auras appris.',
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

test('« Retenter » : après une visite manquée, une chasse au jeu de la visite, demandée par sa case — l’œuvre, la page ne la sait pas', async () => {
  const sam = await avecDeLaPoussiere('sam', 1000)
  const { visite } = ok(await laPage(b, sam.cookie), 'la page')
  const partie = ok(await commencer(b, sam.cookie, { origine: 'visite', case: 0, carte: null }), 'la visite')
  const cible = departEnBase(b.fichier, partie.id).cible as CleDOeuvre
  assert.ok(cible, 'une œuvre à gagner')
  // Quittée sans une étoile : manquée. Le bilan propose de la retenter, la case aussi — rien d'autre qu'un verdict, l'œuvre tue.
  const manquee = ok(await jouer(b, sam.cookie, partie, { quoi: 'quitter' }), 'quitter : manquée')
  assert.equal(manquee.bilan?.issue, 'manquee')
  assert.deepEqual(manquee.bilan?.retenter, { possible: true })
  assert.deepEqual(ok(await laPage(b, sam.cookie), 'la page').visite.cases[0].retenter, { possible: true })
  // Une case pas jouée, une case qui n'existe pas : rien à retenter.
  assert.deepEqual(refus(await commencer(b, sam.cookie, { origine: 'chasse', case: 1, retente: true, carte: null })), [400, { error: RETENTER_SANS_VISITE_MANQUEE }])
  assert.deepEqual(refus(await commencer(b, sam.cookie, { origine: 'chasse', case: 7, retente: true, carte: null })), [400, { error: CHOISIS_UNE_CASE }])
  assert.equal(ok(await laPage(b, sam.cookie), 'la page').visite.cases[1].retenter, undefined)

  const retente = ok(await commencer(b, sam.cookie, { origine: 'chasse', case: 0, retente: true, carte: null }), 'retenter')
  assert.deepEqual([retente.origine, retente.jeu], ['chasse', visite.cases[0].jeu], 'une chasse, au jeu de la visite, pas à celui de l’œuvre')
  assert.deepEqual([departEnBase(b.fichier, retente.id).retente, departEnBase(b.fichier, retente.id).cible], [true, cible])
  assert.deepEqual(retente.enJeu, visite.cases[0].enJeu, 'l’enjeu de la case, jamais l’œuvre')
  ok(await jouer(b, sam.cookie, retente, { quoi: 'quitter' }), 'quitter')
  const apres = ok(await laPage(b, sam.cookie), 'la page')
  assert.equal(apres.chasses.restent, 1, 'retenter prend une chasse')
  assert.deepEqual(apres.visite.cases[0].retenter, { possible: true }, 'une chasse reste : elle se retente encore')

  // Achetée depuis, l'œuvre est à elle : plus rien à retenter, et la case le dit dans les mots du refus.
  ok(await acheter(sam.cookie, cible, prixDAchat(cible)), 'l’achat')
  const achetee = ok(await laPage(b, sam.cookie), 'la page, l’œuvre achetée')
  assert.deepEqual(achetee.visite.cases[0].retenter, { possible: false, refus: SON_OEUVRE_EST_A_TOI })
  assert.deepEqual(refus(await commencer(b, sam.cookie, { origine: 'chasse', case: 0, retente: true, carte: null })), [400, { error: SON_OEUVRE_EST_A_TOI }])
  // Les chasses prises : son œuvre est toujours à elle — ce qui ne se fera jamais se dit avant ce qui attend minuit,
  // comme pour un achat ; « Plus de chasse » promettait une retente pour demain. La case et la route dans le même ordre.
  ok(await jouer(b, sam.cookie, ok(await commencer(b, sam.cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la seconde chasse'), { quoi: 'quitter' }), 'quitter')
  assert.deepEqual(ok(await laPage(b, sam.cookie), 'la page sans chasse').visite.cases[0].retenter, { possible: false, refus: SON_OEUVRE_EST_A_TOI })
  assert.deepEqual(refus(await commencer(b, sam.cookie, { origine: 'chasse', case: 0, retente: true, carte: null })), [400, { error: SON_OEUVRE_EST_A_TOI }])
  // Une case manquée dont l'œuvre lui manque encore, plus de chasse : la raison d'avant toutes les autres, comme pour une chasse.
  ok(await jouer(b, sam.cookie, ok(await commencer(b, sam.cookie, { origine: 'visite', case: 1, carte: null }), 'la deuxième case'), { quoi: 'quitter' }), 'quitter : manquée')
  assert.deepEqual(ok(await laPage(b, sam.cookie), 'la page sans chasse').visite.cases[1].retenter, { possible: false, refus: PLUS_DE_CHASSE })
  assert.deepEqual(refus(await commencer(b, sam.cookie, { origine: 'chasse', case: 1, retente: true, carte: null })), [400, { error: PLUS_DE_CHASSE }])
})

test('le bilan d’une partie libre dit vrai : payée sans étoile, elle ne dit pas « ont payé » ; payée, elle ne redit pas sa poussière ; la sixième se joue pour le plaisir', async () => {
  const lou = await inscrireProfil(b.banc.url, 'lou', 'Lou')
  const ont = /ont payé/
  // Une libre qui paie, quittée d'emblée : pas une étoile, pas de poussière — et il lui en reste quatre qui paient.
  const fin = async (v: VueDeLaPartie) => ok(await jouer(b, lou, v, { quoi: 'quitter' }), 'quitter')
  const premiere = await fin(ok(await commencer(b, lou, { origine: 'libre', jeu: 'pari', carte: null }), 'la première'))
  assert.equal(premiere.bilan?.poussiere, 0)
  assert.doesNotMatch(premiere.bilan!.dit, ont)
  assert.equal(premiere.bilan!.dit, `Aucune étoile cette fois : pas de poussière d’or. Encore ${LIBRES_QUI_PAIENT - 1} parties libres qui paient aujourd’hui`)
  assert.equal(premiere.bilan?.libresQuiPaientEncore, LIBRES_QUI_PAIENT - 1)
  assert.equal(ok(await laPage(b, lou), 'la page').libres.paientEncore, LIBRES_QUI_PAIENT - 1)
  // Jouée jusqu'au bout à zéro étoile, de même.
  let v = ok(await commencer(b, lou, { origine: 'libre', jeu: 'pari', carte: null }), 'la deuxième')
  for (const k of [0, 1, 2]) v = await jouerUnPari(b, lou, k > 0 ? await ouvrir(b, lou, v, k) : v, k, 'rater')
  assert.deepEqual([v.phase, v.bilan?.total, v.bilan?.poussiere], ['finie', 0, 0])
  assert.doesNotMatch(v.bilan!.dit, ont)
  assert.equal(v.bilan?.libresQuiPaientEncore, LIBRES_QUI_PAIENT - 2)
  assert.equal(ok(await laPage(b, lou), 'la page').libres.paientEncore, LIBRES_QUI_PAIENT - 2)
  // Payée, de la poussière : la ligne « +4 » du bilan dit le nombre, la phrase ne le redit pas (Lucas et Théo l'ont lu deux fois).
  // Elle ne dit pas « aujourd'hui » non plus : « Mes réponses » la relit un autre jour, et une libre commencée avant minuit finit
  // le lendemain — la phrase est la même à la fin et relue, après un réveil comme la semaine d'après.
  const gardee = await fin(await jouerUnPari(b, lou, ok(await commencer(b, lou, { origine: 'libre', jeu: 'pari', carte: null }), 'la troisième'), 0, 'garder'))
  assert.ok(gardee.bilan!.poussiere > 0)
  assert.equal(gardee.bilan!.dit, 'Une des parties libres qui paient')
  assert.doesNotMatch(gardee.bilan!.dit, /\d|poussière|aujourd/)
  // Les deux dernières qui paient, sans étoile : la phrase compte ce qui reste, au singulier, puis plus rien. Puis la sixième :
  // pour le plaisir — le nombre lu du barème, jamais « cinq » en dur.
  assert.ok(LIBRES_QUI_PAIENT >= 5, 'deux libres qui paient après les trois premières')
  const sansEtoile: string[] = []
  for (let i = 0; i < LIBRES_QUI_PAIENT - 3; i++) sansEtoile.push((await fin(ok(await commencer(b, lou, { origine: 'libre', jeu: 'pari', carte: null }), 'une libre'))).bilan!.dit)
  assert.deepEqual(sansEtoile.slice(-2), [
    'Aucune étoile cette fois : pas de poussière d’or. Encore 1 partie libre qui paie aujourd’hui',
    'Aucune étoile cette fois : pas de poussière d’or. Les suivantes se jouent pour le plaisir',
  ])
  const derniere = (await fin(ok(await commencer(b, lou, { origine: 'libre', jeu: 'pari', carte: null }), 'la sixième'))).bilan!
  assert.equal(derniere.dit, `Les ${LIBRES_QUI_PAIENT} parties libres du jour ont payé : celle-ci se joue pour le plaisir`)
  assert.equal(derniere.libresQuiPaientEncore, undefined)
})

test('le bilan ne dit le reste du jour que d’une partie d’aujourd’hui que la mémoire tient : relu après un réveil, ou le lendemain, il s’en passe', async () => {
  const kim = await inscrireProfil(b.banc.url, 'kim', 'Kim')
  const quitter = async (v: VueDeLaPartie) => ok(await jouer(b, kim, v, { quoi: 'quitter' }), 'quitter')
  const relu = async (v: VueDeLaPartie) => ok(await laPartie(kim, v.id), '« Mes réponses »').bilan!
  const aZero = await quitter(ok(await commencer(b, kim, { origine: 'libre', jeu: 'pari', carte: null }), 'une libre qui paie, sans étoile'))
  const manquee = await quitter(ok(await commencer(b, kim, { origine: 'visite', case: 0, carte: null }), 'la case 0'))
  assert.deepEqual(manquee.bilan?.retenter, { possible: true })
  // Le jour même, la mémoire tient son musée : « Mes réponses » dit ce que la fin disait, à l'heure de la relecture.
  const leJourMeme = async () => {
    const [z, m] = [await relu(aZero), await relu(manquee)]
    assert.deepEqual([z.libresQuiPaientEncore, m.retenter], [LIBRES_QUI_PAIENT - 1, { possible: true }])
    assert.match(z.dit, /Encore/)
  }
  await leJourMeme()
  /** Relue sans le musée du jour : ni « Retenter », ni ce qui reste des libres, ni la phrase qui le dirait. */
  const sansLeJour = async (quand: string) => {
    const [z, m] = [await relu(aZero), await relu(manquee)]
    assert.deepEqual([z.libresQuiPaientEncore, m.retenter], [undefined, undefined], quand)
    assert.equal(z.dit, 'Aucune étoile cette fois : pas de poussière d’or', quand)
  }
  // Après un réveil, avant toute page : la mémoire n'a pas son musée, et la relecture ne coûte pas un lot froid pour lui.
  await b.banc.redemarrer()
  await sansLeJour('relue après un réveil')
  ok(await laPage(b, kim), 'la page')
  await leJourMeme()
  b.horloge.t += 24 * 3_600_000
  try {
    // Le lendemain, la mémoire tient encore le musée d'hier : il ne dit rien d'aujourd'hui.
    await sansLeJour('le lendemain, avant toute page')
    // Puis le musée d'aujourd'hui : ses libres et sa visite sont celles d'un autre jour — la case 0 manquée aujourd'hui aussi ne
    // se dit pas sous la partie d'hier, qui visait une autre œuvre.
    ok(await laPage(b, kim), 'la page du lendemain')
    const aujourdhui = await quitter(ok(await commencer(b, kim, { origine: 'visite', case: 0, carte: null }), 'la case 0 du lendemain'))
    assert.deepEqual(aujourdhui.bilan?.retenter, { possible: true })
    await sansLeJour('le lendemain, sa page lue')
  } finally {
    b.horloge.t = DIX_HEURES
  }
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

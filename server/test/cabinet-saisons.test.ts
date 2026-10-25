// Les gardiens de saison du Cabinet de curiosités — la Citrouille, le Sapin,
// le Bouquet final —, à leur seule fête (la décision du propriétaire du
// 24 octobre 2026) : la première œuvre gagnée en jouant pendant Halloween
// range `saison:halloween` sous `#cabinet`, la condition même du légendaire ;
// un achat, une dorure, une œuvre rapportée de l'Expédition n'en rangent
// jamais ; hors de la fête, rien. La saison se lit au jour du départ de la
// partie, au calendrier du Cabinet (`calendrierDuCabinet`) : le banc le ferme
// pour tous les autres fichiers — sans quoi, du 25 octobre au 1er novembre,
// chaque test qui gagne une œuvre réveillerait la Citrouille —, celui-ci le
// rouvre, lui seul.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from './banc'
import { aLaMain, bancDuCabinet, commencer, enBase, fermerLesMagasins, laPage, lire, ok, poster, unPariParfait, type BancDuCabinet } from './cabinet-banc'
import { calendrierDesExpeditions, calendrierDesSoirees, calendrierDuCabinet } from '../src/core/saisons'
import { periodeDu } from '../../shared/saisons'
import { PRIX_D_UNE_DORURE, PRIX_D_UNE_OEUVRE } from '../../shared/cabinet/bareme'
import type { PageDuCabinet, VueDeLaPartie } from '../../shared/cabinet/vues'
import { ProfileStore, RANGEMENT_DU_CABINET } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false
// Le calendrier du Cabinet, et lui seul : celui des soirées et celui des expéditions restent fermés.
calendrierDuCabinet.periodeDu = periodeDu

/** Lundi 26 octobre 2026, 10 h à Paris (l'heure d'hiver depuis la veille) : Halloween. */
const PENDANT_HALLOWEEN = Date.UTC(2026, 9, 26, 9, 0)
/** Mardi 3 novembre 2026, 10 h à Paris : la fête est finie. */
const APRES_HALLOWEEN = Date.UTC(2026, 10, 3, 9, 0)

let b: BancDuCabinet
/** La Citrouille d'une soirée d'Halloween (`laureatsDeSaison`), rangée sous elle, posée à la main avant le redémarrage ; Gil a aussi gagné une œuvre de la fête. */
let fee: { cookie: string; id: string }
let gil: { cookie: string; id: string }
const UNE_SOIREE = 'une-soiree-d-halloween'
before(async () => {
  b = await bancDuCabinet()
  fee = await joueuse('fee')
  gil = await joueuse('gil')
  for (const j of [fee, gil])
    aLaMain(
      b.fichier,
      `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES ('${j.id}', 'saison:halloween', '${UNE_SOIREE}', 'un-espace', '🎃', 'Saison : Halloween', 1)`,
    )
  aLaMain(b.fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, saison) VALUES ('${gil.id}', 'lecon', 'partie', 0, 'halloween')`)
  // L'étagère se relit au réveil : ce qui a été écrit derrière son dos ne se voit qu'ensuite.
  await b.banc.redemarrer()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string
const legendairesDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.legendaires as string[]
const saisonsDe = (profil: string) =>
  enBase(b.fichier, db => db.prepare(`SELECT badge, soiree_id, emoji, title FROM profile_badges WHERE profile_id = ? AND badge LIKE 'saison:%' ORDER BY badge`).all(profil))
const saisonDeLOeuvre = (profil: string, oeuvre: string) =>
  enBase(b.fichier, db => (db.prepare(`SELECT saison FROM cabinet_oeuvres WHERE profile_id = ? AND oeuvre = ?`).get(profil, oeuvre) as { saison: string | null } | undefined)?.saison)

async function joueuse(login: string) {
  const cookie = await inscrireProfil(b.banc.url, login, login.toUpperCase())
  return { cookie, id: await idDe(cookie) }
}

/** Une chasse au Pari, gagnée sans faute : neuf étoiles, l'œuvre entre au musée. */
async function gagner(cookie: string, oeuvre: string): Promise<VueDeLaPartie> {
  const chasse = ok(await commencer(b, cookie, { origine: 'chasse', oeuvre, carte: null }), `la chasse à ${oeuvre}`)
  const fin = await unPariParfait(b, cookie, chasse)
  assert.ok(fin.bilan?.issue === 'gagnee' || fin.bilan?.issue === 'gagnee-doree', `${oeuvre} entre au musée`)
  return fin
}

test('le calendrier du Cabinet est seul rouvert : les soirées et les expéditions ne voient pas la fête', () => {
  assert.equal(calendrierDuCabinet.periodeDu('2026-10-26')?.saison.key, 'halloween')
  assert.equal(calendrierDesSoirees.periodeDu('2026-10-26'), null)
  assert.equal(calendrierDesExpeditions.periodeDu('2026-10-26'), null)
})

test('la première œuvre gagnée en jouant pendant Halloween réveille la Citrouille, rangée sous #cabinet — une fois', async () => {
  b.horloge.t = PENDANT_HALLOWEEN
  const ana = await joueuse('ana')
  const page = ok(await laPage(b, ana.cookie), 'la page')
  assert.equal(page.fete?.cle, 'halloween')
  assert.equal(page.fete?.gardien?.legendaire, 'lg:citrouille', 'la fête dit qui se réveillera')

  const fin = await gagner(ana.cookie, 'lecon')
  assert.deepEqual(fin.bilan!.gardiens, [{ legendaire: 'lg:citrouille', neuf: true }])
  assert.deepEqual(fin.bilan!.gains?.legendaires, ['lg:citrouille'])
  assert.equal(saisonDeLOeuvre(ana.id, 'lecon'), 'halloween', 'l’œuvre garde sa fête')
  assert.deepEqual(saisonsDe(ana.id), [{ badge: 'saison:halloween', soiree_id: RANGEMENT_DU_CABINET, emoji: '🎃', title: 'Saison : Halloween' }])
  assert.ok((await legendairesDe(ana.cookie)).includes('lg:citrouille'))

  const apres = ok(await laPage(b, ana.cookie), 'la page d’après')
  assert.equal(apres.fete?.gardien, undefined, 'réveillée, la Citrouille ne se promet plus')
  const citrouille = apres.gardiens.tous.find(g => g.legendaire === 'lg:citrouille')!
  assert.equal(citrouille.reveille, true)
  assert.equal(citrouille.voie, 'cabinet', 'réveillée dans son Cabinet')

  // Une deuxième œuvre de la fête ne range rien de plus, et ne la réannonce pas.
  const encore = await gagner(ana.cookie, 'troisieme-oeil')
  assert.equal(encore.bilan!.gardiens, undefined)
  assert.equal(saisonsDe(ana.id).length, 1)
})

test('la Citrouille déjà gagnée en soirée : le Cabinet range quand même sa saison sous #cabinet — la soirée retirée, elle veille encore', async () => {
  b.horloge.t = PENDANT_HALLOWEEN
  assert.ok((await legendairesDe(fee.cookie)).includes('lg:citrouille'), 'la Citrouille d’une soirée')
  const fin = await gagner(fee.cookie, 'lecon')
  assert.deepEqual(fin.bilan!.gardiens, [{ legendaire: 'lg:citrouille', neuf: false }], 'elle veillait déjà')
  assert.equal(fin.bilan!.gains?.legendaires, undefined, 'rien d’annoncé en grand')
  // Gil la tenait de même, et une œuvre de la fête : son musée lu à froid range la saison, en silence.
  assert.equal(ok(await laPage(b, gil.cookie), 'la page froide').reveil, undefined)
  for (const j of [fee, gil])
    assert.deepEqual(
      saisonsDe(j.id).map(s => (s as { soiree_id: string }).soiree_id).sort(),
      [RANGEMENT_DU_CABINET, UNE_SOIREE].sort(),
      j.id,
    )
  // La soirée retirée (« C'était un essai », une archive effacée) emporte sa ligne : celle du Cabinet reste, et la
  // Citrouille avec. Tenue pour rangée parce qu'une soirée la tenait, elle s'en allait avec elle.
  aLaMain(b.fichier, `DELETE FROM profile_badges WHERE soiree_id = '${UNE_SOIREE}'`)
  await b.banc.redemarrer()
  for (const j of [fee, gil]) assert.ok((await legendairesDe(j.cookie)).includes('lg:citrouille'), j.id)
})

test('pendant la fête, un achat, une dorure, une œuvre rapportée de l’Expédition ne rangent pas de saison', async () => {
  b.horloge.t = PENDANT_HALLOWEEN
  const bob = await joueuse('bob')
  aLaMain(b.fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('${bob.id}', ${PRIX_D_UNE_OEUVRE.commun + PRIX_D_UNE_DORURE.commun}, 0, 0)`)
  // Rapportée de l'Expédition (la migration des œuvres) : jamais de saison.
  aLaMain(b.fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le) VALUES ('${bob.id}', 'plume', 'expedition', 0)`)
  const page = ok(await laPage(b, bob.cookie), 'la page')
  assert.equal(page.fete?.gardien?.legendaire, 'lg:citrouille')

  const achat = await poster<PageDuCabinet>(b, bob.cookie, '/api/cabinet/oeuvre/pansement/achat', { prix: PRIX_D_UNE_OEUVRE.commun })
  assert.equal(achat.status, 200, JSON.stringify(achat.corps))
  assert.equal(achat.corps.reveil, undefined)
  const dorure = await poster<PageDuCabinet>(b, bob.cookie, '/api/cabinet/oeuvre/pansement/dorure', { prix: PRIX_D_UNE_DORURE.commun })
  assert.equal(dorure.status, 200, JSON.stringify(dorure.corps))
  assert.equal(dorure.corps.reveil, undefined)

  assert.equal(saisonDeLOeuvre(bob.id, 'pansement'), null)
  assert.equal(saisonDeLOeuvre(bob.id, 'plume'), null)
  assert.deepEqual(saisonsDe(bob.id), [])
  assert.ok(!(await legendairesDe(bob.cookie)).includes('lg:citrouille'))
  assert.equal(dorure.corps.fete?.gardien?.legendaire, 'lg:citrouille', 'la fête l’attend encore')
})

test('hors de la fête, une œuvre gagnée ne réveille aucun gardien de saison — et la page ne parle d’aucune fête', async () => {
  b.horloge.t = APRES_HALLOWEEN
  const cid = await joueuse('cid')
  const page = ok(await laPage(b, cid.cookie), 'la page')
  assert.equal(page.fete, null)
  const fin = await gagner(cid.cookie, 'lecon')
  assert.equal(fin.bilan!.gardiens, undefined)
  assert.equal(saisonDeLOeuvre(cid.id, 'lecon'), null)
  assert.deepEqual(saisonsDe(cid.id), [])
})

test('la saison se lit au jour du départ : commencée le 1er novembre au soir, finie après minuit, la partie est d’Halloween', async () => {
  // Dimanche 1er novembre 2026, 23 h 59 min 50 s à Paris : le dernier soir de la fête.
  b.horloge.t = Date.UTC(2026, 10, 1, 22, 59, 50)
  const eve = await joueuse('eve')
  const chasse = ok(await commencer(b, eve.cookie, { origine: 'chasse', oeuvre: 'lecon', carte: null }), 'la chasse')
  // Quinze secondes plus tard, le 2 novembre : la fête est finie, la partie se joue encore — sa manche court toujours.
  b.horloge.t += 15_000
  const fin = await unPariParfait(b, eve.cookie, chasse)
  assert.ok(fin.bilan?.issue === 'gagnee' || fin.bilan?.issue === 'gagnee-doree')
  assert.equal(saisonDeLOeuvre(eve.id, 'lecon'), 'halloween')
  assert.deepEqual(fin.bilan!.gardiens, [{ legendaire: 'lg:citrouille', neuf: true }])
})

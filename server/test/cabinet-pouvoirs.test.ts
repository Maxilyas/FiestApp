// Les cinq pouvoirs des cartes-bonus du Cabinet de curiosités, par les routes :
// chacun ce qu'il fait, combien de fois, et ses refus mot pour mot — ceux de la
// seule règle des pouvoirs (`refusDuPouvoir`) et du pli, que la vue porte et que
// la page ne recopie pas. Éclairer souffle une lettre au Mot mystère, dore une
// zone au Filet ; Changer prend la rechange suivante du plan, sous la même
// échéance, jamais à la Frise ; Miser se décide avant de voir la manche, qui ne
// part pas tant qu'il n'a pas choisi ; Protéger et Prendre son temps agissent
// seuls — le temps en plus ne marque la pièce que s'il a servi. Ce que la
// manche en dit (« éclairée », « changée », « temps en plus », la mise
// « au-delà de 9 »), le bilan d'un neuf sur neuf aidé, et ce que vaudrait la
// partie quittée (`siTuQuittes`), Protéger compris.
//
// Et ce qu'on emporte : une carte qu'il a — une œuvre, ou un gardien réveillé,
// à la force 3 —, figée au départ avec son pouvoir et sa force ; jamais une
// carte qu'il n'a pas, jamais un Divin, jamais un joker ni un talisman de
// l'Expédition, ni un de ses gestes (invariant 8) ; et la colonne `joker` ne
// porte jamais que le pouvoir qui a aidé, jamais la clé d'une carte.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { inscrireProfil } from './banc'
import {
  aLaMain,
  bancDuCabinet,
  commencer,
  departEnBase,
  dossierDEssai,
  enBase,
  fermerLesMagasins,
  filetDe,
  jouer,
  jouerUnFilet,
  jouerUnMot,
  laPage,
  lire,
  magasinDEssai,
  motDe,
  ok,
  ouvrir,
  DIX_HEURES,
  type BancDuCabinet,
  type Reponse,
} from './cabinet-banc'
import { CabinetStore } from '../src/core/cabinet/magasin'
import { DUREES_DES_JEUX, ETOILES_D_UNE_PARTIE, GRACE_D_UNE_MANCHE_MS, LIBRES_QUI_PAIENT, POUSSIERE_PAR_ETOILE, SECONDES_PAR_FORCE } from '../../shared/cabinet/bareme'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART } from '../../shared/cabinet/oeuvres'
import { JOKER_DU_TEMPS, JOKER_D_ECLAIRER } from '../../shared/cabinet/pieces'
import type { FiletMontre, FiletTire } from '../../shared/cabinet/jeux/filet'
import type { MotMontre, MotTire } from '../../shared/cabinet/jeux/mot'
import type { VueDeLaPartie } from '../../shared/cabinet/vues'
import { cleDeLExpedition } from '../../shared/legendaires'
import { JOKERS_QUI_AIDENT } from '../../shared/jokers'

let b: BancDuCabinet
/** Un joueur à qui ses gardiens se sont réveillés ailleurs — la Chouette, Janus, le Phénix — et qu'un Divin a visité. */
let gardiens: string
/** Une joueuse qui a Tout ou rien, une maudite du Vestibule : Miser, à la force 2. */
let miseuse: string

const idDe = async (cookie: string) => (await lire(b, cookie, '/api/joueur/moi?leger')).corps.profile.id as string

before(async () => {
  b = await bancDuCabinet()
  gardiens = await inscrireProfil(b.banc.url, 'gardiens', 'Gaël')
  miseuse = await inscrireProfil(b.banc.url, 'miseuse', 'Mila')
  const g = await idDe(gardiens)
  const m = await idDe(miseuse)
  // Rangés à la main, relus au démarrage : les gardiens par la voie de l'Expédition, le Divin d'une soirée d'avant, l'œuvre achetée.
  const badges = [...['lg:chouette', 'lg:janus', 'lg:phenix'].map(cleDeLExpedition), 'dv:helios']
    .map(badge => `('${g}', '${badge}', '#campagne:essai', '', '', 'essai', 1)`)
    .join(', ')
  aLaMain(b.fichier, `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES ${badges}`)
  aLaMain(b.fichier, `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, prix) VALUES ('${m}', 'tout-ou-rien', 'achat', 1, 0)`)
  await b.banc.redemarrer()
})
after(() => b?.banc.close())
after(fermerLesMagasins)

/** Un refus du serveur : son statut et sa phrase. */
const refus = (r: Reponse<unknown>) => [r.status, (r.corps as { error?: string }).error]
const enCoursDuMot = (v: VueDeLaPartie) => v.enCours as MotMontre
const enCoursDuFilet = (v: VueDeLaPartie) => v.enCours as FiletMontre
const lignesDe = (serie: string) =>
  enBase(b.fichier, db => db.prepare('SELECT position, reserve_id, juste, forme, joker FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(serie) as { joker: string | null }[])

// ── Éclairer ──────────────────────────────────────────────────────────────

test('Éclairer souffle une lettre du Mot à sa place, dore une zone du Filet : autant de fois que sa force, la ligne marquée de son pouvoir', async () => {
  const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
  // Coup d'œil, une commune de départ : une fois par partie.
  let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'mot', carte: 'coup-d-oeil' }), 'le Mot')
  assert.deepEqual([v.carte?.pouvoir, v.carte?.force, v.carte?.reste, v.pouvoir], ['eclairer', 1, 1, { jouable: true }])
  assert.equal(v.carte?.dit, 'Éclairer : souffle une lettre à sa place — 1 indice par partie')
  const t = motDe(b, v.id, 0)
  v = ok(await jouer(b, lea, v, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  const [soufflee] = enCoursDuMot(v).soufflees
  assert.equal(soufflee.lettre, t.lettres[soufflee.position], 'la lettre, à sa place')
  assert.deepEqual([v.carte?.reste, v.pouvoir], [0, { jouable: false, refus: 'Éclairer a déjà servi une fois' }])
  assert.deepEqual(refus(await jouer(b, lea, v, { quoi: 'eclairer', manche: 0 })), [400, 'Éclairer a déjà servi une fois'])
  v = await jouerUnMot(b, lea, v, 0, 1)
  // La pièce aidée porte le pouvoir, jamais la clé de la carte — Coup d'œil est aussi un joker de l'Expédition.
  assert.deepEqual(lignesDe(v.id).map(l => l.joker), [JOKER_D_ECLAIRER])
  // Et la manche le dit : ses trois étoiles ne sont pas de celles qui dorent un cadre.
  assert.deepEqual([v.manches[0].naturel, v.manches[0].note], [3, 'éclairée'])
  ok(await jouer(b, lea, v, { quoi: 'quitter' }), 'quitter')

  // La Chouette d'Argent, un gardien : la force 3, trois indices. Au Filet, une zone par manche — la deuxième se refuse.
  let f = ok(await commencer(b, gardiens, { origine: 'libre', jeu: 'filet', carte: 'lg:chouette' }), 'le Filet')
  assert.deepEqual([f.carte?.cle, f.carte?.pouvoir, f.carte?.force, f.carte?.reste], ['lg:chouette', 'eclairer', 3, 3])
  const f0 = filetDe(b, f.id, 0)
  f = ok(await jouer(b, gardiens, f, { quoi: 'eclairer', manche: 0 }), 'éclairer')
  const zone = enCoursDuFilet(f).zone!
  assert.ok(zone.de <= f0.valeur && f0.valeur <= zone.a, 'la zone contient la réponse')
  assert.deepEqual([f.carte?.reste, f.pouvoir], [2, { jouable: false, refus: 'Ce jeu n’a plus rien à éclairer' }])
  assert.deepEqual(refus(await jouer(b, gardiens, f, { quoi: 'eclairer', manche: 0 })), [400, 'Ce jeu n’a plus rien à éclairer'])
  f = await jouerUnFilet(b, gardiens, f, 0, 'moyen')
  f = await ouvrir(b, gardiens, f, 1)
  assert.deepEqual(f.pouvoir, { jouable: true }, 'une manche neuve a de quoi éclairer')
  f = ok(await jouer(b, gardiens, f, { quoi: 'eclairer', manche: 1 }), 'éclairer encore')
  f = await jouerUnFilet(b, gardiens, f, 1, 'grand')
  assert.deepEqual(lignesDe(f.id).map(l => l.joker), [JOKER_D_ECLAIRER, JOKER_D_ECLAIRER])
  ok(await jouer(b, gardiens, f, { quoi: 'quitter' }), 'quitter')
})

test('Éclairer se refuse en mots : sans carte, sous une autre carte, sous la pause, le temps écoulé', async () => {
  const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
  const sans = ok(await commencer(b, tom, { origine: 'libre', jeu: 'mot', carte: null }), 'sans carte')
  assert.equal(sans.carte, null)
  assert.equal(sans.pouvoir, undefined, 'sans carte, la vue ne dit aucun pouvoir')
  assert.deepEqual(refus(await jouer(b, tom, sans, { quoi: 'eclairer', manche: 0 })), [400, 'Tu n’as emporté aucune carte-bonus'])
  ok(await jouer(b, tom, sans, { quoi: 'quitter' }), 'quitter')

  const prudence = ok(await commencer(b, tom, { origine: 'libre', jeu: 'mot', carte: 'prudence' }), 'Prudence')
  assert.deepEqual(refus(await jouer(b, tom, prudence, { quoi: 'eclairer', manche: 0 })), [400, 'Ta carte-bonus n’a pas ce pouvoir'])
  ok(await jouer(b, tom, prudence, { quoi: 'quitter' }), 'quitter')

  // Sous la confirmation de « Quitter ? », seule la réponse passe.
  let v = ok(await commencer(b, tom, { origine: 'libre', jeu: 'mot', carte: 'coup-d-oeil' }), 'le Mot')
  v = ok(await jouer(b, tom, v, { quoi: 'pause', manche: 0 }), 'la pause')
  assert.deepEqual(v.pouvoir, { jouable: false, refus: 'La partie est en pause : reprends-la d’abord' })
  assert.deepEqual(refus(await jouer(b, tom, v, { quoi: 'eclairer', manche: 0 })), [400, 'La partie est en pause : reprends-la d’abord'])
  ok(await jouer(b, tom, v, { quoi: 'quitter' }), 'quitter')

  // Passé l'échéance et sa grâce, rien qu'une réponse, qui se juge expirée.
  const f = ok(await commencer(b, tom, { origine: 'libre', jeu: 'filet', carte: 'coup-d-oeil' }), 'le Filet')
  b.horloge.t = f.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
  assert.deepEqual(refus(await jouer(b, tom, f, { quoi: 'eclairer', manche: 0 })), [400, 'Le temps de cette manche est écoulé'])
  ok(await jouer(b, tom, f, { quoi: 'quitter' }), 'quitter')
})

// ── Changer ───────────────────────────────────────────────────────────────

test('Changer prend la rechange suivante du plan, sous la même échéance — autant de fois que sa force, avant tout geste, jamais à la Frise', async () => {
  const ana = await inscrireProfil(b.banc.url, 'ana', 'Ana')
  // Échange, une commune de départ : une rechange, tirée au départ avec le plan.
  let v = ok(await commencer(b, ana, { origine: 'libre', jeu: 'mot', carte: 'echange' }), 'le Mot')
  assert.equal(departEnBase(b.fichier, v.id).tirages.length, 4)
  const echeance = v.chrono!.echeance
  b.horloge.t += 20_000
  v = ok(await jouer(b, ana, v, { quoi: 'changer', manche: 0 }), 'changer')
  const rechange = motDe(b, v.id, 3)
  assert.equal(v.tirage, 3, 'la manche joue la rechange')
  assert.deepEqual([enCoursDuMot(v).texte, enCoursDuMot(v).longueur, enCoursDuMot(v).essais], [rechange.question.texte, rechange.lettres.length, []])
  assert.equal(v.chrono!.echeance, echeance, 'le chrono continue : la même échéance')
  assert.deepEqual([v.carte?.reste, v.pouvoir], [0, { jouable: false, refus: 'Plus de rechange pour cette partie' }])
  assert.deepEqual(refus(await jouer(b, ana, v, { quoi: 'changer', manche: 0 })), [400, 'Plus de rechange pour cette partie'])
  v = await jouerUnMot(b, ana, v, 0, 1)
  assert.equal(v.revelation?.tirage, 3)
  assert.equal(v.manches[0].note, 'changée', 'la manche dit qu’elle a joué une rechange')
  // Changer ne marque pas la ligne : il pose une autre question, nue de toute aide sur elle. La partie, elle, est aidée.
  assert.deepEqual(lignesDe(v.id).map(l => l.joker), [null])
  v = ok(await jouer(b, ana, v, { quoi: 'quitter' }), 'quitter')
  assert.equal(v.bilan?.aidee, true, 'plus de cadre doré')

  // Un geste fait dans la manche, Changer vient trop tard.
  let e = ok(await commencer(b, ana, { origine: 'libre', jeu: 'mot', carte: 'echange' }), 'le Mot, essayé')
  const t0 = motDe(b, e.id, 0)
  e = ok(await jouer(b, ana, e, { quoi: 'essai', manche: 0, lettres: 'X'.repeat(t0.lettres.length) }), 'un essai')
  assert.deepEqual(e.pouvoir, { jouable: false, refus: 'Change avant de répondre' })
  assert.deepEqual(refus(await jouer(b, ana, e, { quoi: 'changer', manche: 0 })), [400, 'Change avant de répondre'])
  ok(await jouer(b, ana, e, { quoi: 'quitter' }), 'quitter')

  // Janus, un gardien : trois rechanges, prises l'une après l'autre — deux dans la même manche, la troisième à la suivante.
  let j = ok(await commencer(b, gardiens, { origine: 'libre', jeu: 'filet', carte: 'lg:janus' }), 'le Filet')
  assert.deepEqual([j.carte?.pouvoir, j.carte?.force, j.carte?.reste], ['changer', 3, 3])
  assert.equal(departEnBase(b.fichier, j.id).tirages.length, 6)
  const sous = j.chrono!.echeance
  for (const tirage of [3, 4]) {
    j = ok(await jouer(b, gardiens, j, { quoi: 'changer', manche: 0 }), `changer pour ${tirage}`)
    assert.deepEqual([j.tirage, enCoursDuFilet(j).piste, j.chrono!.echeance], [tirage, filetDe(b, j.id, tirage).piste, sous])
  }
  j = await jouerUnFilet(b, gardiens, j, 0, 'petit')
  assert.equal(j.revelation?.tirage, 4)
  j = await ouvrir(b, gardiens, j, 1)
  j = ok(await jouer(b, gardiens, j, { quoi: 'changer', manche: 1 }), 'changer à la manche 2')
  assert.deepEqual([j.tirage, j.carte?.reste], [5, 0])
  assert.deepEqual(refus(await jouer(b, gardiens, j, { quoi: 'changer', manche: 1 })), [400, 'Plus de rechange pour cette partie'])
  ok(await jouer(b, gardiens, j, { quoi: 'quitter' }), 'quitter')

  // La Frise se construit d'un bout à l'autre : pas de rechange au plan, et Changer le dit.
  const frise = ok(await commencer(b, ana, { origine: 'libre', jeu: 'frise', carte: 'echange' }), 'la Frise')
  assert.equal(departEnBase(b.fichier, frise.id).tirages.length, 3)
  assert.equal(frise.carte?.dit, 'Changer ne sert pas à la Frise')
  assert.deepEqual(frise.pouvoir, { jouable: false, refus: 'Changer ne sert pas à la Frise' })
  assert.deepEqual(refus(await jouer(b, ana, frise, { quoi: 'changer', manche: 0 })), [400, 'Changer ne sert pas à la Frise'])
  ok(await jouer(b, ana, frise, { quoi: 'quitter' }), 'quitter')
})

// ── Miser ─────────────────────────────────────────────────────────────────

test('Miser se décide avant de voir la manche — rien d’elle ne part avant —, une fois : parfaite, +3, jusqu’à 9 sur la partie ; sinon, elle ne vaut rien', async () => {
  let v = ok(await commencer(b, miseuse, { origine: 'libre', jeu: 'mot', carte: 'tout-ou-rien' }), 'le Mot')
  const plan = departEnBase(b.fichier, v.id).tirages as MotTire[]
  // Sous une carte de Miser, la première manche ne s'ouvre pas d'elle-même : la mise se décide sans l'avoir vue.
  assert.deepEqual([v.phase, v.rang, v.enCours, v.chrono], ['avant', 1, undefined, undefined])
  assert.deepEqual([v.carte?.pouvoir, v.carte?.force, v.carte?.reste, v.pouvoir], ['miser', 2, 1, { jouable: true }])
  assert.equal(v.carte?.dit, 'Miser : +3 étoiles si la manche misée est parfaite')
  for (const t of plan) assert.ok(!JSON.stringify(v).includes(t.question.texte), 'aucune manche ne se montre avant la mise')
  v = ok(await jouer(b, miseuse, v, { quoi: 'ouvrir', manche: 0, miser: true }), 'miser')
  assert.deepEqual([v.phase, v.carte?.reste, v.pouvoir], ['jouer', 0, { jouable: false, refus: 'La mise se décide avant de voir la manche' }])
  assert.deepEqual(refus(await jouer(b, miseuse, v, { quoi: 'ouvrir', manche: 0, miser: true })), [400, 'La mise se décide avant de voir la manche'])
  v = await jouerUnMot(b, miseuse, v, 0, 1)
  assert.deepEqual(v.manches[0], { etoiles: 6, naturel: 3, note: '+3 : mise gagnée', fin: 'jugee' })
  // La manche suivante attend son ouverture : rien d'elle encore, et la mise a servi.
  assert.ok(!JSON.stringify(v).includes(plan[1].question.texte), 'la manche 2 ne se montre pas avant de s’ouvrir')
  assert.deepEqual(v.pouvoir, { jouable: false, refus: 'La mise a déjà servi' })
  assert.deepEqual(refus(await jouer(b, miseuse, v, { quoi: 'ouvrir', manche: 1, miser: true })), [400, 'La mise a déjà servi'])
  v = await ouvrir(b, miseuse, v, 1)
  v = ok(await jouer(b, miseuse, v, { quoi: 'quitter' }), 'quitter')
  assert.equal(v.bilan?.aidee, true, 'la mise a servi : plus de cadre doré')

  // Misée, puis parfaite par ailleurs : six, trois, trois — douze, que le total plafonne à neuf. La note le dit, sans quoi
  // « +3 : mise gagnée » se lisait comme un gain que le plafond avait mangé (Théo, à la tablée du 25 octobre 2026).
  let parfaite = ok(await commencer(b, miseuse, { origine: 'libre', jeu: 'mot', carte: 'tout-ou-rien' }), 'le Mot, misé puis parfait')
  parfaite = await jouerUnMot(b, miseuse, ok(await jouer(b, miseuse, parfaite, { quoi: 'ouvrir', manche: 0, miser: true }), 'miser'), 0, 1)
  parfaite = await jouerUnMot(b, miseuse, await ouvrir(b, miseuse, parfaite, 1), 1, 1)
  assert.equal(parfaite.manches[0].note, '+3 : mise gagnée', 'neuf tout juste : rien de mangé encore')
  parfaite = await jouerUnMot(b, miseuse, await ouvrir(b, miseuse, parfaite, 2), 2, 1)
  assert.equal(parfaite.manches[0].note, `+3 : mise gagnée, au-delà de ${ETOILES_D_UNE_PARTIE}`)
  assert.match(parfaite.manches[0].note ?? '', /au-delà de 9/)
  assert.deepEqual([parfaite.bilan?.total, parfaite.bilan?.aidee], [ETOILES_D_UNE_PARTIE, true])

  // Misée imparfaite — trouvée au troisième essai, deux étoiles —, elle ne vaut rien.
  let p = ok(await commencer(b, miseuse, { origine: 'libre', jeu: 'mot', carte: 'tout-ou-rien' }), 'le Mot, misé')
  p = ok(await jouer(b, miseuse, p, { quoi: 'ouvrir', manche: 0, miser: true }), 'miser')
  p = await jouerUnMot(b, miseuse, p, 0, 3)
  assert.deepEqual(p.manches[0], { etoiles: 0, naturel: 2, note: 'Mise perdue', fin: 'jugee' })
  // « Pas cette fois » : la manche s'ouvre sans elle.
  p = await ouvrir(b, miseuse, p, 1)
  ok(await jouer(b, miseuse, p, { quoi: 'quitter' }), 'quitter')

  // Sans carte de Miser, la mise se refuse en mots, à l'ouverture de la manche suivante.
  for (const [carte, dit] of [
    [null, 'Tu n’as emporté aucune carte-bonus'],
    ['prudence', 'Ta carte-bonus n’a pas ce pouvoir'],
  ] as const) {
    let s = ok(await commencer(b, miseuse, { origine: 'libre', jeu: 'mot', carte }), `le Mot, ${carte}`)
    assert.equal(s.phase, 'jouer', 'sans Miser, la première manche s’ouvre au départ')
    s = await jouerUnMot(b, miseuse, s, 0, 1)
    assert.deepEqual(refus(await jouer(b, miseuse, s, { quoi: 'ouvrir', manche: 1, miser: true })), [400, dit])
    ok(await jouer(b, miseuse, s, { quoi: 'quitter' }), 'quitter')
  }
})

// ── Protéger, Prendre son temps ───────────────────────────────────────────

test('Protéger porte la première manche imparfaite, seule ; un gardien de deux étoiles — il agit tout seul', async () => {
  const noe = await inscrireProfil(b.banc.url, 'noe', 'Noé')
  let v = ok(await commencer(b, noe, { origine: 'libre', jeu: 'mot', carte: 'prudence' }), 'le Mot')
  assert.deepEqual(v.pouvoir, { jouable: false, refus: 'Protéger agit tout seul' })
  v = await jouerUnMot(b, noe, v, 0, 3)
  assert.deepEqual(v.manches[0], { etoiles: 3, naturel: 2, note: '+1 : protégée', fin: 'jugee' })
  v = await ouvrir(b, noe, v, 1)
  v = await jouerUnMot(b, noe, v, 1, 3)
  assert.deepEqual(v.manches[1], { etoiles: 2, naturel: 2, fin: 'jugee' }, 'une fois seulement')
  // La juste lit les étoiles naturelles, et Protéger ne marque pas la ligne.
  assert.deepEqual(lignesDe(v.id).map(l => l.joker), [null, null])
  v = ok(await jouer(b, noe, v, { quoi: 'quitter' }), 'quitter')
  assert.equal(v.bilan?.aidee, true, 'la protection appliquée ôte le cadre doré')

  // Le Phénix, gardien du Rempart, protège à la force 3 : une étoile en vaut trois.
  let p = ok(await commencer(b, gardiens, { origine: 'libre', jeu: 'filet', carte: 'lg:phenix' }), 'le Filet')
  assert.deepEqual([p.carte?.pouvoir, p.carte?.force], ['proteger', 3])
  p = await jouerUnFilet(b, gardiens, p, 0, 'grand')
  assert.deepEqual(p.manches[0], { etoiles: 3, naturel: 1, note: '+2 : protégée', fin: 'jugee' })
  ok(await jouer(b, gardiens, p, { quoi: 'quitter' }), 'quitter')
})

test('Prendre son temps allonge chaque manche, et ne marque la pièce que si la réponse est arrivée dans le temps en plus', async () => {
  const eva = await inscrireProfil(b.banc.url, 'eva', 'Éva')
  let v = ok(await commencer(b, eva, { origine: 'libre', jeu: 'filet', carte: 'concentration' }), 'le Filet')
  assert.deepEqual(v.pouvoir, { jouable: false, refus: 'Prendre son temps agit tout seul' })
  assert.equal(v.chrono!.dureeMs, (DUREES_DES_JEUX.filet + SECONDES_PAR_FORCE) * 1000)
  // Au-delà de la durée normale et de sa grâce, avant l'échéance allongée : le temps en plus a servi.
  b.horloge.t = v.chrono!.echeance - 5_000
  v = await jouerUnFilet(b, eva, v, 0, 'petit')
  assert.equal(v.manches[0].naturel, 3, 'à l’heure, sous la carte')
  // La manche le dit : ses trois étoiles ont eu besoin du temps en plus.
  assert.match(v.manches[0].note ?? '', /temps en plus/)
  v = await ouvrir(b, eva, v, 1)
  v = await jouerUnFilet(b, eva, v, 1, 'petit')
  assert.deepEqual(lignesDe(v.id).map(l => l.joker), [JOKER_DU_TEMPS, null], 'la seconde, arrivée dans la durée normale : rien à marquer')
  assert.equal(v.manches[1].note, undefined, 'ni sa note')
  v = await ouvrir(b, eva, v, 2)
  // Au-delà de l'échéance allongée et de la grâce, la réponse ne compte plus : expirée.
  b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
  v = await jouerUnFilet(b, eva, v, 2, 'petit')
  assert.deepEqual([v.manches[2].naturel, v.manches[2].fin], [0, 'expiree'])
  assert.equal(v.bilan?.aidee, true)

  // Neuf sur neuf, une manche dans le temps en plus : l'œuvre entre sans son cadre doré, et le bilan dit pourquoi — Théo, à la
  // tablée, n'y voyait qu'« Une œuvre de plus ! ».
  const cible = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === 'filet' && !OEUVRES_DE_DEPART.includes(o.cle))!
  let c = ok(await commencer(b, eva, { origine: 'chasse', oeuvre: cible.cle, carte: 'concentration' }), 'la chasse')
  b.horloge.t = c.chrono!.echeance - 5_000
  c = await jouerUnFilet(b, eva, c, 0, 'petit')
  for (const k of [1, 2]) c = await jouerUnFilet(b, eva, await ouvrir(b, eva, c, k), k, 'petit')
  assert.deepEqual([c.bilan?.naturel, c.bilan?.issue, c.bilan?.aidee], [[3, 3, 3], 'gagnee', true])
  assert.equal(c.bilan?.dit, `${cible.nom} entre dans ton musée — sans cadre doré : Prendre son temps a servi`)
  assert.match(c.bilan?.dit ?? '', /sans cadre doré/)
})

// ── Quitter ───────────────────────────────────────────────────────────────

test('« Quitter ? » dit ce que vaudrait la partie quittée à cet instant : le geste joué par le pli sur l’état, rien d’écrit', async () => {
  const ugo = await inscrireProfil(b.banc.url, 'ugo', 'Ugo')
  // Une chasse sous Prudence, sa première manche ouverte : quittée, elle juge zéro, Protéger la porte à une étoile, et la
  // chasse paie ses quatre poussières au moins. « Quitter ? » promettait « les étoiles déjà gagnées » : zéro, croyait Lucas.
  const chasse = ok(await commencer(b, ugo, { origine: 'chasse', oeuvre: 'lecon', carte: 'prudence' }), 'la chasse')
  assert.deepEqual(chasse.siTuQuittes, { total: 1, poussiere: 4 })
  assert.deepEqual(ok(await laPage(b, ugo), 'la page').enCours?.siTuQuittes, chasse.siTuQuittes, 'la page relue dit la même chose')
  const quittee = ok(await jouer(b, ugo, chasse, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual([quittee.bilan?.total, quittee.bilan?.poussiere], [chasse.siTuQuittes!.total, chasse.siTuQuittes!.poussiere], 'le bilan tient la promesse')
  assert.equal(quittee.siTuQuittes, undefined, 'finie, plus rien à quitter')
  // Rien ne s'est écrit pour le dire : la partie n'avait qu'un geste, son ouverture, avant « Quitter ».
  assert.equal(enBase(b.fichier, db => (db.prepare('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?').get(chasse.id) as { n: number }).n), 2)

  // Une libre qui paie, une manche gagnée, la suivante pas encore ouverte : trois étoiles, deux poussières chacune.
  for (let i = 0; i < LIBRES_QUI_PAIENT; i++) {
    let l = ok(await commencer(b, ugo, { origine: 'libre', jeu: 'mot', carte: null }), `la libre ${i + 1}`)
    if (i === 0) {
      l = await jouerUnMot(b, ugo, l, 0, 1)
      assert.deepEqual([l.phase, l.siTuQuittes], ['revele', { total: 3, poussiere: 3 * POUSSIERE_PAR_ETOILE }])
    }
    ok(await jouer(b, ugo, l, { quoi: 'quitter' }), 'quitter')
  }
  // Au-delà des libres qui paient, la même partie ne rapporte pas une poussière.
  let sixieme = ok(await commencer(b, ugo, { origine: 'libre', jeu: 'mot', carte: null }), 'la sixième libre')
  sixieme = await jouerUnMot(b, ugo, sixieme, 0, 1)
  sixieme = await ouvrir(b, ugo, sixieme, 1)
  assert.deepEqual(sixieme.siTuQuittes, { total: 3, poussiere: 0 })
  const finie = ok(await jouer(b, ugo, sixieme, { quoi: 'quitter' }), 'quitter la sixième')
  assert.deepEqual([finie.bilan?.total, finie.bilan?.poussiere], [3, 0])
})

// ── Ce qu'on emporte ──────────────────────────────────────────────────────

test('la carte-bonus se fige au départ, son pouvoir et sa force : ni un geste, ni un redémarrage ne la changent', async () => {
  let v = ok(await commencer(b, gardiens, { origine: 'libre', jeu: 'mot', carte: 'lg:janus' }), 'le Mot')
  assert.deepEqual(departEnBase(b.fichier, v.id).carte, { cle: 'lg:janus', pouvoir: 'changer', force: 3 })
  // Un geste qui nommerait une autre carte n'en change rien : il se relit champ par champ, sans elle.
  const avecUneAutreCarte: Record<string, unknown> = { quoi: 'changer', manche: 0, carte: 'prudence' }
  v = ok(await jouer(b, gardiens, v, avecUneAutreCarte), 'changer')
  assert.deepEqual([v.tirage, v.carte?.cle, v.carte?.pouvoir, v.carte?.force, v.carte?.reste], [3, 'lg:janus', 'changer', 3, 2])
  await b.banc.redemarrer()
  const relue = ok(await laPage(b, gardiens), 'la page relue').enCours!
  assert.deepEqual(relue.carte, v.carte)
  assert.equal(relue.tirage, 3)
  ok(await jouer(b, gardiens, relue, { quoi: 'quitter' }), 'quitter')
})

test('ce qu’il n’a pas ne part pas : une œuvre, un gardien endormi, un Divin, un joker ou un talisman de l’Expédition — ni un de ses gestes', async () => {
  // Il a la Chouette et le Divin Hélios ; ni Bastion, ni le Sphinx. Sagesse est le joker de la Chouette à l'Expédition,
  // Renaissance celui du Phénix, la loupe un talisman : aucun n'est une carte-bonus.
  for (const carte of ['bastion', 'lg:sphinx', 'dv:helios', 'sagesse', 'renaissance', 'loupe', 'inconnue']) {
    assert.deepEqual(refus(await commencer(b, gardiens, { origine: 'libre', jeu: 'mot', carte })), [400, 'Tu n’as pas cette carte-bonus'], carte)
  }
  assert.deepEqual(refus(await commencer(b, gardiens, { origine: 'libre', jeu: 'mot', carte: 42 })), [400, 'Choisis une partie de la visite, une chasse ou un jeu libre'])
  // Le Divin ne se dit nulle part au Cabinet : ni gardien, ni carte-bonus (invariant 21).
  assert.ok(!JSON.stringify(ok(await laPage(b, gardiens), 'la page')).includes('dv:'), 'la page nomme un Divin')

  // Ni un geste de l'Expédition : jouer un joker, boire une fiole, voir la question, camper.
  const v = ok(await commencer(b, gardiens, { origine: 'libre', jeu: 'mot', carte: null }), 'le Mot')
  for (const geste of [{ quoi: 'jouer', joker: 'sagesse' }, { quoi: 'boire', fiole: 'clairvoyance' }, { quoi: 'voir' }, { quoi: 'camper' }]) {
    assert.deepEqual(refus(await jouer(b, gardiens, v, geste)), [400, 'Ce geste ne se lit pas : recharge la page'], geste.quoi)
  }
  ok(await jouer(b, gardiens, v, { quoi: 'quitter' }), 'quitter')
})

test('un Divin parmi ses légendaires ne part pas davantage : la règle des cartes-bonus ne connaît que les œuvres et les gardiens', async () => {
  // Les profils ne rangent jamais un Divin parmi les légendaires (`divinsOf` à part) : posé là quand même, il se refuse.
  const m = await magasinDEssai(path.join(dossierDEssai(), 'divin.db'), { t: DIX_HEURES })
  const cabinet = new CabinetStore(m.campagne.porte(), { legendairesOf: () => ['dv:helios', 'lg:chouette'] }, { maintenant: () => DIX_HEURES, calendrier: { periodeDu: () => null } })
  await assert.rejects(cabinet.commencer('qui', { origine: 'libre', jeu: 'mot', carte: 'dv:helios' }), { message: 'Tu n’as pas cette carte-bonus' })
  const chouette = await cabinet.commencer('qui', { origine: 'libre', jeu: 'mot', carte: 'lg:chouette' })
  assert.deepEqual(chouette.depart.carte, { cle: 'lg:chouette', pouvoir: 'eclairer', force: 3 })
})

test('la colonne `joker` des pièces du Cabinet ne porte que le pouvoir qui a aidé — jamais la clé d’une carte, jamais un joker de l’Expédition', async () => {
  // Ses parties à elle, une par pouvoir qui joue seul ou se joue : Coup d'œil et Échange, des œuvres de départ, sont aussi
  // des jokers de l'Expédition ; Prudence protège et Échange change sans rien marquer.
  const ines = await inscrireProfil(b.banc.url, 'ines', 'Inès')
  const series: string[] = []
  const unePartie = async (jeu: 'mot' | 'filet', carte: string, jouerLa: (v: VueDeLaPartie) => Promise<VueDeLaPartie>) => {
    const v = ok(await commencer(b, ines, { origine: 'libre', jeu, carte }), `${jeu}, ${carte}`)
    series.push(v.id)
    ok(await jouer(b, ines, await jouerLa(v), { quoi: 'quitter' }), 'quitter')
  }
  await unePartie('mot', 'coup-d-oeil', async v => jouerUnMot(b, ines, ok(await jouer(b, ines, v, { quoi: 'eclairer', manche: 0 }), 'éclairer'), 0, 1))
  await unePartie('mot', 'echange', async v => jouerUnMot(b, ines, ok(await jouer(b, ines, v, { quoi: 'changer', manche: 0 }), 'changer'), 0, 1))
  await unePartie('mot', 'prudence', v => jouerUnMot(b, ines, v, 0, 3))
  await unePartie('filet', 'concentration', v => {
    // Au-delà de la durée normale et de sa grâce, dans le temps en plus.
    b.horloge.t = v.chrono!.echeance - 5_000
    return jouerUnFilet(b, ines, v, 0, 'petit')
  })
  const jokers = series.map(s => lignesDe(s).map(l => l.joker))
  assert.deepEqual(jokers, [[JOKER_D_ECLAIRER], [null], [null], [JOKER_DU_TEMPS]])
  // Ni la clé d'une carte, ni un joker qui aide à l'Expédition (`JOKERS_QUI_AIDENT`, que le carnet lit) : `coup-d-oeil` est l'un et l'autre.
  assert.deepEqual(
    jokers.flat().filter(j => j !== null && (JOKERS_QUI_AIDENT.has(j) || ['coup-d-oeil', 'echange', 'prudence', 'concentration'].includes(j))),
    [],
  )
})

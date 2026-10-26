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
// partie quittée (`siTuQuittes`), Protéger compris. En pur, au pli : le refus
// d'Éclairer nomme l'étape — au Pari et à la Réplique, la question —, une
// manche ratée ne gagne qu'une étoile, une manche gardée au Pari ne se relève
// pas — il n'y relève qu'une ratée, à toute force —, et ce que la page en dit
// est ce que le pli fait. Ce que la carte dit à l'annonce, rendue (en
// dernières épreuves du fichier) : les secondes de Prendre son temps, jeu par
// jeu, la manche gardée au seul Pari, et rien de ce qu'ôterait une carte qui
// ne sert pas à ce jeu.
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
  pariDe,
  DIX_HEURES,
  type BancDuCabinet,
  type Reponse,
} from './cabinet-banc'
import { JOUR, MIDI, Partie, S, carte as carteDEssai, departDe, ouvrir as ouvrirAuPli } from './cabinet-plans'
import { CabinetStore, type PartieLue } from '../src/core/cabinet/magasin'
import { vueDeLaPartie } from '../src/core/cabinet/vue'
import {
  BONUS_DE_PROTECTION,
  BONUS_D_UNE_MANCHE_RATEE,
  DUREES_DES_JEUX,
  ETOILES_D_UNE_PARTIE,
  GRACE_D_UNE_MANCHE_MS,
  LIBRES_QUI_PAIENT,
  POUSSIERE_MIN,
  POUSSIERE_PAR_ETOILE,
  SECONDES_PAR_FORCE,
  SEUILS_DES_RARETES,
} from '../../shared/cabinet/bareme'
import { museeDe, type LigneDOeuvre } from '../../shared/cabinet/musee'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART } from '../../shared/cabinet/oeuvres'
import { JEUX_PRETS } from '../../shared/cabinet/ouverture'
import { bilanDe, etoilesDesManches, pieceRepondue, pouvoirMaintenant, resultatDe, type CarteDuDepart } from '../../shared/cabinet/partie'
import { JOKER_DU_TEMPS, JOKER_D_ECLAIRER } from '../../shared/cabinet/pieces'
import {
  POUVOIRS,
  ceQueFaitLaCarte,
  ditALAnnonce,
  etoilesApresLesPouvoirs,
  forceDite,
  mancheProtegee,
  refusDuPouvoir,
  sertA,
} from '../../shared/cabinet/pouvoirs'
import { JEUX, type CleDeJeu } from '../../shared/cabinet/jeux/regle'
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
  enBase(b.fichier, db => db.prepare('SELECT position, reserve_id, juste, forme, joker FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(serie) as { joker: string | null; forme: string | null }[])

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
  // Le refus ne vaut que pour la manche, et le compteur pour la partie : « Ce jeu n'a plus rien à éclairer », sous
  // « Éclairer · encore 2 », se lisait comme une contradiction (Théo et Lucas, à la tablée du 26 octobre 2026).
  assert.deepEqual([f.carte?.reste, f.pouvoir], [2, { jouable: false, refus: 'Plus rien à éclairer dans cette manche' }])
  assert.deepEqual(refus(await jouer(b, gardiens, f, { quoi: 'eclairer', manche: 0 })), [400, 'Plus rien à éclairer dans cette manche'])
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

test('le refus d’Éclairer nomme l’étape : au Pari et à la Réplique, la question — la seconde de la manche s’éclaire encore', () => {
  // « Plus rien à éclairer dans cette manche » se lisait au Pari, sous la manche, au moment même de choisir entre garder et
  // parier : Éclairer n'aiderait plus à la question du pari — quand il l'éclaire (la relecture du 26 octobre 2026).
  const pari = new Partie(departDe('pari', { carte: carteDEssai('eclairer', 2, 'repere') }))
  pari.joue(ouvrirAuPli(0), MIDI)
  // Au plan d'essai, la bonne réponse de la première question est la deuxième : juste, la manche attend son choix.
  pari.joue({ quoi: 'repondre', manche: 0, reponse: { pari: { choix: 1 } } }, MIDI + S)
  assert.deepEqual(pouvoirMaintenant(pari.depart, pari.etat, MIDI + 2 * S), { jouable: false, refus: 'Plus rien à éclairer à cette question' })
  pari.joue({ quoi: 'parier', manche: 0 }, MIDI + 3 * S)
  assert.deepEqual(pouvoirMaintenant(pari.depart, pari.etat, MIDI + 4 * S), { jouable: true }, 'la question du pari, dans la même manche')
  pari.joue({ quoi: 'eclairer', manche: 0 }, MIDI + 5 * S)

  // La Réplique : deux mots effacés à la première étape, il en reste deux ; « Qui l'a dit ? » s'éclaire encore.
  const replique = new Partie(departDe('replique', { carte: carteDEssai('eclairer', 3, 'lg:sphinx') }))
  replique.joue(ouvrirAuPli(0), MIDI)
  replique.joue({ quoi: 'eclairer', manche: 0 }, MIDI + S)
  replique.joue({ quoi: 'eclairer', manche: 0 }, MIDI + 2 * S)
  assert.deepEqual(pouvoirMaintenant(replique.depart, replique.etat, MIDI + 3 * S), { jouable: false, refus: 'Plus rien à éclairer à cette question' })
  replique.joue({ quoi: 'mot', manche: 0, choix: 0 }, MIDI + 4 * S)
  assert.deepEqual(pouvoirMaintenant(replique.depart, replique.etat, MIDI + 5 * S), { jouable: true }, '« Qui l’a dit ? », dans la même manche')

  // Un jeu d'une seule étape a toute la manche pour elle : le refus le dit ainsi (le Filet, plus haut, par les routes).
  for (const jeu of Object.keys(JEUX) as CleDeJeu[]) {
    const dit = refusDuPouvoir({ pouvoir: 'eclairer', force: 3, jeu, servi: 0, aEclairer: false })
    assert.equal(dit, JEUX[jeu].etapes === 2 ? 'Plus rien à éclairer à cette question' : 'Plus rien à éclairer dans cette manche', jeu)
  }
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
  // Changer ne marque pas la ligne : il pose une autre question, sans rien qui l'aide — sans joker. Pas nue pour autant : la
  // rechange se joue sur l'échéance de la remplacée, et sa pièce porte la forme de son jeu (une pièce n'est nue que sans joker et
  // sans « Changer »). La partie, elle, est aidée.
  assert.deepEqual(lignesDe(v.id).map(l => l.joker), [null])
  assert.deepEqual(lignesDe(v.id).map(l => l.forme), ['mot'])
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

test('Protéger relève une manche ratée d’une étoile seulement : à la force 3, deviner un titre du Détail ne fait plus une commune', () => {
  // Une manche juste au hasard et une manche ratée relevée de deux faisaient cinq étoiles : au Détail, un titre sur quatre
  // tombé juste en trois essais gagnait une commune 57,8 fois sur cent sans rien savoir (le calibrage du 26 octobre 2026).
  const toutes = [true, true, true]
  const aucune = [false, false, false]
  const phenix = carteDEssai('proteger', 3, 'lg:phenix')
  assert.equal(BONUS_D_UNE_MANCHE_RATEE, 1)
  assert.deepEqual(etoilesApresLesPouvoirs([0, 0, 3], phenix, null, toutes, aucune), [BONUS_D_UNE_MANCHE_RATEE, 0, 3])
  assert.deepEqual(etoilesApresLesPouvoirs([2, 0, 3], phenix, null, toutes, aucune), [3, 0, 3], 'imparfaite mais pas ratée : le bonus de sa force')
  assert.deepEqual(etoilesApresLesPouvoirs([1, 0, 3], phenix, null, toutes, aucune), [1 + BONUS_DE_PROTECTION[3], 0, 3])
  // Prudence relevait déjà une ratée d'une seule étoile : rien n'y change.
  assert.deepEqual(etoilesApresLesPouvoirs([0, 3, 3], carteDEssai('proteger', 1, 'prudence'), null, toutes, aucune), [1, 3, 3])
  // La phrase de l'annonce le dit, à la seule force où la ratée gagne moins que l'imparfaite.
  assert.equal(ceQueFaitLaCarte('proteger', 3, 'detail'), `${POUVOIRS.proteger.nom} : +${BONUS_DE_PROTECTION[3]} étoiles, une seule à une manche ratée`)
  assert.equal(ceQueFaitLaCarte('proteger', 1, 'detail'), `${POUVOIRS.proteger.nom} : +1 étoile, une fois par partie`)
})

/** Ce qu'une manche du Pari peut devenir : ratée à la première question, gardée, pariée et gagnée, pariée et perdue. */
type MancheDuPari = 'raté' | 'garder' | 'parier' | 'parier perdu'
const MANCHES_DU_PARI: readonly MancheDuPari[] = ['raté', 'garder', 'parier', 'parier perdu']

/** Une partie du Pari jouée manche par manche au pli, sous cette carte-bonus. */
function auPari(carte: CarteDuDepart, manches: readonly MancheDuPari[]): Partie {
  const p = new Partie(departDe('pari', { carte }))
  manches.forEach((jeu, k) => {
    const t = MIDI + k * 60 * S
    const m = k as 0 | 1 | 2
    p.joue(ouvrirAuPli(m), t)
    // Au plan d'essai, la bonne réponse de la première question est la deuxième, celle du pari la quatrième.
    p.joue({ quoi: 'repondre', manche: m, reponse: { pari: { choix: jeu === 'raté' ? 0 : 1 } } }, t + S)
    if (jeu === 'garder') p.joue({ quoi: 'garder', manche: m }, t + 2 * S)
    if (jeu.startsWith('parier')) {
      p.joue({ quoi: 'parier', manche: m }, t + 2 * S)
      p.joue({ quoi: 'repondre', manche: m, reponse: { pari: { choix: jeu === 'parier' ? 3 : 0 } } }, t + 3 * S)
    }
  })
  return p
}

test('Protéger ne relève pas une manche gardée au Pari : garder est un choix, pas une manche imparfaite', () => {
  // Théo, à la tablée du 26 octobre 2026 : 3 · 2 gardée · 3 sous Prudence faisait 3 · 3 · 3, et trois manches gardées
  // faisaient sept étoiles, une épique, sans un seul pari. Le pli dit à Protéger les manches gardées, comme les répondues.
  const prudence = carteDEssai('proteger', 1, 'prudence')
  const etoiles = (p: Partie) => etoilesDesManches(p.depart, p.etat).map(m => m.etoiles)
  // Gardée, ratée, pariée : la ratée se relève, pas la gardée.
  const theo = auPari(prudence, ['garder', 'raté', 'parier'])
  assert.deepEqual(etoiles(theo), [2, 1, 3])
  assert.deepEqual(etoilesDesManches(theo.depart, theo.etat).map(m => m.protegee), [false, true, false])
  // Gardée, ratée, gardée : la ratée, encore.
  assert.deepEqual(etoiles(auPari(prudence, ['garder', 'raté', 'garder'])), [2, 1, 2])
  // Trois manches gardées : six, sans relève — la carte n'a pas servi, et rien ne dit qu'elle a aidé.
  const gardees = auPari(prudence, ['garder', 'garder', 'garder'])
  assert.deepEqual(etoiles(gardees), [2, 2, 2])
  assert.deepEqual([resultatDe(gardees.depart, gardees.etat).total, resultatDe(gardees.depart, gardees.etat).aidee], [6, false])
  // La règle pure : une manche gardée ne se relève pas, la suivante imparfaite le prend.
  assert.equal(mancheProtegee([2, 0, 3], prudence, [true, true, true], [true, false, false]), 1)
  assert.equal(mancheProtegee([2, 2, 2], prudence, [true, true, true], [true, true, true]), null)
  // Les règles et la fiche d'une œuvre le disent dans sa phrase, qui ne sait pas à quel jeu on joue ; l'annonce, au seul Pari.
  assert.match(POUVOIRS.proteger.dit, /au Pari, une manche gardée ne compte pas/)
})

test('au Pari, Protéger ne relève qu’une manche ratée, à toute force : la carte le dit, et ne promet pas deux étoiles au Phénix', () => {
  // Une manche du Pari vaut zéro, deux — gardée, que Protéger ne relève pas — ou trois : il n'y reste à relever que des
  // ratées, d'une étoile (`BONUS_D_UNE_MANCHE_RATEE`). L'annonce du Pari disait du Phénix « +2 étoiles, une seule à une
  // manche ratée » (la relecture du 26 octobre 2026). Chaque partie possible, manche par manche, au pli.
  const plans = MANCHES_DU_PARI.flatMap(a => MANCHES_DU_PARI.flatMap(b => MANCHES_DU_PARI.map(c => [a, b, c] as const)))
  for (const [force, cle] of [
    [1, 'prudence'],
    [2, 'sursis'],
    [3, 'lg:phenix'],
  ] as const) {
    let auPlus = 0
    for (const plan of plans) {
      const p = auPari(carteDEssai('proteger', force, cle), plan)
      for (const m of etoilesDesManches(p.depart, p.etat)) {
        const releve = (m.etoiles ?? 0) - (m.naturel ?? 0)
        auPlus = Math.max(auPlus, releve)
        if (m.protegee) assert.equal(m.naturel, 0, `${cle}, ${plan.join(' · ')} : seule une ratée se relève au Pari`)
      }
    }
    assert.equal(auPlus, BONUS_D_UNE_MANCHE_RATEE, `${cle} : au Pari, Protéger relève de ${auPlus}`)
    const dit = ceQueFaitLaCarte('proteger', force, 'pari')
    assert.equal(dit, `${POUVOIRS.proteger.nom} : +${BONUS_D_UNE_MANCHE_RATEE} étoile à une manche ratée ; une manche gardée ne compte pas`, cle)
    // Ailleurs, la force dit son bonus, et rien du Pari.
    assert.doesNotMatch(ceQueFaitLaCarte('proteger', force, 'detail'), /gardée|Pari/, cle)
    assert.equal(forceDite('proteger', force), forceDite('proteger', force, 'detail'), 'la fiche d’une œuvre, sans jeu : la force de partout')
  }
})

test('ce que la page dit de Protéger est ce que le pli fait : la première manche imparfaite où il a répondu, et pas gardée au Pari', () => {
  // La page disait « Ta première manche imparfaite gagne des étoiles, si tu y as répondu » : une première manche laissée au
  // chrono semblait faire perdre Protéger, quand le pli relevait la suivante qu'une réponse a tranchée (la relecture du
  // 26 octobre 2026).
  assert.match(POUVOIRS.proteger.dit, /^Ta première manche imparfaite où tu as répondu gagne des étoiles ; au Pari, une manche gardée ne compte pas\.$/)
  const prudence = carteDEssai('proteger', 1, 'prudence')
  /**
   * La phrase prise au mot, par qui a joué : les manches où il a répondu — ce que le pli range, ses pièces —, celles qu'il a
   * gardées — son geste —, et les étoiles qu'il a vues. Puis l'ancienne, qui relevait la première imparfaite si elle était
   * répondue, et sinon rien.
   */
  const lu = (p: Partie, gardees: readonly boolean[]) => {
    const manches = etoilesDesManches(p.depart, p.etat)
    const repondues = manches.map((_, k) => p.etat.manches[k]?.verdict?.pieces.some(pieceRepondue) === true)
    const imparfaite = (k: number) => manches[k].naturel !== null && manches[k].naturel! < 3
    const auMot = manches.findIndex((_, k) => imparfaite(k) && repondues[k] && !gardees[k])
    const premiere = manches.findIndex((_, k) => imparfaite(k))
    return { pli: manches.findIndex(m => m.protegee), auMot, avant: premiere >= 0 && repondues[premiere] ? premiere : -1 }
  }

  // Manche 1 laissée au chrono, manche 2 fausse : le pli relève la deuxième, et l'ancienne phrase rien.
  const p = new Partie(departDe('pari', { carte: prudence }))
  p.joue(ouvrirAuPli(0), MIDI)
  // La réponse vide de la page arrive après la grâce : la manche expire.
  const apres = MIDI + DUREES_DES_JEUX.pari * S + GRACE_D_UNE_MANCHE_MS + S
  p.joue({ quoi: 'repondre', manche: 0, reponse: { pari: { choix: 0 } } }, apres)
  p.joue(ouvrirAuPli(1), apres + S)
  p.joue({ quoi: 'repondre', manche: 1, reponse: { pari: { choix: 0 } } }, apres + 5 * S)
  assert.deepEqual(
    etoilesDesManches(p.depart, p.etat)
      .slice(0, 2)
      .map(m => [m.naturel, m.fin]),
    [
      [0, 'expiree'],
      [0, 'jugee'],
    ],
  )
  assert.deepEqual(lu(p, [false, false, false]), { pli: 1, auMot: 1, avant: -1 })

  // Gardée, puis ratée : l'ancienne phrase relevait la gardée, imparfaite et répondue ; le pli et la phrase, la ratée.
  const theo = auPari(prudence, ['garder', 'raté', 'parier'])
  assert.deepEqual(lu(theo, [true, false, false]), { pli: 1, auMot: 1, avant: 0 })

  // Et chaque partie possible, manche par manche : la phrase dit toujours la manche que le pli relève.
  for (const a of MANCHES_DU_PARI) {
    for (const b of MANCHES_DU_PARI) {
      for (const c of MANCHES_DU_PARI) {
        const plan = [a, b, c]
        const { pli, auMot } = lu(auPari(prudence, plan), plan.map(m => m === 'garder'))
        assert.equal(pli, auMot, plan.join(' · '))
      }
    }
  }
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

test('Prendre son temps dit où vont ses secondes : par manche à l’Éclair, à chacune des deux questions du Pari', async () => {
  // « +10 s à chaque question » : Théo et Jeanne attendaient dix secondes par affirmation de l'Éclair, qui n'en donne que
  // dix pour les cinq — une étape, quand le Pari et la Réplique en ont deux (la tablée du 26 octobre 2026).
  const zoe = await inscrireProfil(b.banc.url, 'zoe', 'Zoé')
  const eclair = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'eclair', carte: 'concentration' }), 'l’Éclair')
  assert.equal(eclair.carte?.dit, `${POUVOIRS.temps.nom} : +${SECONDES_PAR_FORCE} s par manche`)
  assert.equal(eclair.chrono!.dureeMs, (DUREES_DES_JEUX.eclair + SECONDES_PAR_FORCE) * 1000, 'dix secondes pour les cinq affirmations')
  ok(await jouer(b, zoe, eclair, { quoi: 'quitter' }), 'quitter')
  const pari = ok(await commencer(b, zoe, { origine: 'libre', jeu: 'pari', carte: 'concentration' }), 'le Pari')
  assert.equal(pari.carte?.dit, `${POUVOIRS.temps.nom} : +${SECONDES_PAR_FORCE} s à chacune de ses deux questions`)
  ok(await jouer(b, zoe, pari, { quoi: 'quitter' }), 'quitter')
  // La règle, d'où que la page la lise : ce que la carte dit de chaque jeu suit ses étapes (`JEUX[jeu].etapes`).
  for (const jeu of Object.keys(JEUX) as CleDeJeu[]) {
    assert.match(ceQueFaitLaCarte('temps', 2, jeu), JEUX[jeu].etapes === 2 ? /\+20 s à chacune de ses deux questions$/ : /\+20 s par manche$/, jeu)
  }
  assert.match(POUVOIRS.temps.dit, /à chaque manche — à chacune de ses deux questions au Pari et à la Réplique/)
})

test('le bilan d’un double ne dit « sans cadre doré » que d’un cadre qui pouvait se dorer : déjà doré, il n’a rien perdu', () => {
  // Une case de la visite « pour dorer » — l'œuvre à lui, pas dorée à minuit — se dore le matin à la poussière, puis se joue à
  // neuf sur neuf sous Éclairer : elle se double, comme une œuvre que son cadre attend encore. Le bilan disait « sans cadre doré :
  // Éclairer a servi » d'un cadre doré depuis le matin. La même partie, par le pli et le bilan de la fin, puis par la vue.
  const cible = OEUVRES.find(o => !OEUVRES_DE_DEPART.includes(o.cle))!
  const depart = departDe('mot', { origine: 'visite', visite: 0, cible: cible.cle, but: 'dorer', seuil: SEUILS_DES_RARETES[cible.rarete], carte: carteDEssai('eclairer', 1) })
  const p = new Partie(depart)
  p.joue(ouvrirAuPli(0), MIDI)
  p.joue({ quoi: 'eclairer', manche: 0 }, MIDI + S)
  p.joue({ quoi: 'essai', manche: 0, lettres: 'VILNIUS' }, MIDI + 2 * S)
  for (const k of [1, 2] as const) {
    p.joue(ouvrirAuPli(k), MIDI + k * 20 * S)
    p.joue({ quoi: 'essai', manche: k, lettres: 'VILNIUS' }, MIDI + (k * 20 + 1) * S)
  }
  const bilan = bilanDe(depart, p.etat, { possedee: true, doree: true })
  assert.deepEqual([bilan.issue, bilan.naturel, bilan.aidee], ['double', [3, 3, 3], true])
  const ligne: LigneDOeuvre = { oeuvre: cible.cle, origine: 'partie', gagneeLe: 1, saison: null, serieId: null, prix: null, doreeLe: null, dorure: null, prixDorure: null, serieDoree: null }
  const visite = { jour: JOUR, cases: [{ jeu: 'mot' as const, cible: cible.cle, but: 'dorer' as const }], echange: null, figee: true }
  const lue = (aujourdhui?: { doreeLe: number | null }): PartieLue => ({
    id: 'la-case',
    profileId: 'qui',
    depart,
    gestes: p.gestes,
    etat: p.etat,
    bilan,
    lueA: MIDI + 60 * S,
    ...(aujourdhui && { aujourdhui: { musee: museeDe({ jour: JOUR, oeuvres: [{ ...ligne, ...aujourdhui }] }), visite, jeux: JEUX_PRETS } }),
  })
  const double = `${cible.nom} était déjà à toi : sa poussière d’or en plus`
  assert.equal(vueDeLaPartie(lue({ doreeLe: MIDI - 3_600_000 })).bilan?.dit, double, 'doré le matin : rien de perdu')
  assert.equal(vueDeLaPartie(lue({ doreeLe: null })).bilan?.dit, `${double} — sans cadre doré : Éclairer a servi`, 'son cadre attendait : Éclairer l’a ôté')
  // Le bilan figé ne sait pas si le cadre était doré ; sans le musée de la mémoire, la phrase se tait plutôt que d'inventer une perte.
  assert.equal(vueDeLaPartie(lue()).bilan?.dit, double)
})

// ── Quitter ───────────────────────────────────────────────────────────────

test('« Quitter ? » dit ce que vaudrait la partie quittée à cet instant : le geste joué par le pli sur l’état, rien d’écrit', async () => {
  const ugo = await inscrireProfil(b.banc.url, 'ugo', 'Ugo')
  // Une chasse sous Prudence, sa première manche ouverte : quittée d'emblée, elle ne vaut rien — ni la manche que Protéger
  // relevait, ni le plancher de la poussière. Elle valait une étoile et quatre poussières jusqu'au 26 octobre 2026, quand
  // « Quitter ? » promettait « les étoiles déjà gagnées » : zéro, croyait Lucas.
  const chasse = ok(await commencer(b, ugo, { origine: 'chasse', oeuvre: 'lecon', carte: 'prudence' }), 'la chasse')
  assert.deepEqual(chasse.siTuQuittes, { total: 0, poussiere: 0 })
  assert.deepEqual(ok(await laPage(b, ugo), 'la page').enCours?.siTuQuittes, chasse.siTuQuittes, 'la page relue dit la même chose')
  const quittee = ok(await jouer(b, ugo, chasse, { quoi: 'quitter' }), 'quitter')
  assert.deepEqual([quittee.bilan?.total, quittee.bilan?.poussiere], [chasse.siTuQuittes!.total, chasse.siTuQuittes!.poussiere], 'le bilan tient la promesse')
  assert.equal(quittee.siTuQuittes, undefined, 'finie, plus rien à quitter')
  // Rien ne s'est écrit pour le dire : la partie n'avait qu'un geste, son ouverture, avant « Quitter ».
  assert.equal(enBase(b.fichier, db => (db.prepare('SELECT COUNT(*) AS n FROM cabinet_gestes WHERE serie_id = ?').get(chasse.id) as { n: number }).n), 2)
  // Répondue faux, puis quittée : Protéger relève la manche répondue — ratée, d'une étoile —, et la chasse paie son
  // plancher ; la promesse le dit.
  const seconde = ok(await commencer(b, ugo, { origine: 'chasse', oeuvre: 'lecon', carte: 'prudence' }), 'la seconde chasse')
  const q1 = pariDe(b, seconde.id, 0).q1
  const ratee = ok(await jouer(b, ugo, seconde, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: (q1.bonne + 1) % q1.reponses.length } } }), 'répondre faux')
  assert.deepEqual(ratee.siTuQuittes, { total: BONUS_D_UNE_MANCHE_RATEE, poussiere: POUSSIERE_MIN })
  const apres = ok(await jouer(b, ugo, ratee, { quoi: 'quitter' }), 'quitter après une réponse')
  assert.deepEqual([apres.bilan?.total, apres.bilan?.poussiere], [BONUS_D_UNE_MANCHE_RATEE, POUSSIERE_MIN], 'le bilan tient la promesse')

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

  // Sous la pause de « Quitter ? » — l'instant même où la page le lit —, la même promesse. Le temps de la manche écoulé, plus rien :
  // la page envoie d'elle-même sa réponse, et la révélation suit ; joué alors, « Quitter » laisserait la manche expirée, et la
  // promesse aurait dit le bilan d'une partie que le joueur n'a pas quittée.
  const vic = await inscrireProfil(b.banc.url, 'vic', 'Vic')
  let p = ok(await commencer(b, vic, { origine: 'libre', jeu: 'mot', carte: 'prudence' }), 'le Mot sous Prudence')
  const avant = p.siTuQuittes
  assert.ok(avant, 'la manche ouverte : une promesse')
  p = ok(await jouer(b, vic, p, { quoi: 'pause', manche: 0 }), 'la pause de « Quitter ? »')
  assert.ok(p.chrono?.pauseResteMs !== undefined, 'en pause')
  assert.deepEqual(p.siTuQuittes, avant)
  p = ok(await jouer(b, vic, p, { quoi: 'reprendre', manche: 0 }), 'reprendre')
  b.horloge.t = p.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
  const ecoulee = ok(await laPage(b, vic), 'la page, le temps écoulé').enCours
  assert.deepEqual([ecoulee?.id, ecoulee?.siTuQuittes], [p.id, undefined])
  ok(await jouer(b, vic, ecoulee!, { quoi: 'quitter' }), 'quitter')
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

// ── Ce que la carte dit à l'annonce ───────────────────────────────────────

/**
 * L'annonce rendue, telle que la page la montre : le client compile son JSX pour un `React` global, et `state.ts` lit son
 * adresse à l'import — posés avant le composant, aux deux dernières épreuves du fichier : les routes d'avant n'en ont rien vu.
 */
let annonceLancee: Promise<(demande: Record<string, unknown>, carte: string) => string> | null = null
const lAnnonce = () =>
  (annonceLancee ??= (async () => {
    const React = (await import('react')).default
    Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })
    const { Annonce } = await import(new URL('../../client/src/views/cabinet/Annonce.tsx', import.meta.url).href)
    const { renderToStaticMarkup } = await import('react-dom/server')
    const theo = await inscrireProfil(b.banc.url, 'theo', 'Théo')
    const page = ok(await laPage(b, theo), 'la page')
    const texte = (html: string) =>
      html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x27;|&#39;/g, '’')
        .replace(/[\u00a0\u202f\u2060]/g, ' ')
        .replace(/\s+/g, ' ')
    const rien = () => {}
    return (demande: Record<string, unknown>, carte: string) =>
      texte(renderToStaticMarkup(React.createElement(Annonce, { page, demande, carte, busy: false, onCarte: rien, onCommencer: rien, onRetour: rien })))
  })())

test('une carte-bonus qui ne sert pas à ce jeu ne dit pas ce qu’elle ôterait : à la Frise, Changer se tait sur le cadre doré', async () => {
  // L'annonce d'une chasse à la Frise, Échange emporté — la carte de Changer de tout nouveau joueur — disait « Changer ne sert
  // pas à la Frise », puis ce que fait Changer et « T'en servir ôte le cadre doré » (la relecture du 26 octobre 2026) : une
  // seule règle, `sertA`, que la ligne de la carte et l'annonce lisent toutes deux.
  for (const jeu of Object.keys(JEUX) as CleDeJeu[]) {
    assert.equal(sertA('changer', jeu), JEUX[jeu].changeable, jeu)
    for (const p of ['eclairer', 'proteger', 'temps', 'miser'] as const) assert.equal(sertA(p, jeu), true, `${p}, ${jeu}`)
  }
  assert.equal(ceQueFaitLaCarte('changer', 1, 'frise'), `${POUVOIRS.changer.nom} ne sert pas à la Frise`)
  const annonce = await lAnnonce()
  const aLaFrise = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === 'frise' && !OEUVRES_DE_DEPART.includes(o.cle))!
  const t = annonce({ origine: 'chasse', oeuvre: aLaFrise.cle }, 'echange')
  assert.match(t, /Changer ne sert pas à la Frise/)
  assert.match(t, /cadre doré/, 'une œuvre à gagner : l’annonce parle du cadre doré')
  assert.doesNotMatch(t, /T’en servir ôte le cadre doré/, t)
  assert.ok(!t.includes(POUVOIRS.changer.dit.replace(/'/g, '’')), 'ni ce que Changer ferait, à un jeu où il ne sert pas')
  // Au jeu où il sert, rien ne change : ce qu'il fait, et ce qu'il ôterait.
  const ailleurs = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === 'eclair' && !OEUVRES_DE_DEPART.includes(o.cle))!
  assert.match(annonce({ origine: 'chasse', oeuvre: ailleurs.cle }, 'echange'), /T’en servir ôte le cadre doré/)
})

test('l’annonce dit ce que la carte fait à ce jeu, rien de ce qui ne vaut qu’à un autre : la manche gardée au seul Pari', async () => {
  // « Au Pari, une manche gardée ne compte pas » se lisait sous Prudence à l'annonce de chacun des neuf jeux, et « à chacune de
  // ses deux questions au Pari et à la Réplique » sous Concentration à l'Éclair (la relecture du 26 octobre 2026) : les règles
  // et la fiche d'une œuvre les disent, qui ne savent pas à quel jeu on joue ; l'annonce, au seul jeu où elles valent.
  const annonce = await lAnnonce()
  const fois = (t: string, mot: string) => t.split(mot).length - 1
  for (const jeu of Object.keys(JEUX) as CleDeJeu[]) {
    const protege = annonce({ origine: 'libre', jeu }, 'prudence')
    assert.ok(protege.includes(ditALAnnonce('proteger')), `${jeu} : ${protege}`)
    assert.ok(protege.includes(ceQueFaitLaCarte('proteger', 1, jeu)), `${jeu} : ${protege}`)
    // Au Pari, une fois — la ligne de sa force —, ailleurs jamais.
    assert.equal(fois(protege, 'gardée'), jeu === 'pari' ? 1 : 0, `${jeu} : ${protege}`)
    const temps = annonce({ origine: 'libre', jeu }, 'concentration')
    assert.ok(temps.includes(ditALAnnonce('temps')), `${jeu} : ${temps}`)
    assert.doesNotMatch(temps, /au Pari et à la Réplique/, jeu)
  }
  // La phrase de l'annonce est celle de partout, moins ce qui ne vaut qu'à un jeu : rien d'autre ne s'y invente.
  assert.equal(ditALAnnonce('proteger'), 'Ta première manche imparfaite où tu as répondu gagne des étoiles.')
  assert.ok(POUVOIRS.proteger.dit.startsWith(ditALAnnonce('proteger').replace(/\.$/, '')))
  assert.equal(ditALAnnonce('temps'), 'Du temps en plus ; il ne compte que si tu t’en sers.')
  for (const p of ['eclairer', 'miser', 'changer'] as const) assert.equal(ditALAnnonce(p), POUVOIRS[p].dit, p)
})

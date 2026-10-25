// Le chrono des manches du Cabinet, à l'heure du serveur (`shared/cabinet/chrono.ts`,
// la règle `.claude/rules/cabinet.md`), en pur : figé au départ ; dans les temps, dans la
// grâce, en retard ; la réponse que la page envoie d'elle-même à l'échéance ;
// la pause de « Quitter ? », bornée et voilée ; le Pari sans chrono entre ses
// étapes ; la Réplique, dont « Qui l'a dit ? » s'ouvre aussi à l'échéance du
// mot ; « Prendre son temps », marqué seulement s'il a servi. Et jamais
// l'horloge de la machine, ni dans les règles ni au serveur du Cabinet. Puis
// le même chrono par les routes, l'horloge du banc à la main
// (`horlogeDuJour`) : l'heure d'arrivée de la requête juge, jamais celle du
// téléphone.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  bancDuCabinet,
  commencer,
  dossierDEssai,
  eclairDe,
  enBase,
  fermerLesMagasins,
  jouer,
  magasinDEssai,
  ok,
  ouvrir as ouvrirLaManche,
  vraiesDe,
} from './cabinet-banc'
import { vueDeLaPartie } from '../src/core/cabinet/vue'
import { DUREES_DES_JEUX, ETOILES_DU_PARI, GRACE_D_UNE_MANCHE_MS, PAUSE_MAX_MS, PAUSES_PAR_MANCHE, SECONDES_PAR_FORCE } from '../../shared/cabinet/bareme'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import { dansLesTemps, echeanceDe, etapeOuverte, limiteDe, pauseCompteeMs, pauseResteMs } from '../../shared/cabinet/chrono'
import { JOKER_DU_TEMPS } from '../../shared/cabinet/pieces'
import { chronoDuDepart, phaseDe, pouvoirMaintenant, resultatDe, type GesteDuCabinet, type Manche } from '../../shared/cabinet/partie'
import type { EpingleTiree } from '../../shared/cabinet/jeux/epingle'
import type { RepliqueTiree } from '../../shared/cabinet/jeux/replique'
import { MIDI, Partie, S, carte, departDe, ouvrir } from './cabinet-plans'

after(fermerLesMagasins)

const essai = (manche: Manche, lettres: string): GesteDuCabinet => ({ quoi: 'essai', manche, lettres })
const repondre = (manche: Manche, reponse?: object, auto?: true): GesteDuCabinet => ({ quoi: 'repondre', manche, ...(auto && { auto }), ...(reponse && { reponse }) }) as GesteDuCabinet
const MOT_MS = DUREES_DES_JEUX.mot * S

test('le chrono d’une étape : son échéance, la grâce du réseau, la pause bornée à trente secondes par manche', () => {
  const e = etapeOuverte(MIDI, 45 * S)
  assert.equal(echeanceDe(e, MIDI), MIDI + 45 * S)
  assert.equal(dansLesTemps(e, MIDI + 45 * S + GRACE_D_UNE_MANCHE_MS), true, 'jusqu’au bout de la grâce')
  assert.equal(dansLesTemps(e, MIDI + 45 * S + GRACE_D_UNE_MANCHE_MS + 1), false)
  assert.equal(limiteDe(e), MIDI + 45 * S + GRACE_D_UNE_MANCHE_MS)
  // Une pause de dix secondes recule l'échéance de dix ; une pause qui dure, tant qu'il en reste.
  const dix = { ...e, pauses: [{ depuis: MIDI + 5 * S, jusqua: MIDI + 15 * S }] }
  assert.equal(echeanceDe(dix, MIDI + 20 * S), MIDI + 55 * S)
  const enCours = { ...e, pauses: [{ depuis: MIDI + 5 * S }] }
  assert.equal(echeanceDe(enCours, MIDI + 25 * S), MIDI + 65 * S, 'le chrono figé pendant la pause')
  assert.equal(pauseResteMs(enCours, MIDI + 25 * S), PAUSE_MAX_MS - 20 * S)
  // Au-delà de trente secondes, le chrono reprend sous le voile : la confirmation ne s'achète pas du temps.
  assert.equal(pauseCompteeMs(enCours, MIDI + 10 * 60 * S), PAUSE_MAX_MS)
  assert.equal(echeanceDe(enCours, MIDI + 10 * 60 * S), MIDI + 45 * S + PAUSE_MAX_MS)
  assert.equal(limiteDe(enCours), MIDI + 45 * S + PAUSE_MAX_MS + GRACE_D_UNE_MANCHE_MS)
  assert.equal(pauseResteMs(enCours, MIDI + 10 * 60 * S), 0)
  // Une étape d'après n'a que ce que la première n'a pas pris.
  assert.equal(etapeOuverte(MIDI, 25 * S, 12 * S).pauseDisponibleMs, 12 * S)
})

test('le chrono se lit au départ, figé, jamais au barème du jour : une durée changée ne touche pas une manche en route', () => {
  // Une partie commencée sous un autre barème — le Mot à 90 s, une grâce d'une seconde, dix secondes de pause —, relue
  // aujourd'hui : chacune de ses manches court à ce qu'elle avait au départ.
  // Ce que le serveur fige au départ : les chiffres du jour, une durée par étape, le temps en plus de sa carte.
  assert.deepEqual(chronoDuDepart('pari', carte('temps', 2, 'pioche')), {
    etapesMs: [DUREES_DES_JEUX.pari * S, DUREES_DES_JEUX.pari * S],
    enPlusMs: 2 * SECONDES_PAR_FORCE * S,
    graceMs: GRACE_D_UNE_MANCHE_MS,
    pauseMs: PAUSE_MAX_MS,
  })
  assert.deepEqual(chronoDuDepart('mot', carte('eclairer')).etapesMs, [MOT_MS])
  assert.equal(chronoDuDepart('mot', carte('eclairer')).enPlusMs, 0, 'une autre carte ne donne pas de temps')
  const avant = { etapesMs: [90 * S], enPlusMs: 0, graceMs: S, pauseMs: 10 * S }
  const p = new Partie(departDe('mot', { chrono: avant }))
  p.joue(ouvrir(0), MIDI)
  assert.equal(p.etat.manches[0].etapes[0].dureeMs, 90 * S)
  p.joue({ quoi: 'pause', manche: 0 }, MIDI + 10 * S)
  p.joue({ quoi: 'reprendre', manche: 0 }, MIDI + 40 * S)
  assert.equal(echeanceDe(p.etat.manches[0].etapes[0], MIDI + 41 * S), MIDI + 100 * S, 'dix secondes de pause, pas trente')
  p.joue(essai(0, 'KAUNASS'), MIDI + 101 * S)
  assert.equal(p.refuse(essai(0, 'VILNIUS'), MIDI + 101 * S + 1), 'Le temps de cette manche est écoulé', 'une seconde de grâce')
  // « Prendre son temps » aussi : ce qu'il ajoutait au départ, quelle que soit sa force aujourd'hui.
  const temps = new Partie(departDe('pari', { carte: carte('temps', 3, 'maitrise'), chrono: { etapesMs: [20 * S, 20 * S], enPlusMs: 5 * S, graceMs: S, pauseMs: 30 * S } }))
  temps.joue(ouvrir(0), MIDI)
  assert.deepEqual([temps.etat.manches[0].etapes[0].dureeMs, temps.etat.manches[0].etapes[0].dureeNormaleMs], [25 * S, 20 * S])
  temps.joue(repondre(0, { pari: { choix: 1 } }), MIDI + 23 * S)
  temps.joue({ quoi: 'garder', manche: 0 }, MIDI + 30 * S)
  assert.equal(temps.etat.pieces[0].joker, JOKER_DU_TEMPS, 'arrivée après sa durée normale et sa grâce d’alors')
})

test('dans les temps, dans la grâce, en retard : un geste après la grâce se refuse, une réponse la juge expirée', () => {
  const p = new Partie(departDe('mot'))
  p.joue(ouvrir(0), MIDI)
  p.joue(essai(0, 'KAUNASS'), MIDI + MOT_MS - S)
  // Dans la grâce : le réseau d'un téléphone — envoyé à temps, arrivé un peu après.
  p.joue(essai(0, 'PALANGA'), MIDI + MOT_MS + GRACE_D_UNE_MANCHE_MS)
  assert.equal(p.refuse(essai(0, 'VILNIUS'), MIDI + MOT_MS + GRACE_D_UNE_MANCHE_MS + 1), 'Le temps de cette manche est écoulé')
  assert.equal(phaseDe(p.etat), 'jouer', 'aucune minuterie au serveur : elle se juge au geste suivant')
  // La page envoie d'elle-même ce qu'elle a sous les yeux ; arrivé en retard, rien de ce qu'il porte ne compte.
  p.joue(repondre(0, undefined, true), MIDI + MOT_MS + 10 * S)
  const [x] = p.etat.pieces
  assert.equal(p.etat.manches[0].fin, 'expiree')
  // Ce que le serveur savait déjà compte : deux essais faits dans les temps, une réponse fausse.
  assert.deepEqual([x.juste, x.choix, x.composee], [false, -1, 'KAUNASS,PALANGA'])
  assert.equal(x.repondueLe, MIDI + MOT_MS + GRACE_D_UNE_MANCHE_MS, 'l’heure où l’étape a cessé d’attendre')
})

test('la réponse « auto » dans la grâce se juge sur ce qu’elle porte ; après, la manche est expirée', () => {
  const lancer = (t: number) => {
    const p = new Partie(departDe('filet'))
    p.joue(ouvrir(0), MIDI)
    p.joue(repondre(0, { filet: { x: 1852, taille: 'petit' } }, true), t)
    return p.etat
  }
  const filet = DUREES_DES_JEUX.filet * S
  const dansLaGrace = lancer(MIDI + filet + GRACE_D_UNE_MANCHE_MS - 1)
  assert.deepEqual([dansLaGrace.manches[0].verdict?.naturel, dansLaGrace.manches[0].fin], [3, 'jugee'])
  const enRetard = lancer(MIDI + filet + GRACE_D_UNE_MANCHE_MS + 1)
  assert.deepEqual([enRetard.manches[0].verdict?.naturel, enRetard.manches[0].fin, enRetard.pieces[0].choix], [0, 'expiree', null])
})

test('Éclairer trop tard se refuse ; la vue le grise', () => {
  const p = new Partie(departDe('mot', { carte: carte('eclairer', 3, 'lg:chouette') }))
  p.joue(ouvrir(0), MIDI)
  p.joue({ quoi: 'eclairer', manche: 0 }, MIDI + MOT_MS)
  assert.equal(p.refuse({ quoi: 'eclairer', manche: 0 }, MIDI + MOT_MS + GRACE_D_UNE_MANCHE_MS + 1), 'Le temps de cette manche est écoulé')
  assert.equal(pouvoirMaintenant(p.depart, p.etat, MIDI + MOT_MS + GRACE_D_UNE_MANCHE_MS + 1)?.refus, 'Le temps de cette manche est écoulé')
})

test('la pause de « Quitter ? » : trente secondes au plus par manche, la manche voilée, puis le chrono reprend', () => {
  const p = new Partie(departDe('mot'))
  p.joue(ouvrir(0), MIDI)
  p.joue({ quoi: 'pause', manche: 0 }, MIDI + 10 * S)
  assert.equal(phaseDe(p.etat), 'pause')
  // Sous le voile, rien ne se joue : ni un essai, ni Éclairer, ni une seconde pause.
  assert.equal(p.refuse(essai(0, 'VILNIUS'), MIDI + 11 * S), 'La partie est en pause : reprends-la d’abord')
  assert.equal(p.refuse({ quoi: 'pause', manche: 0 }, MIDI + 11 * S), 'La partie est déjà en pause')
  // « Continuer » au bout de vingt secondes : l'échéance a reculé de vingt.
  p.joue({ quoi: 'reprendre', manche: 0 }, MIDI + 30 * S)
  assert.equal(phaseDe(p.etat), 'jouer')
  assert.equal(p.refuse({ quoi: 'reprendre', manche: 0 }, MIDI + 31 * S), 'La partie n’est pas en pause')
  assert.equal(echeanceDe(p.etat.manches[0].etapes[0], MIDI + 31 * S), MIDI + MOT_MS + 20 * S)
  // Une seconde pause n'a que les dix secondes qui restent ; oubliée — le téléphone qui s'endort —, elle n'en vaut pas plus.
  p.joue({ quoi: 'pause', manche: 0 }, MIDI + 40 * S)
  const limite = MIDI + MOT_MS + PAUSE_MAX_MS + GRACE_D_UNE_MANCHE_MS
  assert.equal(limiteDe(p.etat.manches[0].etapes[0]), limite)
  p.joue({ quoi: 'quitter' }, limite + 60 * S)
  assert.equal(p.etat.manches[0].fin, 'expiree', 'le chrono a repris sous le voile, et la manche a expiré avant « Quitter »')
  assert.equal(p.etat.pieces[0].repondueLe, limite)
  // La pause, oubliée sur une manche qui court encore : quitter la juge quittée.
  const q = new Partie(departDe('mot'))
  q.joue(ouvrir(0), MIDI)
  q.joue({ quoi: 'pause', manche: 0 }, MIDI + 10 * S)
  q.joue({ quoi: 'quitter' }, MIDI + 15 * S)
  assert.equal(q.etat.manches[0].fin, 'quittee')
  assert.equal(q.etat.manches[0].etapes[0].pauses[0].jusqua, MIDI + 15 * S, 'la pause se ferme avec la manche')
})

test('la pause oubliée : la réponse que la page envoie à l’échéance reculée se juge sur ce qu’elle porte, et ferme la pause', () => {
  // Le téléphone reste sur « Quitter ? » : au bout des trente secondes, le chrono reprend sous le voile, et à
  // l'échéance la page envoie d'elle-même l'épingle qu'elle tenait. Elle était à l'heure : elle compte.
  const epingle = DUREES_DES_JEUX.epingle * S
  const planter = (t: number) => {
    const p = new Partie(departDe('epingle'))
    const { lieu } = p.depart.tirages[0] as EpingleTiree
    p.joue(ouvrir(0), MIDI)
    p.joue({ quoi: 'pause', manche: 0 }, MIDI + 10 * S)
    p.joue(repondre(0, { epingle: { lat: lieu.lat, lon: lieu.lon } }, true), t)
    return p.etat
  }
  const aLHeure = planter(MIDI + epingle + PAUSE_MAX_MS)
  assert.deepEqual([aLHeure.manches[0].fin, aLHeure.manches[0].verdict?.naturel], ['jugee', 3], 'l’épingle posée compte')
  assert.equal(aLHeure.manches[0].etapes[0].pauses[0].jusqua, MIDI + epingle + PAUSE_MAX_MS, 'la réponse ferme la pause')
  assert.equal(phaseDe(aLHeure), 'revele')
  // Dans la grâce aussi ; après, la manche a expiré sous le voile, et rien de ce qu'elle porte ne compte.
  assert.equal(planter(MIDI + epingle + PAUSE_MAX_MS + GRACE_D_UNE_MANCHE_MS).manches[0].fin, 'jugee')
  const tard = planter(MIDI + epingle + PAUSE_MAX_MS + GRACE_D_UNE_MANCHE_MS + 1)
  assert.deepEqual([tard.manches[0].fin, tard.manches[0].verdict?.naturel], ['expiree', 0])
  // Sous la pause, seule la réponse passe : un essai, Éclairer attendent « Continuer ».
  const mot = new Partie(departDe('mot'))
  mot.joue(ouvrir(0), MIDI)
  mot.joue({ quoi: 'pause', manche: 0 }, MIDI + 10 * S)
  assert.equal(mot.refuse(essai(0, 'VILNIUS'), MIDI + 60 * S), 'La partie est en pause : reprends-la d’abord')
})

test('la pause a ses bornes : trois par manche, ses étapes comprises, et aucune quand ses trente secondes sont passées', () => {
  // Chaque pause et sa reprise s'écrivent : une page qui les enchaînait au même instant écrivait des centaines de
  // gestes par manche sans rien consommer de ses trente secondes, et chaque relecture les repliait (la relecture du
  // lot C1, le 25 octobre 2026 : 200 paires, 401 gestes, pas un refus).
  const pari = new Partie(departDe('pari'))
  const { q1 } = pari.depart.tirages[0] as PariTire
  pari.joue(ouvrir(0), MIDI)
  for (let k = 0; k < PAUSES_PAR_MANCHE - 1; k++) {
    pari.joue({ quoi: 'pause', manche: 0 }, MIDI + S)
    pari.joue({ quoi: 'reprendre', manche: 0 }, MIDI + S)
  }
  assert.equal(echeanceDe(pari.etat.manches[0].etapes[0], MIDI + 2 * S), MIDI + DUREES_DES_JEUX.pari * S, 'des pauses vides ne reculent rien')
  // La seconde étape du Pari a ce qui reste à sa manche : une pause, la dernière.
  pari.joue(repondre(0, { pari: { choix: q1.bonne } }), MIDI + 2 * S)
  pari.joue({ quoi: 'parier', manche: 0 }, MIDI + 3 * S)
  pari.joue({ quoi: 'pause', manche: 0 }, MIDI + 4 * S)
  pari.joue({ quoi: 'reprendre', manche: 0 }, MIDI + 5 * S)
  assert.equal(pari.refuse({ quoi: 'pause', manche: 0 }, MIDI + 6 * S), 'Plus de pause pour cette manche : le chrono continue')
  // La manche d'après a les siennes.
  pari.joue(repondre(0, { pari: { choix: 0 } }), MIDI + 7 * S)
  pari.joue(ouvrir(1), MIDI + 8 * S)
  pari.joue({ quoi: 'pause', manche: 1 }, MIDI + 9 * S)

  // Ses trente secondes passées, une pause ne figerait plus rien : elle se refuse, même la première de trop.
  const mot = new Partie(departDe('mot'))
  mot.joue(ouvrir(0), MIDI)
  mot.joue({ quoi: 'pause', manche: 0 }, MIDI + S)
  mot.joue({ quoi: 'reprendre', manche: 0 }, MIDI + S + PAUSE_MAX_MS)
  assert.equal(mot.refuse({ quoi: 'pause', manche: 0 }, MIDI + 2 * S + PAUSE_MAX_MS), 'Plus de pause pour cette manche : le chrono continue')
  assert.ok(PAUSES_PAR_MANCHE > 1, 'une seule pause : la seconde ne serait pas refusée pour son temps')
})

test('le Pari : un chrono par étape, aucun entre « Juste ! » et « Garder » ou « Parier »', () => {
  const pari = DUREES_DES_JEUX.pari * S
  const p = new Partie(departDe('pari'))
  p.joue(ouvrir(0), MIDI)
  p.joue(repondre(0, { pari: { choix: 1 } }), MIDI + 10 * S)
  // Dix minutes à se décider : la difficile n'est pas encore montrée, il n'y a rien à chercher.
  assert.equal(p.refuse({ quoi: 'pause', manche: 0 }, MIDI + 600 * S), 'Aucun chrono ne court : rien à mettre en pause')
  p.joue({ quoi: 'parier', manche: 0 }, MIDI + 600 * S)
  const etapes = p.etat.manches[0].etapes
  assert.equal(etapes.length, 2)
  assert.equal(etapes[1].ouverteLe, MIDI + 600 * S, 'la seconde étape part à « Parier »')
  p.joue(repondre(0, { pari: { choix: 3 } }), MIDI + 600 * S + pari)
  assert.equal(p.etat.manches[0].verdict?.naturel, 3)
  // Garder une heure après : rien n'a expiré.
  const g = new Partie(departDe('pari'))
  g.joue(ouvrir(0), MIDI)
  g.joue(repondre(0, { pari: { choix: 1 } }), MIDI + S)
  g.joue({ quoi: 'garder', manche: 0 }, MIDI + 3600 * S)
  // Ses étoiles gardées, au barème du code : deux depuis le calibrage du 25 octobre 2026.
  assert.deepEqual([g.etat.manches[0].verdict?.naturel, g.etat.manches[0].fin], [ETOILES_DU_PARI.garder, 'jugee'])
  // Laissé au choix, la partie close le lendemain : les étoiles gardées.
  const l = new Partie(departDe('pari'))
  l.joue(ouvrir(0), MIDI)
  l.joue(repondre(0, { pari: { choix: 1 } }), MIDI + S)
  l.joue({ quoi: 'clore', pourquoi: 'lendemain' }, MIDI + 86_400 * S)
  assert.deepEqual(resultatDe(l.depart, l.etat).naturel, [ETOILES_DU_PARI.garder, 0, 0])
  assert.equal(ETOILES_DU_PARI.garder, 2)
})

test('la Réplique : « Qui l’a dit ? » s’ouvre au mot choisi, ou à l’échéance du mot — le mot perdu, son chrono à elle', () => {
  const replique = DUREES_DES_JEUX.replique * S
  const d = departDe('replique')
  const t = d.tirages[0] as RepliqueTiree
  // Le mot choisi ouvre la seconde étape à son arrivée, avec ce qui reste de la pause.
  const p = new Partie(d)
  p.joue(ouvrir(0), MIDI)
  p.joue({ quoi: 'pause', manche: 0 }, MIDI + 2 * S)
  p.joue({ quoi: 'reprendre', manche: 0 }, MIDI + 12 * S)
  p.joue({ quoi: 'mot', manche: 0, choix: t.bonMot }, MIDI + 20 * S)
  const [, seconde] = p.etat.manches[0].etapes
  assert.equal(seconde.ouverteLe, MIDI + 20 * S)
  assert.equal(seconde.pauseDisponibleMs, PAUSE_MAX_MS - 10 * S)
  // Rien envoyé à l'échéance du mot : la réponse vide de la page, ou le geste suivant, ouvre « Qui l'a dit ? ».
  const q = new Partie(d)
  q.joue(ouvrir(0), MIDI)
  q.joue(repondre(0, undefined, true), MIDI + replique + 5 * S)
  const etapes = q.etat.manches[0].etapes
  assert.equal(etapes.length, 2, 'la manche continue : on ne perd pas la seconde question à cause de la première')
  assert.equal(etapes[1].ouverteLe, MIDI + replique + GRACE_D_UNE_MANCHE_MS, 'au dernier instant de la grâce du mot')
  q.joue(repondre(0, { replique: { qui: t.bonneQui } }), MIDI + replique + 10 * S)
  assert.equal(q.etat.manches[0].verdict?.naturel, 1, 'le mot perdu, la bonne personne : une étoile')
  // Les deux échéances passées sans un geste : quitter les juge l'une après l'autre.
  const r = new Partie(d)
  r.joue(ouvrir(0), MIDI)
  r.joue({ quoi: 'mot', manche: 0, choix: t.bonMot }, MIDI + S)
  r.joue({ quoi: 'quitter' }, MIDI + 10 * 60 * S)
  assert.equal(r.etat.manches[0].fin, 'expiree')
  // Expirée : le mot, le serveur l'avait — il compte encore, comme les essais du Mot mystère.
  assert.equal(r.etat.manches[0].verdict?.naturel, 2)
  assert.equal(r.etat.pieces[0].repondueLe, MIDI + S + replique + GRACE_D_UNE_MANCHE_MS)
})

test('« Prendre son temps » n’aide que s’il a servi : une réponse dans la durée normale reste nue', () => {
  const pari = DUREES_DES_JEUX.pari * S
  const enPlus = SECONDES_PAR_FORCE * S
  const jouer = (t: number) => {
    const p = new Partie(departDe('pari', { carte: carte('temps', 1, 'concentration') }))
    p.joue(ouvrir(0), MIDI)
    p.joue(repondre(0, { pari: { choix: 0 } }), MIDI + t)
    return p
  }
  const tot = jouer(pari - S)
  assert.equal(tot.etat.pieces[0].joker, null)
  assert.equal(tot.etat.pieces[0].piece.forme, undefined, 'nue : la carte emportée n’a pas servi')
  assert.equal(resultatDe(tot.depart, tot.etat).aidee, false)
  // La grâce vaut pour tout le monde : arrivée dedans, la réponse était partie à temps.
  assert.equal(jouer(pari + GRACE_D_UNE_MANCHE_MS).etat.pieces[0].joker, null)
  const tard = jouer(pari + GRACE_D_UNE_MANCHE_MS + S)
  assert.equal(tard.etat.manches[0].fin, 'jugee', 'dans le temps en plus')
  assert.equal(tard.etat.pieces[0].joker, JOKER_DU_TEMPS)
  assert.equal(tard.etat.pieces[0].piece.forme, 'pari', 'aidée, elle ne mesure pas')
  assert.equal(resultatDe(tard.depart, tard.etat).aidee, true)
  // Sans la carte, la même réponse serait arrivée trop tard.
  const sans = new Partie(departDe('pari'))
  sans.joue(ouvrir(0), MIDI)
  sans.joue(repondre(0, { pari: { choix: 0 } }), MIDI + pari + GRACE_D_UNE_MANCHE_MS + S)
  assert.equal(sans.etat.manches[0].fin, 'expiree')
  assert.equal(jouer(pari + enPlus + GRACE_D_UNE_MANCHE_MS + 1).etat.manches[0].fin, 'expiree', 'au-delà du temps en plus')
})

test('jamais l’horloge de la machine : ni dans les règles du Cabinet, ni dans son serveur', () => {
  // Une échéance se lit à l'heure du serveur (invariant 6) — `maintenant`, que le banc avance à la main.
  const lire = (dossier: URL): [string, string][] =>
    existsSync(dossier)
      ? readdirSync(dossier, { recursive: true, encoding: 'utf8' })
          .filter(f => f.endsWith('.ts'))
          .map(f => [f, readFileSync(new URL(f, dossier), 'utf8')])
      : []
  const regles = lire(new URL('../../shared/cabinet/', import.meta.url))
  assert.ok(regles.length >= 20, `${regles.length} fichiers relus`)
  for (const [f, code] of regles) assert.doesNotMatch(code, /Date\.now\(|new Date\(|performance\.now\(|Math\.random\(/, `shared/cabinet/${f}`)
  // Le serveur du Cabinet tire au hasard (le tirage), mais ne lit jamais l'horloge — ses routes non plus.
  for (const [f, code] of lire(new URL('../src/core/cabinet/', import.meta.url))) assert.doesNotMatch(code, /Date\.now\(|new Date\(\)/, `core/cabinet/${f}`)
  assert.doesNotMatch(readFileSync(new URL('../src/cabinet.ts', import.meta.url), 'utf8'), /Date\.now\(|new Date\(\)/, 'src/cabinet.ts')
})

test('par les routes : à l’heure, dans la grâce, la manche se juge sur ce qu’elle porte ; après, elle expire', async () => {
  const b = await bancDuCabinet()
  try {
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'eclair', carte: null }), 'commencer')
    assert.equal(v.chrono?.echeance, b.horloge.t + DUREES_DES_JEUX.eclair * S, 'l’échéance part de l’ouverture de la manche, à l’heure du serveur')
    // Au dernier instant de la grâce : jugée sur ses réponses.
    b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS
    v = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 0, reponse: { eclair: { reponses: vraiesDe(eclairDe(b, v.id, 0)) } } }), 'à l’heure')
    assert.deepEqual([v.manches[0].fin, v.manches[0].naturel], ['jugee', 3])
    // Un instant après : expirée, ce qu'elle portait ne compte pas.
    v = await ouvrirLaManche(b, lea, v, 1)
    b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
    v = ok(await jouer(b, lea, v, { quoi: 'repondre', manche: 1, reponse: { eclair: { reponses: vraiesDe(eclairDe(b, v.id, 1)) } } }), 'en retard')
    assert.deepEqual([v.manches[1].fin, v.manches[1].naturel], ['expiree', 0])
    // Et un geste qui n'est pas une réponse, arrivé trop tard, se refuse en mots.
    v = await ouvrirLaManche(b, lea, v, 2)
    b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
    assert.deepEqual(await jouer(b, lea, v, { quoi: 'pause', manche: 2 }).then(r => [r.status, r.corps]), [400, { error: 'Le temps de cette manche est écoulé' }])
  } finally {
    await b.banc.close()
  }
})

test('la première manche s’ouvre une fois le plan tiré : ni le verrou, ni le lot froid, ni la base de la campagne ne mangent son chrono', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'chrono.db'), horloge)
  // La base de la campagne qui se lit au premier départ d'un réveil : vingt secondes au dixième de cœur, avant le tirage.
  const porte = m.campagne.porte()
  const jouables = porte.jouables
  porte.jouables = async () => {
    const j = await jouables()
    horloge.t += 20 * S
    return j
  }
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null })
  const v = vueDeLaPartie(p)
  assert.equal(v.chrono?.echeance, DIX_HEURES + 20 * S + DUREES_DES_JEUX.eclair * S, 'le chrono part de l’ouverture, le plan tiré')
  assert.equal(v.chrono!.echeance - v.maintenant, v.chrono!.dureeMs, 'toute la manche devant lui à la réponse')
  // La partie date de l'arrivée de la requête : son jour, sa ligne, le recompte du jour.
  assert.equal(enBase(m.fichier, db => (db.prepare('SELECT commencee_le AS t FROM campagne_series WHERE id = ?').get(p.id) as { t: number }).t), DIX_HEURES)
  // L'ouverture s'écrit à son heure : relue par l'autre serveur, la même échéance.
  porte.jouables = jouables
  const autre = await magasinDEssai(m.fichier, horloge)
  const page = await autre.cabinet.page('qui')
  assert.equal(page.enCours && vueDeLaPartie(page.enCours).chrono?.echeance, v.chrono?.echeance)
})

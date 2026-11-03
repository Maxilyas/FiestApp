// Les périodes du QG 2 (`shared/qgPeriodes.ts`, la proposition du 3 novembre
// 2026 que le propriétaire a faite sienne le 4) : une barre règle le temps de
// toute la page — une heure, 24 heures, sept jours, trente —, chaque période
// ses seaux, ses totaux, et la période d'avant arrêtée au même instant. Des
// dérivations pures, l'horloge à la main.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODES_DU_QG, minuitsDeParis, participationsParJour, participationsParSeau, JOURS_DU_QG, type PartieDesParticipations } from '../../shared/qg'
import { PAS_DE_LA_PERIODE, activiteDeLaPeriode, cadreDeLaPeriode, ecartALaPeriodeDAvant, totauxEntre } from '../../shared/qgPeriodes'
import { minutesDeParis } from '../../shared/jour'

const MIN = 60_000
const H = 60 * MIN

test('la participation d’un jour est celle d’un seau qui commence à son minuit : les trente jours ne changent pas', () => {
  const maintenant = Date.UTC(2026, 10, 3, 21, 41)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const solo: PartieDesParticipations[] = [
    { quand: minuits[29] + 2 * H, qui: 'lea', mode: 'jour' },
    { quand: minuits[29] + 3 * H, qui: 'lea', mode: 'campagne' },
    { quand: minuits[28] + 20 * H, qui: 'hugo', mode: 'duel' },
  ]
  const soirees = [{ quand: minuits[29] + 20 * H, joueurs: 5, profils: ['lea'] }]
  const jours = participationsParJour(solo, soirees, minuits, maintenant)
  const seaux = participationsParSeau(solo, soirees, minuits, maintenant)
  assert.equal(jours.length, 30)
  jours.forEach((j, i) => assert.deepEqual({ joueurs: j.joueurs, modes: j.modes, parties: j.parties }, { joueurs: seaux[i].joueurs, modes: seaux[i].modes, parties: seaux[i].parties }))
  assert.deepEqual(seaux.map(s => s.debut), minuits)
  // Léa : une personne aujourd'hui, à trois modes ; quatre invités sans profil de plus, une fois chacun.
  assert.equal(jours[29].joueurs, 5)
  assert.deepEqual(jours[29].parties, { soiree: 5, campagne: 1, cabinet: 0, jour: 1, duel: 0 })
})

test('les seaux de chaque période : cinq minutes sur une heure, une heure sur 24, trois heures depuis chaque minuit sur sept jours, un jour sur trente', () => {
  const maintenant = Date.UTC(2026, 10, 3, 21, 41, 30)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)

  const uneHeure = cadreDeLaPeriode('1h', minuits, maintenant)
  assert.equal(uneHeure.debuts.length, 12)
  assert.ok(uneHeure.debuts.every((d, i) => i === 0 || d - uneHeure.debuts[i - 1] === 5 * MIN))
  assert.ok(uneHeure.debuts[11] <= maintenant && maintenant < uneHeure.debuts[11] + 5 * MIN, 'le dernier seau contient maintenant')
  assert.deepEqual(uneHeure.avant, { debuts: uneHeure.debuts.map(d => d - H), fin: maintenant - H })

  const unJour = cadreDeLaPeriode('24h', minuits, maintenant)
  assert.equal(unJour.debuts.length, 24)
  assert.equal(unJour.avant?.fin, maintenant - 24 * H)

  // Sept jours de Paris : trois heures depuis chaque minuit — la semaine du passage à l'heure d'hiver a un jour de vingt-cinq heures.
  const semaine = cadreDeLaPeriode('7j', minuits, maintenant)
  assert.equal(semaine.debuts[0], minuits[23])
  assert.ok(semaine.debuts.every(d => (minutesDeParis(d) % 180) === 0), 'chaque seau commence à 0 h, 3 h, 6 h… de Paris')
  // Aujourd'hui, à 22 h 41 de Paris : 0 h, 3 h … 21 h — huit seaux.
  assert.equal(semaine.debuts.filter(d => d >= minuits[29]).length, 8)
  const avant = semaine.avant
  assert.ok(avant)
  assert.equal(avant.debuts[0], minuits[16])
  assert.equal(avant.fin, maintenant - (minuits[29] - minuits[22]), 'la semaine d’avant s’arrête au même instant de la semaine')

  const trente = cadreDeLaPeriode('30j', minuits, maintenant)
  assert.deepEqual(trente.debuts, minuits)
  assert.equal(trente.avant, null, 'trente jours gardés ne disent pas le mois d’avant')
})

test('le jour de vingt-cinq heures (25 octobre 2026) a neuf seaux de trois heures', () => {
  const maintenant = Date.UTC(2026, 9, 27, 12)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const semaine = cadreDeLaPeriode('7j', minuits, maintenant)
  const le25 = minuits.findIndex(m => new Date(m + 12 * H).getUTCDate() === 25)
  const duJour = semaine.debuts.filter(d => d >= minuits[le25] && d < minuits[le25 + 1])
  assert.equal(minuits[le25 + 1] - minuits[le25], 25 * H)
  assert.equal(duJour.length, 9)
})

test('une période compte chaque personne une fois, chaque partie, et la période d’avant arrêtée au même instant', () => {
  const maintenant = Date.UTC(2026, 10, 3, 21, 41)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const solo: PartieDesParticipations[] = [
    // Léa joue deux fois dans l'heure : une joueuse, deux participations.
    { quand: maintenant - 10 * MIN, qui: 'lea', mode: 'jour' },
    { quand: maintenant - 5 * MIN, qui: 'lea', mode: 'cabinet' },
    // Hier à la même heure : la période d'avant de « 24 h ».
    { quand: maintenant - 25 * H, qui: 'hugo', mode: 'campagne' },
    // Hier, mais après le même instant : elle ne compte pas dans la période d'avant.
    { quand: maintenant - 24 * H + 10 * MIN, qui: 'ines', mode: 'duel' },
  ]
  const soirees = [{ quand: maintenant - 2 * H, joueurs: 6, profils: ['lea', 'theo'] }]
  const faits = { inscriptions: [maintenant - 3 * H, maintenant - 30 * H], achats: [maintenant - 30 * MIN] }

  const heure = activiteDeLaPeriode('1h', solo, soirees, faits, minuits, maintenant)
  assert.equal(heure.pas, PAS_DE_LA_PERIODE['1h'])
  assert.equal(heure.seaux.length, 12)
  assert.equal(heure.totaux.joueurs, 1)
  assert.deepEqual([heure.totaux.parties.jour, heure.totaux.parties.cabinet, heure.totaux.modes.cabinet], [1, 1, 1])
  assert.deepEqual([heure.totaux.nouveauxProfils, heure.totaux.achats], [0, 1])

  const jour = activiteDeLaPeriode('24h', solo, soirees, faits, minuits, maintenant)
  // Léa (elle était aussi à la soirée), Théo, et quatre invités sans profil.
  assert.equal(jour.totaux.joueurs, 6)
  assert.equal(jour.totaux.modes.soiree, 6)
  assert.equal(jour.totaux.parties.soiree, 6)
  assert.equal(jour.totaux.nouveauxProfils, 1)
  assert.ok(jour.avant)
  assert.equal(jour.avant.totaux.joueurs, 1, 'Hugo seul : Inès a joué après le même instant')
  assert.equal(jour.avant.totaux.nouveauxProfils, 1)
  assert.equal(jour.avant.seaux.length, 24)
  assert.equal(activiteDeLaPeriode('30j', solo, soirees, faits, minuits, maintenant).avant, null)
  // Les totaux se comptent sur toute la période, jamais en additionnant les seaux.
  // Léa, Hugo, Inès, Théo, et les quatre invités sans profil de la soirée.
  assert.equal(totauxEntre(solo, soirees, faits, minuits[0], maintenant).joueurs, 8)
  for (const m of MODES_DU_QG) assert.ok(jour.totaux.modes[m] <= jour.totaux.joueurs)
})

test('l’écart à la période d’avant : un pourcentage dès vingt, le chiffre d’avant en dessous', () => {
  assert.equal(ecartALaPeriodeDAvant(10, null), null)
  assert.deepEqual(ecartALaPeriodeDAvant(3, 2), { sens: null, texte: '2 avant', suite: '' })
  assert.deepEqual(ecartALaPeriodeDAvant(7, 7), { sens: null, texte: 'comme avant', suite: '' })
  assert.deepEqual(ecartALaPeriodeDAvant(30, 24), { sens: 'plus', texte: '25 %', suite: ' de plus que la période d’avant' })
  assert.deepEqual(ecartALaPeriodeDAvant(18, 24), { sens: 'moins', texte: '25 %', suite: ' de moins que la période d’avant' })
  assert.deepEqual(ecartALaPeriodeDAvant(24, 24), { sens: null, texte: 'comme avant', suite: '' })
})

// Les périodes du QG 2 (`shared/qgPeriodes.ts`, la proposition du 3 novembre
// 2026 que le propriétaire a faite sienne le 4) : une barre règle le temps de
// toute la page — une heure, 24 heures, sept jours, trente —, chaque période
// ses seaux, ses totaux, et la période d'avant arrêtée au même instant. Des
// dérivations pures, l'horloge à la main.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODES_DU_QG, minuitsDeParis, participationsParJour, participationsParSeau, JOURS_DU_QG, type ModeDuQg, type PartieDesParticipations } from '../../shared/qg'
import {
  PAS_DE_LA_PERIODE,
  PAS_D_UNE_SEMAINE,
  PAS_D_UN_MOIS,
  activiteDeLHistorique,
  activiteDeLaPeriode,
  cadreDeLaPeriode,
  ecartALaPeriodeDAvant,
  historiqueDeLaMemoire,
  joursDesJournaux,
  pasEnMots,
  seauxDeLHistorique,
  totauxEntre,
  type JourDeLHistorique,
} from '../../shared/qgPeriodes'
import { BIT_DU_MODE, joursDeLaMemoire, minuitDuJour, type ChiffresDUnJour } from '../../shared/qgJoueurs'
import { dUneTraite } from '../../shared/tranches'
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

// ── Tout l'historique (le 24 novembre 2026 : « une vue totale ») ──────────────

const J = 24 * H
const zeros = (): Record<ModeDuQg, number> => ({ soiree: 0, campagne: 0, cabinet: 0, jour: 0, duel: 0 })

test('tout l’historique : un seau par jour jusqu’à soixante, puis par semaine depuis le lundi, puis par mois', () => {
  assert.deepEqual(seauxDeLHistorique('2026-11-04', '2026-11-04'), { debuts: ['2026-11-04'], pas: J })
  // Du 6 septembre au 4 novembre : soixante jours, un seau chacun.
  const jours = seauxDeLHistorique('2026-09-06', '2026-11-04')
  assert.deepEqual([jours.debuts.length, jours.debuts[0], jours.debuts.at(-1), jours.pas], [60, '2026-09-06', '2026-11-04', J])
  // Un de plus : des semaines, depuis le lundi de la première — le samedi 5 septembre est dans celle du 31 août.
  const semaines = seauxDeLHistorique('2026-09-05', '2026-11-04')
  assert.deepEqual([semaines.debuts.length, semaines.debuts[0], semaines.debuts.at(-1), semaines.pas], [10, '2026-08-31', '2026-11-02', PAS_D_UNE_SEMAINE])
  // Plus de soixante semaines : des mois du calendrier, le passage de l'année compris.
  const mois = seauxDeLHistorique('2025-08-15', '2026-11-04')
  assert.equal(mois.pas, PAS_D_UN_MOIS)
  assert.equal(mois.debuts.length, 16)
  assert.deepEqual(mois.debuts.slice(3, 6), ['2025-11-01', '2025-12-01', '2026-01-01'])
  assert.equal(mois.debuts.at(-1), '2026-11-01')
  // Le pas en mots suit la longueur ; les autres périodes gardent le leur.
  assert.deepEqual([pasEnMots('tout', J).titre, pasEnMots('tout', PAS_D_UNE_SEMAINE).titre, pasEnMots('tout', PAS_D_UN_MOIS).titre], ['Jour par jour', 'Semaine par semaine', 'Mois par mois'])
  assert.equal(pasEnMots('24h', J).titre, 'Heure par heure')
})

test('tout l’historique compte une personne une fois sur plusieurs jours, ses invités sans profil à chaque soirée', () => {
  const maintenant = Date.UTC(2026, 10, 4, 20) // mercredi 4 novembre 2026, 21 h de Paris
  const jour = (j: string, x: Partial<JourDeLHistorique>, profils: [string, number][] = []): JourDeLHistorique => ({
    jour: j,
    joueurs: 0,
    modes: zeros(),
    parties: zeros(),
    nouveauxProfils: 0,
    achats: 0,
    ...x,
    profils: new Map(profils),
  })
  const a = activiteDeLHistorique(
    [
      // Rien encore : l'historique commence au premier jour qui a vu quelque chose.
      jour('2026-08-01', {}),
      // Léa au quiz du jour deux jours de suite, la même semaine ; le second, à une soirée avec quatre invités sans profil.
      jour('2026-08-03', { joueurs: 1, modes: { ...zeros(), jour: 1 }, parties: { ...zeros(), jour: 1 }, nouveauxProfils: 2 }, [['lea', BIT_DU_MODE.jour]]),
      jour('2026-08-04', { joueurs: 5, modes: { ...zeros(), jour: 1, soiree: 5 }, parties: { ...zeros(), jour: 1, soiree: 5 } }, [['lea', BIT_DU_MODE.jour | BIT_DU_MODE.soiree]]),
      // Un profil supprimé depuis : ses chiffres le comptent encore, sa feuille l'a oublié.
      jour('2026-09-15', { joueurs: 2, modes: { ...zeros(), duel: 2 }, parties: { ...zeros(), duel: 3 }, achats: 1 }, [['hugo', BIT_DU_MODE.duel]]),
      // Aujourd'hui, Léa de nouveau.
      jour('2026-11-04', { joueurs: 1, modes: { ...zeros(), campagne: 1 }, parties: { ...zeros(), campagne: 2 } }, [['lea', BIT_DU_MODE.campagne]]),
      // Demain ne compte pas.
      jour('2026-11-05', { joueurs: 9, parties: { ...zeros(), jour: 9 } }, [['zoe', BIT_DU_MODE.jour]]),
    ],
    maintenant,
  )
  assert.deepEqual([a.periode, a.avant, a.depuis], ['tout', null, minuitDuJour('2026-08-03')])
  // Du lundi 3 août au mercredi 4 novembre : quatre-vingt-quatorze jours, quatorze semaines.
  assert.equal(a.pas, PAS_D_UNE_SEMAINE)
  assert.deepEqual(
    a.seaux.map(s => s.debut),
    Array.from({ length: 14 }, (_, i) => minuitDuJour(new Date(Date.UTC(2026, 7, 3 + 7 * i, 12)).toISOString().slice(0, 10))),
  )
  // Sa première semaine : Léa une fois, et les quatre invités de la soirée.
  assert.deepEqual(a.seaux[0], { debut: minuitDuJour('2026-08-03'), joueurs: 5, modes: { ...zeros(), jour: 1, soiree: 5 }, parties: { ...zeros(), jour: 2, soiree: 5 } })
  // La semaine de Hugo : lui, et le profil supprimé, une personne pour son jour.
  assert.deepEqual(a.seaux[6], { debut: minuitDuJour('2026-09-14'), joueurs: 2, modes: { ...zeros(), duel: 2 }, parties: { ...zeros(), duel: 3 } })
  assert.equal(a.seaux.at(-1)?.joueurs, 1, 'cette semaine : Léa, pas Zoé, qui joue demain')
  // Tout l'historique : Léa et Hugo une fois chacun, les quatre invités, le profil supprimé — sept, quand les semaines en additionnent huit.
  assert.deepEqual(a.totaux, {
    joueurs: 7,
    modes: { soiree: 5, campagne: 1, cabinet: 0, jour: 1, duel: 2 },
    parties: { soiree: 5, campagne: 2, cabinet: 0, jour: 2, duel: 3 },
    nouveauxProfils: 2,
    achats: 1,
  })
  assert.equal(
    a.seaux.reduce((n, s) => n + s.joueurs, 0),
    8,
  )
  // Rien encore nulle part : aujourd'hui seul, vide.
  const vide = activiteDeLHistorique([], maintenant)
  assert.deepEqual([vide.seaux.length, vide.totaux.joueurs, vide.depuis], [1, 0, minuitDuJour('2026-11-04')])
})

test('sans mémoire, tout l’historique dit ce que disent les trente jours, depuis le premier jour qui a vu quelque chose', () => {
  const maintenant = Date.UTC(2026, 10, 3, 21, 41)
  const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
  const solo: PartieDesParticipations[] = [
    { quand: minuits[10] + 9 * H, qui: 'lea', mode: 'jour' },
    { quand: minuits[11] + 9 * H, qui: 'lea', mode: 'cabinet' },
    { quand: maintenant - 25 * H, qui: 'hugo', mode: 'campagne' },
    { quand: maintenant - 5 * MIN, qui: 'ines', mode: 'duel' },
    // Avant les trente jours, ou après maintenant : hors de tout.
    { quand: minuits[0] - H, qui: 'max', mode: 'jour' },
    { quand: maintenant + MIN, qui: 'max', mode: 'jour' },
  ]
  const soirees = [{ quand: maintenant - 2 * H, joueurs: 6, profils: ['lea', 'theo'] }, { quand: minuits[11] + 20 * H, joueurs: 3 }]
  const faits = { inscriptions: [minuits[10] + 8 * H, maintenant - 3 * H], achats: [maintenant - 30 * MIN] }
  const trente = activiteDeLaPeriode('30j', solo, soirees, faits, minuits, maintenant)
  const tout = activiteDeLHistorique(joursDesJournaux(solo, soirees, faits, minuits, maintenant), maintenant)
  const { finies: _, ...sansLesFinies } = trente.totaux
  assert.deepEqual(tout.totaux, sansLesFinies)
  assert.equal(tout.depuis, minuits[10])
  assert.deepEqual(tout.seaux, trente.seaux.slice(10), 'jour par jour, les mêmes seaux depuis le premier')
})

test('un jour de la mémoire se lit comme le même jour des journaux', () => {
  const jour = '2026-11-03'
  const minuit = minuitDuJour(jour)
  const fin = minuitDuJour('2026-11-04')
  const a = (heure: number) => minuit + heure * H
  const solo: PartieDesParticipations[] = [
    { quand: a(9), qui: 'lea', mode: 'jour' },
    { quand: a(21), qui: 'lea', mode: 'campagne' },
    { quand: a(10), qui: 'bob', mode: 'duel' },
  ]
  const soirees = [
    { quand: a(20), joueurs: 6, profils: ['lea', 'theo'] },
    { quand: a(22), joueurs: 2 },
  ]
  const journaux = { solo, soireesDesProfils: [], soirees, inscriptions: [a(8)], achats: [a(12), a(13)] }
  const [ecrit] = dUneTraite(joursDeLaMemoire(journaux, [minuit], fin))
  const [deLaMemoire] = historiqueDeLaMemoire(new Map([[jour, ecrit.chiffres]]), ecrit.presences)
  const [desJournaux] = joursDesJournaux(solo, soirees, journaux, [minuit], fin - 1)
  assert.deepEqual(deLaMemoire, desJournaux)
  assert.equal(deLaMemoire.joueurs, 2 + 1 + 4 + 2, 'Léa, Bob, Théo, et six invités sans profil')

  // Une ligne d'avant le Cabinet, ou illisible par endroits : ce qu'elle ne dit pas compte zéro.
  const ancienne = { ...ecrit.chiffres, modes: { soiree: 1, jour: 2 }, achats: 'beaucoup' } as unknown as ChiffresDUnJour
  const [lue] = historiqueDeLaMemoire(new Map([[jour, ancienne]]), [])
  assert.deepEqual([lue.modes, lue.achats, lue.profils.size], [{ soiree: 1, campagne: 0, cabinet: 0, jour: 2, duel: 0 }, 0, 0])
})

test('l’écart à la période d’avant : un pourcentage dès vingt, le chiffre d’avant en dessous', () => {
  assert.equal(ecartALaPeriodeDAvant(10, null), null)
  assert.deepEqual(ecartALaPeriodeDAvant(3, 2), { sens: null, texte: '2 avant', suite: '' })
  assert.deepEqual(ecartALaPeriodeDAvant(7, 7), { sens: null, texte: 'comme avant', suite: '' })
  assert.deepEqual(ecartALaPeriodeDAvant(30, 24), { sens: 'plus', texte: '25 %', suite: ' de plus que la période d’avant' })
  assert.deepEqual(ecartALaPeriodeDAvant(18, 24), { sens: 'moins', texte: '25 %', suite: ' de moins que la période d’avant' })
  assert.deepEqual(ecartALaPeriodeDAvant(24, 24), { sens: null, texte: 'comme avant', suite: '' })
})

// Le lot equilibre-2 (le 26 octobre 2026) : « une partie ne compte que ce qu'il a répondu » —
// la poussière minimale (`POUSSIERE_MIN`), le jour de série et la manche que Protéger relève
// demandent une pièce répondue (`pieceRepondue` : `choix !== null`). « Quittée, ou laissée au chrono
// sans rien envoyer, elle n'en a pas » (`shared/cabinet/partie.ts`).
//
// Au Filet, la page envoie d'elle-même, à l'échéance, le curseur là où il est — au milieu, moyen,
// s'il n'y a pas touché (`FILET.aLEcheance`, `aEnvoyerALEcheance`, `client/src/views/cabinet/`) :
// ce lancer que le joueur n'a jamais fait a un `choix` (−1 à côté), la manche est « répondue », et la
// partie paie la poussière minimale et la protection à qui n'a rien touché. Laissée au chrono la page
// fermée, la même manche se juge « Pas de lancer » (le pli joue la réponse vide) : rien. Ce que la
// partie rapporte dépend de l'écran resté ouvert, pas de ce que le joueur a fait.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/page-filet-sans-geste-repondu.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MIDI, Partie as PartieAuPli, S, carte, departDe, ouvrir, qcm } from '../../../server/test/cabinet-plans'
import { vueDeLaPartie } from '../../../server/src/core/cabinet/vue'
import { GRACE_D_UNE_MANCHE_MS, POUSSIERE_MIN } from '../../../shared/cabinet/bareme'
import { bilanDe, etoilesDesManches, laPartieARepondu, type DepartDUnePartie } from '../../../shared/cabinet/partie'
import type { FiletTire } from '../../../shared/cabinet/jeux/filet'

Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

/** Une année au dixième de sa piste : le milieu, où le curseur part, ne la prend pas. */
const filet = (k: number): FiletTire => ({
  jeu: 'filet',
  question: qcm(`f${k}`, 0, { texte: 'En quelle année ?', reponses: ['1810', '1800', '1900', '1950'] }),
  valeur: 1810,
  annee: true,
  piste: { min: 1800, max: 1900, pas: 1 },
})

const depart = (): DepartDUnePartie =>
  departDe('filet', { origine: 'chasse', cible: 'lecon', but: 'gagner', seuil: 5, carte: carte('proteger', 1, 'prudence'), tirages: [filet(0), filet(1), filet(2)] })

test('Filet laissé sans un geste, la page ouverte : la manche compte « répondue », poussière et Protéger payés', async () => {
  const { aEnvoyerALEcheance } = await import(new URL('../../../client/src/views/cabinet/Partie.tsx', import.meta.url).href)
  const { FILET } = await import(new URL('../../../client/src/views/cabinet/jeux/Filet.tsx', import.meta.url).href)

  // La page ouverte : elle envoie d'elle-même, à l'échéance, ce qu'elle tient — rien de touché.
  const d = depart()
  const ouverte = new PartieAuPli(d)
  ouverte.joue(ouvrir(0), MIDI)
  const vue = vueDeLaPartie({ id: 'serie-essai', profileId: 'essai', depart: d, gestes: ouverte.gestes, etat: ouverte.etat, bilan: null, lueA: MIDI + S })
  const envoi = aEnvoyerALEcheance(vue, MIDI + S, FILET)
  assert.ok(envoi, 'la page prévoit un envoi à l’échéance')
  const geste = envoi.geste(FILET.localDe(vue.enCours))
  assert.deepEqual(geste, { quoi: 'repondre', manche: 0, auto: true, reponse: { filet: { x: 1850, taille: 'moyen' } } }, 'le curseur jamais touché part comme un lancer')
  ouverte.joue(geste, MIDI + S + envoi.dans)
  ouverte.joue({ quoi: 'quitter' }, MIDI + S + envoi.dans + 2 * S)
  const parLaPage = bilanDe(d, ouverte.etat, { possedee: false, doree: false })

  // La page fermée (un téléphone endormi) : le pli juge la manche expirée lui-même, par la réponse vide.
  const fermee = new PartieAuPli(d)
  fermee.joue(ouvrir(0), MIDI)
  fermee.joue({ quoi: 'quitter' }, MIDI + S + envoi.dans + GRACE_D_UNE_MANCHE_MS + 2 * S)
  const parLePli = bilanDe(d, fermee.etat, { possedee: false, doree: false })
  assert.deepEqual([parLePli.total, parLePli.poussiere, laPartieARepondu(fermee.etat)], [0, 0, false], 'page fermée : rien, comme la règle le veut')

  // Le même joueur, qui n'a rien touché : la page ouverte lui fait gagner ce que la règle réserve à qui répond.
  const protegee = etoilesDesManches(d, ouverte.etat).some(m => m.protegee)
  assert.deepEqual(
    { repondue: laPartieARepondu(ouverte.etat), protegee, total: parLaPage.total, poussiere: parLaPage.poussiere },
    { repondue: false, protegee: false, total: 0, poussiere: 0 },
    `page ouverte, sans un geste : une manche « répondue », Protéger appliqué et ${POUSSIERE_MIN} poussières au moins`,
  )
})

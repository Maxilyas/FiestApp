// La confirmation de « Quitter ? » (`messageDuQuitter`, `client/src/views/cabinet/Partie.tsx`) dit
// « Protéger compris » dès que le total de la partie quittée dépasse celui qu'elle a déjà
// (`ceQuOnEmporte` : « la manche quittée relevée »). Depuis le lot equilibre-2 (le 26 octobre 2026),
// une manche quittée ne se relève plus (`relevable`, `shared/cabinet/partie.ts`) : le seul cas où
// quitter ajoute des étoiles est le Pari laissé au choix — ses deux étoiles gardées, sans Protéger.
// La phrase de la page dit alors le contraire de ce que le bilan compte.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/page-quitter-protege.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MIDI, Partie as PartieAuPli, S, carte, departDe, ouvrir } from '../../../server/test/cabinet-plans'
import { vueDeLaPartie } from '../../../server/src/core/cabinet/vue'
import { bilanDe, etoilesDesManches } from '../../../shared/cabinet/partie'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import (comme `cabinet-ecran.test.ts`).
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

test('« Quitter ? » au choix du Pari, sous Prudence : la page dit « Protéger compris », le bilan ne protège rien', async () => {
  const { messageDuQuitter } = await import(new URL('../../../client/src/views/cabinet/Partie.tsx', import.meta.url).href)
  // Une chasse au Pari, la carte-bonus Prudence (Protéger, force 1).
  const d = departDe('pari', { origine: 'chasse', cible: 'lecon', but: 'gagner', seuil: 5, carte: carte('proteger', 1, 'prudence') })
  const p = new PartieAuPli(d)
  p.joue(ouvrir(0), MIDI)
  // Juste à la première question : le choix « Garder ★★ / Parier → ★★★ », aucun chrono ne court.
  p.joue({ quoi: 'repondre', manche: 0, reponse: { pari: { choix: 1 } } }, MIDI + 5 * S)
  const vue = vueDeLaPartie({ id: 'serie-essai', profileId: 'essai', depart: d, gestes: p.gestes, etat: p.etat, bilan: null, lueA: MIDI + 6 * S })
  assert.equal(vue.phase, 'jouer')
  assert.equal(vue.chrono, undefined, 'au choix, pas de chrono : « Quitter » ouvre la confirmation sans pause')
  assert.deepEqual([vue.total, vue.siTuQuittes], [0, { total: 2, poussiere: 4 }], 'le serveur compte les deux étoiles gardées')

  // Ce que la page affiche dans la confirmation.
  const { message } = messageDuQuitter(vue) as { message: string }

  // Ce que la partie quittée vaut vraiment : le bilan et les manches du pli.
  p.joue({ quoi: 'quitter' }, MIDI + 7 * S)
  const manches = etoilesDesManches(d, p.etat)
  const bilan = bilanDe(d, p.etat, { possedee: false, doree: false })
  assert.equal(bilan.total, 2, 'deux étoiles : celles gardées au Pari')
  assert.equal(manches.some(m => m.protegee), false, 'aucune manche relevée par Protéger : la manche quittée ne se relève plus')

  // La page ne doit pas promettre une protection que le pli n'applique pas.
  assert.doesNotMatch(message, /Protéger/, `la confirmation dit : « ${message} »`)
})

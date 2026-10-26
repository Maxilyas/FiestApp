// Régression (relecture sceptique du 26 octobre 2026, angle serveur) : une
// manche du Détail montre au téléphone ses quatre titres AVEC leur peintre
// (`REGLE_DU_DETAIL.montrer`, shared/cabinet/jeux/detail.ts:271), dès son
// ouverture. Chaque titre est la réponse de la question de la base « Qui a
// peint « … » ? » de son tableau (`TableauDuDetail.questions`). Le lot
// detail-et-vues a fait compter vues pour toute la campagne « ce qu'une pièce
// a montré de la base » (decisions.md, « Un seul préfixe… ») — mais le journal
// ne déplie que le BON tableau (`questionsMontrees`,
// server/src/core/journalDesReponses.ts:282) : les trois leurres, montrés avec
// leur peintre, restent « jamais vus » pour la série, le dé et le duel classé.
// Une partie libre du Détail, illimitée, souffle neuf « Qui a peint… ? » que le
// duel pose ensuite comme neuves (l'invariant 8, l'axe 9 de la tablée).
//
// Lancer : cd /home/user/FiestApp/server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/serveur-detail-leurres-vus.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DIX_HEURES, dossierDEssai, fermerLesMagasins, magasinDEssai } from '../../../server/test/cabinet-banc'
import { tableauxDuDetail } from '../../../server/src/core/details'
import { REGLES } from '../../../shared/cabinet/jeux/index'
import type { DetailTire } from '../../../shared/cabinet/jeux/detail'

after(fermerLesMagasins)

test('les trois leurres d’une manche du Détail, montrés avec leur peintre, comptent vus comme le bon', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'detail-leurres.db'), horloge)
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: null })
  const t = p.depart.tirages[0] as DetailTire
  // Ce que le téléphone reçoit dès l'ouverture : les quatre titres, chacun avec son peintre.
  const montre = REGLES.detail.montrer(t, p.etat.manches[0].etat as never) as { titres: { titre: string; peintre: string }[] }
  assert.equal(montre.titres.length, 4)
  assert.ok(montre.titres.every(x => x.peintre.length > 0), 'chaque titre part avec son peintre')
  // Il répond n'importe quoi : la révélation redit les quatre, et le bon.
  const r = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'repondre', manche: 0, reponse: { detail: { titre: (t.bonne + 1) % 4 } } })
  assert.ok('partie' in r, JSON.stringify(r))

  const leurres = t.titres.filter((_, i) => i !== t.bonne)
  const questionsDesLeurres = leurres.flatMap(l => tableauxDuDetail().find(x => x.titre === l.titre && x.peintre === l.peintre)?.questions ?? [])
  assert.ok(questionsDesLeurres.length >= 3, 'chaque leurre a sa question « Qui a peint… ? » dans la base')

  const { journal } = await m.campagne.porte().lireAvecLeJournal([])
  const { vues } = journal.vuesDe('qui')
  assert.deepEqual(
    questionsDesLeurres.filter(id => !vues.has(id)),
    [],
    'les « Qui a peint… ? » des leurres, dont le téléphone a lu la réponse, restent « jamais vues » pour toute la campagne',
  )
})

test('« Changer » au Détail : la manche montrée puis remplacée — quatre titres et leurs peintres — ne laisse aucune trace de ce qu’elle a montré', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'detail-change.db'), horloge)
  // « Échange », une des quatre œuvres de départ : Changer.
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: 'echange' })
  assert.equal(p.depart.carte?.pouvoir, 'changer')
  const montree = p.depart.tirages[0] as DetailTire
  const r = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'changer', manche: 0 })
  assert.ok('partie' in r, JSON.stringify(r))
  const fin = await m.cabinet.geste('qui', p.id, r.partie.etat.rang, { quoi: 'quitter' })
  assert.ok('partie' in fin, JSON.stringify(fin))
  const questions = montree.titres.flatMap(l => tableauxDuDetail().find(x => x.titre === l.titre && x.peintre === l.peintre)?.questions ?? [])
  const { journal } = await m.campagne.porte().lireAvecLeJournal([])
  const { vues } = journal.vuesDe('qui')
  assert.deepEqual(
    questions.filter(id => !vues.has(id)),
    [],
    'les quatre « Qui a peint… ? » de la manche changée, lues à l’écran, restent « jamais vues » — au Cabinet comme ailleurs',
  )
})

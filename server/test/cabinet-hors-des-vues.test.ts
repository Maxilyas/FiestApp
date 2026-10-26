// Ce que le Cabinet révèle de la base ne revient plus « jamais vu » au reste de
// la campagne (la tablée du 25 octobre 2026, axe 9, `cabinet-triche-3`).
//
// Une manche de l'Éclair pose cinq questions de la base, et sa révélation dit
// la bonne réponse de chacune ; une manche du Détail nomme son tableau, son
// peintre et son année — ce que demandent les questions de la base qui le
// nomment ; une frise d'un sujet date ses nouveaux venus, l'année de leurs
// questions. Leurs pièces s'écrivent sous un composé (`cab:eclair:<id>+…`,
// `cab:tableau:<QID>`, `cab:frise:s:<id>+…`), que le Cabinet dépliait pour sa
// seule fraîcheur : la série, l'épreuve, le dé et le duel classé — qui tire ce
// que ni l'un ni l'autre n'a vu — les tenaient pour jamais vues. Une partie
// libre de l'Éclair, illimitée, en révélait quinze que le duel posait ensuite
// comme neuves (l'invariant 8 : rien ne sort du Cabinet).
//
// Le journal des réponses les déplie donc pour les vues (`vuesDe`) — jamais
// pour les premières réponses : une manche de l'Éclair n'est la première
// réponse d'aucune de ses questions, et la mesure, le modèle du savoir, les
// sentiers ne lisent que celles qu'il a données lui-même.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DIX_HEURES, dossierDEssai, enBase, fermerLesMagasins, magasinDEssai, piecesALaMain, type MagasinDEssai } from './cabinet-banc'
import { tableauxDuDetail } from '../src/core/details'
import type { CampagneStore } from '../src/core/campagne'
import { mursDe } from '../src/core/cabinet/vue'
import { REGLES } from '../../shared/cabinet/jeux/index'
import type { EclairRevele, EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { DetailTire } from '../../shared/cabinet/jeux/detail'
import type { EpingleTiree } from '../../shared/cabinet/jeux/epingle'
import type { PariTire } from '../../shared/cabinet/jeux/pari'
import { idDeLEclair, idDeLaFriseDeSujet, idDuLieu, idDuTableau } from '../../shared/cabinet/pieces'

after(fermerLesMagasins)

/** Ce que la campagne sait qu'il a vu, et ses premières réponses : le journal rattrapé, comme chaque tirage le lit. */
async function ceQuIlAVu(m: MagasinDEssai, qui: string) {
  const { journal } = await m.campagne.porte().lireAvecLeJournal([])
  return journal.vuesDe(qui)
}

/** Ce que la série lit pour tirer ses questions — jamais vues d'abord (`vuesPar`, privée). */
const ceQueLaSerieLit = (campagne: CampagneStore, qui: string) => (campagne as unknown as { vuesPar(qui: string): Promise<Map<string, number>> }).vuesPar(qui)

test('les cinq questions qu’une manche de l’Éclair a révélées comptent vues pour toute la campagne — pas comme ses premières réponses', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'eclair.db'), horloge)
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'eclair', carte: null })
  const t = p.depart.tirages[0] as EclairTire
  // Il répond n'importe quoi : la révélation lui dit chaque bonne réponse.
  const issue = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'repondre', manche: 0, reponse: { eclair: { reponses: [true, true, true, true, true] } } })
  assert.ok('partie' in issue)
  const m0 = issue.partie.etat.manches[0]
  assert.ok(m0.verdict)
  const revele = REGLES.eclair.reveler(t, m0.etat as never, m0.verdict) as EclairRevele
  assert.deepEqual(
    revele.affirmations.map(a => a.bonne),
    t.affirmations.map(a => a.question.reponses[a.question.bonne]),
    'la révélation dit la bonne réponse de chacune',
  )
  const ids = t.affirmations.map(a => a.question.id)
  const { vues, premieres } = await ceQuIlAVu(m, 'qui')
  const piece = idDeLEclair(ids)
  assert.equal(vues.get(piece), horloge.t, 'la pièce elle-même, sous son composé')
  assert.deepEqual(
    ids.filter(id => vues.get(id) !== horloge.t),
    [],
    `la campagne ne voit que ${JSON.stringify([...vues.keys()])} : ses cinq questions restent « jamais vues »`,
  )
  assert.deepEqual(
    ids.filter(id => premieres.has(id)),
    [],
    'une manche de l’Éclair n’est la première réponse d’aucune de ses questions',
  )
  // La série les lit vues : elle ne les repose qu'après celles qu'il n'a jamais vues.
  const serie = await ceQueLaSerieLit(m.campagne, 'qui')
  assert.deepEqual(
    ids.filter(id => !serie.has(id)),
    [],
    'la série les tient pour jamais vues',
  )
})

test('le tableau qu’une manche du Détail a nommé : les questions de la base qui le demandent comptent vues', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'detail.db'), horloge)
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: null })
  const t = p.depart.tirages[0] as DetailTire
  // La partie quittée d'emblée : la manche ouverte s'écrit sans réponse, et sa révélation le nomme quand même.
  const fin = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'quitter' })
  assert.ok('partie' in fin)
  const questions = tableauxDuDetail().find(x => x.qid === t.tableau.qid)!.questions
  assert.ok(questions.length > 0, `${t.tableau.titre} : ses questions de la base`)
  const { vues, premieres } = await ceQuIlAVu(m, 'qui')
  assert.equal(vues.get(idDuTableau(t.tableau.qid)), horloge.t, 'la pièce elle-même')
  assert.deepEqual(
    questions.filter(id => vues.get(id) !== horloge.t),
    [],
    `${t.tableau.titre}, nommé à la révélation : « Qui a peint… ? » restait jamais vue`,
  )
  assert.deepEqual(
    questions.filter(id => premieres.has(id)),
    [],
    'ni sa première réponse',
  )
  // Rien d'autre que ce que la manche a montré : un tableau qui n'y était ni le bon ni un leurre reste jamais vu. Pris
  // au hasard parmi les autres, il pouvait être un leurre — montré avec son peintre, il compte vu depuis la deuxième
  // tablée (plus bas).
  const montres = new Set(t.titres.map(x => x.titre))
  const autre = tableauxDuDetail().find(x => !montres.has(x.titre) && x.questions.every(q => !questions.includes(q)))!
  assert.deepEqual(
    autre.questions.filter(id => vues.has(id)),
    [],
    `${autre.titre}, jamais montré`,
  )
})

/** Le tableau du catalogue que porte un titre proposé : son titre et son peintre, les quatre d'une fenêtre ont des titres distincts. */
const tableauDuTitre = (x: { titre: string; peintre: string }) => tableauxDuDetail().find(t => t.titre === x.titre && t.peintre === x.peintre)!

test('les trois leurres d’une manche du Détail, montrés avec leur peintre, comptent vus comme le bon — à l’heure de la pièce, jamais comme une première réponse', async () => {
  // La deuxième tablée (le 26 octobre 2026, `regressions-serveur-1`) : la manche montre ses quatre titres, chacun avec son
  // peintre, dès son ouverture — la réponse de chaque « Qui a peint… ? » qui les nomme. Seul le bon s'écrivait vu : une
  // partie libre du Détail, illimitée, soufflait neuf réponses de peintre que le duel classé posait ensuite comme neuves.
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'detail-leurres.db'), horloge)
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: null })
  const t = p.depart.tirages[0] as DetailTire
  const montre = REGLES.detail.montrer(t, p.etat.manches[0].etat as never) as { titres: { titre: string; peintre: string }[] }
  assert.ok(montre.titres.length === 4 && montre.titres.every(x => x.peintre.length > 0), 'quatre titres, chacun avec son peintre, dès l’ouverture')
  horloge.t += 4_000
  // Il répond un leurre : la révélation redit les quatre.
  const r = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'repondre', manche: 0, reponse: { detail: { titre: (t.bonne + 1) % 4 } } })
  assert.ok('partie' in r, JSON.stringify(r))
  const leurres = t.titres.filter((_, i) => i !== t.bonne).map(tableauDuTitre)
  assert.equal(leurres.length, 3)
  const { vues, premieres } = await ceQuIlAVu(m, 'qui')
  for (const l of leurres) {
    assert.ok(l.questions.length > 0, `${l.titre} : sa question de la base`)
    assert.equal(vues.get(idDuTableau(l.qid)), horloge.t, `${l.titre} : le tableau lui-même, que la fraîcheur du Détail lit`)
    assert.deepEqual(
      l.questions.filter(id => vues.get(id) !== horloge.t),
      [],
      `${l.titre}, leurre montré avec son peintre : « Qui a peint… ? » restait jamais vue`,
    )
    assert.deepEqual(
      l.questions.filter(id => premieres.has(id)),
      [],
      `${l.titre} : ni sa première réponse`,
    )
  }
  // Et la série les lit vues, comme le bon.
  const serie = await ceQueLaSerieLit(m.campagne, 'qui')
  assert.deepEqual(
    leurres.flatMap(l => l.questions).filter(id => !serie.has(id)),
    [],
    'la série les tenait pour jamais vues',
  )
})

test('« Changer » au Détail : la manche remplacée — quatre titres et leurs peintres — compte vue avec la pièce de sa rechange, quittée comprise', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'detail-change.db'), horloge)
  // « Échange », une des quatre œuvres de départ : Changer.
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'detail', carte: 'echange' })
  assert.equal(p.depart.carte?.pouvoir, 'changer')
  const remplacee = p.depart.tirages[0] as DetailTire
  const r = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'changer', manche: 0 })
  assert.ok('partie' in r, JSON.stringify(r))
  const rechange = p.depart.tirages[r.partie.etat.manches[0].tirage] as DetailTire
  horloge.t += 3_000
  const fin = await m.cabinet.geste('qui', p.id, r.partie.etat.rang, { quoi: 'quitter' })
  assert.ok('partie' in fin, JSON.stringify(fin))
  // Une seule pièce pour la manche : celle de sa rechange, quittée.
  assert.deepEqual(
    fin.partie.etat.pieces.map(x => x.piece.id),
    [idDuTableau(rechange.tableau.qid)],
    'la manche n’écrit toujours qu’une pièce, celle du tableau qu’elle joue',
  )
  const { vues } = await ceQuIlAVu(m, 'qui')
  const sesQuatre = remplacee.titres.map(tableauDuTitre)
  for (const x of sesQuatre) {
    assert.equal(vues.get(idDuTableau(x.qid)), horloge.t, `${x.titre}, montré puis changé : le Cabinet le reservait comme jamais vu`)
    assert.deepEqual(
      x.questions.filter(id => vues.get(id) !== horloge.t),
      [],
      `${x.titre}, lu à l’écran avec son peintre : « Qui a peint… ? » restait jamais vue, au Cabinet comme ailleurs`,
    )
  }
})

test('« Changer » au Pari : la question remplacée compte vue — jamais celle du pari, jamais montrée —, et la rechange n’est plus nue', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'pari-change.db')
  const m = await magasinDEssai(fichier, horloge)
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'pari', carte: 'echange' })
  const remplacee = p.depart.tirages[0] as PariTire
  const r = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'changer', manche: 0 })
  assert.ok('partie' in r, JSON.stringify(r))
  const rechange = p.depart.tirages[r.partie.etat.manches[0].tirage] as PariTire
  horloge.t += 3_000
  // Une réponse fausse, dans les temps et sans aide : nue d'ordinaire, la seule pièce du Cabinet que la mesure lise.
  const faux = await m.cabinet.geste('qui', p.id, r.partie.etat.rang, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: (rechange.q1.bonne + 1) % 4 } } })
  assert.ok('partie' in faux, JSON.stringify(faux))
  const { journal } = await m.campagne.porte().lireAvecLeJournal([])
  const { vues, premieres } = journal.vuesDe('qui')
  assert.equal(vues.get(remplacee.q1.id), horloge.t, 'la question remplacée, lue à l’écran : elle revenait jamais vue')
  assert.ok(!premieres.has(remplacee.q1.id), 'sans réponse, elle n’est la première réponse de personne')
  assert.ok(!vues.has(remplacee.q2.id) && !vues.has(rechange.q2.id), 'la question du pari ne se montre qu’à « Parier »')
  // La rechange se joue sur l'échéance de la manche remplacée — le chrono continue : moins de temps que sa question n'en
  // avait. Nue, la mesure l'aurait comptée plus dure qu'elle n'est.
  const forme = enBase(fichier, db => (db.prepare('SELECT forme FROM campagne_reponses WHERE reserve_id = ?').get(rechange.q1.id) as { forme: string | null }).forme)
  assert.equal(forme, 'pari', 'la rechange porte la forme de son jeu')
  assert.ok(!journal.mesures().brutes.has(rechange.q1.id), 'la mesure ne la compte pas')
})

test('« Changer » à l’Épingle : le lieu remplacé compte vu pour le Cabinet, mais tes murs ne le montrent pas — aucune révélation ne l’a dit', async () => {
  const horloge = { t: DIX_HEURES }
  const m = await magasinDEssai(path.join(dossierDEssai(), 'epingle-change.db'), horloge)
  const p = await m.cabinet.commencer('qui', { origine: 'libre', jeu: 'epingle', carte: 'echange' })
  const remplacee = p.depart.tirages[0] as EpingleTiree
  const r = await m.cabinet.geste('qui', p.id, p.etat.rang, { quoi: 'changer', manche: 0 })
  assert.ok('partie' in r, JSON.stringify(r))
  const rechange = p.depart.tirages[r.partie.etat.manches[0].tirage] as EpingleTiree
  assert.notEqual(rechange.lieu.id, remplacee.lieu.id)
  horloge.t += 3_000
  const fin = await m.cabinet.geste('qui', p.id, r.partie.etat.rang, { quoi: 'quitter' })
  assert.ok('partie' in fin, JSON.stringify(fin))
  const { vues } = await ceQuIlAVu(m, 'qui')
  assert.equal(vues.get(idDuLieu(remplacee.lieu.id)), horloge.t, 'sa question lue, le lieu remplacé ne revient pas « jamais vu » de la semaine')
  // Tes murs ne disent que ce qu'une révélation a dit : la rechange quittée se revoit au bilan, le lieu remplacé jamais.
  const murs = mursDe(await m.cabinet.murs('qui'))
  assert.deepEqual(
    murs.lieux.map(x => x.id),
    [rechange.lieu.id],
    'le lieu remplacé, sa commune et ses coordonnées, sur les murs : la réponse d’une question jamais révélée',
  )
})

test('une frise d’un sujet : les questions de ses nouveaux venus comptent vues, à l’heure de leur manche', async () => {
  const fichier = path.join(dossierDEssai(), 'frise.db')
  const horloge = { t: DIX_HEURES }
  // La base d'essai ne date rien : la manche se range à la main, puis un serveur qui démarre la lit avec le journal.
  await magasinDEssai(fichier, horloge)
  const avant = DIX_HEURES - 3_600_000
  piecesALaMain(fichier, 'qui', [{ id: idDeLaFriseDeSujet(['q-lampe', 'q-telephone']), mode: 'cabinet', le: avant }])
  const m = await magasinDEssai(fichier, horloge)
  const { vues, premieres } = await ceQuIlAVu(m, 'qui')
  assert.deepEqual(
    ['q-lampe', 'q-telephone'].map(id => vues.get(id)),
    [avant, avant],
  )
  assert.ok(!premieres.has('q-lampe') && !premieres.has('q-telephone'), 'ni leurs premières réponses')
})

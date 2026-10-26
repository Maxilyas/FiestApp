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
import { DIX_HEURES, dossierDEssai, fermerLesMagasins, magasinDEssai, piecesALaMain, type MagasinDEssai } from './cabinet-banc'
import { tableauxDuDetail } from '../src/core/details'
import type { CampagneStore } from '../src/core/campagne'
import { REGLES } from '../../shared/cabinet/jeux/index'
import type { EclairRevele, EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { DetailTire } from '../../shared/cabinet/jeux/detail'
import { idDeLEclair, idDeLaFriseDeSujet, idDuTableau } from '../../shared/cabinet/pieces'

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
  // Rien d'autre que ses questions à lui : un autre tableau reste jamais vu.
  const autre = tableauxDuDetail().find(x => x.qid !== t.tableau.qid && x.questions.every(q => !questions.includes(q)))!
  assert.deepEqual(
    autre.questions.filter(id => vues.has(id)),
    [],
    `${autre.titre}, jamais montré`,
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

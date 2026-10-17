// Le pli d'une expédition (`pliDeLExpedition`) : son état n'est écrit nulle
// part, il se replie de son départ, de ses gestes et de ses réponses — le
// même pour celle qu'on joue et pour une finie (invariant 14). Rejoué, le
// même journal redonne le même état. Le départ de l'étape 1 (`v: 1`), sans
// jokers : une expédition partie avant eux se rejoue telle qu'elle s'est
// jouée — son campement rend sa vie d'office. Les jokers ont leur fichier
// (`expedition-jokers.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GARDIEN, escalesPermises, pliDeLExpedition, questionsDuGardien, type CarteDUnActe, type GesteDExpedition, type QuestionPosee } from '../../shared/expedition'

/** Une petite carte faite à la main : deux escales en bas, une source, un campement, le gardien. */
function carte(): CarteDUnActe {
  return {
    depart: ['e00', 'e01'],
    escales: [
      { id: 'e00', etage: 0, colonne: 0, sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'quatre', suite: ['e10'] },
      { id: 'e01', etage: 0, colonne: 1, sorte: 'question', theme: { categories: ['Sport'] }, forme: 'quatre', suite: ['e10'] },
      { id: 'e10', etage: 1, colonne: 0, sorte: 'source', suite: ['cg'] },
      { id: 'cg', etage: 6, colonne: 0, sorte: 'campement', suite: [GARDIEN] },
      { id: GARDIEN, etage: 7, colonne: 0, sorte: 'gardien', suite: [] },
    ],
  }
}
const DEPART = { v: 1 as const, graine: 'pli', cartes: [carte(), carte(), carte()], gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'] }

/** Un journal qu'on écrit comme le serveur : chaque escale à question tire la sienne, le gardien de quoi aller au bout de ses vies. */
class Journal {
  gestes: GesteDExpedition[] = []
  questions: QuestionPosee[] = []
  reponses = new Map<number, boolean>()
  etat() {
    return pliDeLExpedition(DEPART, this.gestes, this.questions, this.reponses)
  }
  avancer(vers: string) {
    const avant = this.etat()
    this.gestes.push({ quoi: 'avancer', vers })
    const sorte = DEPART.cartes[avant.acte].escales.find(e => e.id === vers)?.sorte
    if (sorte === 'question' || sorte === 'source') this.questions.push({ escale: vers, acte: avant.acte })
    if (sorte === 'gardien') for (let i = 0; i < questionsDuGardien(avant.acte, avant.vies); i++) this.questions.push({ escale: GARDIEN, acte: avant.acte })
    return this.etat()
  }
  repondre(juste: boolean) {
    const e = this.etat()
    assert.notEqual(e.enAttente, null, 'une question attend')
    this.reponses.set(e.enAttente!, juste)
    return this.etat()
  }
}

test('une question ratée coûte une vie ; une source retrouvée en rend une, ratée ne coûte rien ; un campement en rend une ; jamais plus de trois', () => {
  const j = new Journal()
  assert.deepEqual(escalesPermises(DEPART, j.etat()), ['e00', 'e01'])
  j.avancer('e00')
  assert.equal(j.etat().enAttente, 0)
  assert.deepEqual(escalesPermises(DEPART, j.etat()), [], 'une question attend : rien d’autre ne se joue')
  let e = j.repondre(false)
  assert.deepEqual([e.vies, e.justes, e.enAttente, e.passees], [2, 0, null, 1])
  j.avancer('e10')
  e = j.repondre(false)
  assert.equal(e.vies, 2, 'une source ratée ne coûte rien')
  // Une autre expédition, la même jusque-là, où la source est retrouvée.
  const k = new Journal()
  k.avancer('e00')
  k.repondre(false)
  k.avancer('e10')
  assert.equal(k.repondre(true).vies, 3)
  e = j.avancer('cg')
  assert.equal(e.vies, 3, 'le campement rend une vie')
  e = k.avancer('cg')
  assert.equal(e.vies, 3, 'jamais plus de trois')
  assert.deepEqual(escalesPermises(DEPART, e), [GARDIEN])
})

test('le gardien tombe à sa n-ième bonne réponse : l’acte suivant s’ouvre, ses questions de reste ne se posent pas ; au bout, il garde un gardien', () => {
  const j = new Journal()
  const jouerLActe = (fautesAuGardien: number) => {
    j.avancer('e01')
    j.repondre(true)
    j.avancer('e10')
    j.repondre(true)
    j.avancer('cg')
    j.avancer(GARDIEN)
    for (let i = 0; i < fautesAuGardien; i++) j.repondre(false)
    let e = j.etat()
    while (e.gardien) e = j.repondre(true)
    return e
  }
  let e = jouerLActe(1)
  assert.deepEqual([e.acte, e.vaincus, e.vies, e.ici, e.trace, e.issue], [1, 1, 2, null, [], 'en-route'])
  // Quatre bonnes et une faute : cinq questions sur six — la sixième, tirée pour lui, ne se pose pas.
  assert.equal(e.passees, 2 + questionsDuGardien(0, 3))
  j.avancer('e00')
  assert.equal(j.etat().enAttente, j.questions.length - 1, 'la question de l’acte 2 vient après celles du gardien')
  j.repondre(true)
  j.avancer('e10')
  j.repondre(true)
  j.avancer('cg')
  j.avancer(GARDIEN)
  e = j.etat()
  while (e.gardien) e = j.repondre(true)
  assert.equal(e.acte, 2)
  e = jouerLActe(0)
  assert.deepEqual([e.acte, e.vaincus, e.issue], [3, 3, 'au-bout'])
  assert.deepEqual(escalesPermises(DEPART, e), [])
  // Garder : un gardien de son expédition seulement.
  j.gestes.push({ quoi: 'garder', legendaire: 'lg:licorne' })
  assert.equal(j.etat().issue, 'au-bout')
  j.gestes.push({ quoi: 'garder', legendaire: 'lg:dragon' })
  assert.deepEqual([j.etat().issue, j.etat().garde], ['legendaire', 'lg:dragon'])
  j.gestes.push({ quoi: 'garder', legendaire: 'lg:oracle' })
  assert.equal(j.etat().garde, 'lg:dragon', 'un seul, jamais deux')
})

test('la dernière vie perdue finit l’expédition, au gardien comme en route ; l’abandon la finit aussi, même une question en attente', () => {
  const j = new Journal()
  j.avancer('e00')
  j.repondre(false)
  j.avancer('e10')
  j.repondre(false)
  j.avancer('cg')
  j.avancer(GARDIEN)
  let e = j.etat()
  assert.equal(e.vies, 3)
  e = j.repondre(false)
  e = j.repondre(true)
  e = j.repondre(false)
  e = j.repondre(false)
  assert.deepEqual([e.issue, e.vies, e.gardien, e.acte], ['perdue', 0, null, 0])
  j.gestes.push({ quoi: 'avancer', vers: 'e00' })
  assert.equal(j.etat().issue, 'perdue', 'rien ne se joue après')

  const k = new Journal()
  k.avancer('e01')
  k.gestes.push({ quoi: 'avancer', vers: 'e10' })
  assert.equal(k.etat().ici, 'e01', 'un geste par-dessus une question qui attend ne se joue pas')
  k.gestes.push({ quoi: 'abandonner' })
  assert.equal(k.etat().issue, 'abandonnee')
})

test('rejoué, le même journal redonne le même état', () => {
  const j = new Journal()
  j.avancer('e00')
  j.repondre(true)
  j.avancer('e10')
  const une = j.etat()
  const deux = pliDeLExpedition(DEPART, [...j.gestes], [...j.questions], new Map(j.reponses))
  assert.deepEqual(une, deux)
})

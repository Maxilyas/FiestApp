// Le puits du Sphinx, énigme par énigme : chaque fiche écrite est résolue par
// le programme avant d'entrer, sa solution rejouée par le chemin même du
// joueur (`rejouer`), et chaque moule qui en tire est essayé sur vingt-cinq
// graines. C'est le relecteur que les énigmes à lire n'ont pas : il ne dit pas
// si une énigme est belle, il dit qu'elle est juste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FICHES_OUVERTES, MOULES_OUVERTS, ficheOuverte } from '../../shared/puits/catalogue'
import { chuteDe, etoilesDe, niveauDuPalier, rejouer, verifier, type Fiche, type Niveau } from '../../shared/puits/socle'

const mouleDe = (f: Fiche) => MOULES_OUVERTS[f.moule]!
const NIVEAUX: readonly Niveau[] = [1, 2, 3, 4, 5]

test('chaque énigme écrite porte un nom qui n’est qu’à elle, un moule connu, sa source et son récit', () => {
  const vus = new Set<string>()
  for (const f of FICHES_OUVERTES) {
    assert.ok(!vus.has(f.id), `deux fiches portent le nom ${f.id}`)
    vus.add(f.id)
    assert.ok(MOULES_OUVERTS[f.moule], `${f.id} nomme un moule inconnu : ${f.moule}`)
    assert.ok(f.source.length > 8, `${f.id} ne dit pas d’où elle vient`)
    assert.ok(f.recit.length >= 2 && f.regle, `${f.id} n’a pas son récit ou sa règle`)
    assert.ok(f.niveau >= 1 && f.niveau <= 5, `${f.id} : niveau ${f.niveau}`)
    assert.equal(ficheOuverte({ id: f.id }), f)
  }
})

test('chaque énigme écrite se résout, et sa solution rejouée coup par coup mène au but', () => {
  for (const f of FICHES_OUVERTES) {
    const m = mouleDe(f)
    const v = verifier(m, f)
    assert.ok(v.ok, `${f.id} : ${v.note}`)
    if (f.impossible) { assert.equal(v.solution, undefined, `${f.id} est impossible et se résout`); continue }
    if (!v.solution) continue
    const r = rejouer(m, f, 1, v.solution.map(coup => ({ coup })))
    assert.equal(r.refus, undefined, `${f.id} : un coup de sa solution est refusé`)
    assert.deepEqual(r.fin, { gagne: true }, `${f.id} : sa solution ne mène pas au but`)
    assert.equal(etoilesDe(m, f, v, r), 3, `${f.id} : la meilleure solution ne vaut pas trois étoiles`)
  }
})

test('le programme retrouve les nombres des auteurs', () => {
  const coups = (id: string) => { const f = ficheOuverte({ id })!; return verifier(mouleDe(f), f).coups }
  // Dudeney, Amusements in Mathematics : onze traversées au n° 375, onze transvasements au n° 365.
  assert.equal(coups('dudeney-375'), 11)
  assert.equal(coups('dudeney-365'), 11)
  // Alcuin : sept traversées pour le loup, la chèvre et le chou ; Bachet : onze pour les trois maris jaloux.
  assert.equal(coups('loup-chevre-chou'), 7)
  assert.equal(coups('couples-jaloux'), 11)
})

test('une énigme tirée se retire à l’identique, se résout à chaque graine, et demande plus de coups plus bas', () => {
  for (const m of Object.values(MOULES_OUVERTS)) {
    if (!m.tirer) continue
    const moyennes: number[] = []
    for (const niveau of NIVEAUX) {
      let somme = 0
      for (let graine = 1; graine <= 5; graine++) {
        const f = m.tirer(niveau * 1000 + graine, niveau) as Fiche
        assert.deepEqual(JSON.parse(JSON.stringify(m.tirer(niveau * 1000 + graine, niveau))), JSON.parse(JSON.stringify(f)), `${m.cle} : la même graine tire deux énigmes`)
        assert.deepEqual(JSON.parse(JSON.stringify(ficheOuverte({ moule: m.cle, graine: niveau * 1000 + graine, niveau }))), JSON.parse(JSON.stringify(f)))
        assert.equal(f.niveau, niveau)
        assert.ok(f.tiree, `${f.id} ne se dit pas tirée`)
        const v = verifier(m, f)
        assert.ok(v.ok, `${f.id} (graine ${graine}, niveau ${niveau}) : ${v.note}`)
        somme += v.coups ?? 0
      }
      moyennes.push(somme / 5)
    }
    if (m.socle === 'chemin') assert.ok(moyennes[4]! > moyennes[0]!, `${m.cle} : le niveau 5 ne demande pas plus de coups que le niveau 1`)
  }
})

test('rejouer : une défaite fait repartir l’énigme, un coup refusé arrête la partie', () => {
  const f = ficheOuverte({ id: 'loup-chevre-chou' })!
  const m = mouleDe(f)
  // L'homme part avec le chou : le loup mange la chèvre, et l'énigme repart du début.
  const perdue = rejouer(m, f, 1, [{ coup: { traverse: ['homme', 'chou'] } }])
  assert.deepEqual(perdue.fin, { perdu: 'Le loup a mangé la chèvre.' })
  assert.equal(perdue.tours, 1)
  assert.equal(perdue.coups, 0)
  assert.deepEqual(perdue.etat, m.depart(f, 1))
  // Le loup ne sait pas mener la barque.
  const refusee = rejouer(m, f, 1, [{ coup: { traverse: ['loup'] } }, { coup: { traverse: ['homme'] } }])
  assert.equal(refusee.refus, 'Seul l’homme sait mener la barque.')
  assert.equal(refusee.lus, 0)
  // « Recommencer » compte un tour, et rien d'autre.
  const reprise = rejouer(m, f, 1, [{ coup: { traverse: ['homme', 'chevre'] } }, { recommence: true }])
  assert.equal(reprise.tours, 1)
  assert.equal(reprise.coups, 0)
  assert.equal(reprise.fin, null)
})

test('une charge mal formée est un refus, jamais une exception', () => {
  for (const f of FICHES_OUVERTES) {
    const m = mouleDe(f)
    for (const coup of [null, undefined, 3, 'x', {}, { traverse: 'loup' }, { verse: [9, 9] }, { remplit: -1 }, { traverse: [null, {}] }]) {
      const r = m.jouer(f, m.depart(f, 0), coup)
      assert.ok(typeof r.refus === 'string' && !r.etat, `${f.id} accepte ${JSON.stringify(coup)}`)
    }
  }
})

test('une énigme facile fait descendre d’un palier, une dure de trois, et le puits durcit tous les six paliers', () => {
  assert.deepEqual(NIVEAUX.map(chuteDe), [1, 1, 2, 3, 3])
  assert.deepEqual([0, 5, 6, 12, 18, 24, 60].map(niveauDuPalier), [1, 1, 2, 3, 4, 5, 5])
})

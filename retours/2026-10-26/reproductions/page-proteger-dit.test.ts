// Ce que la page dit de Protéger (`POUVOIRS.proteger.dit`, `shared/cabinet/pouvoirs.ts`, montré par
// l'annonce et « Comment ça marche ? ») : « Ta première manche imparfaite gagne des étoiles, si tu y as
// répondu. » Le pli, lui (`mancheProtegee`, même fichier ; `relevable`, `shared/cabinet/partie.ts`),
// saute une manche imparfaite sans réponse et relève la suivante qu'une réponse a tranchée : « ne prend
// pas la protection à la suivante ». Une première manche laissée au chrono ne fait donc pas perdre
// Protéger, contrairement à ce que la page annonce.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/page-proteger-dit.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIDI, Partie as PartieAuPli, S, carte, departDe, ouvrir } from '../../../server/test/cabinet-plans'
import { DUREES_DES_JEUX, GRACE_D_UNE_MANCHE_MS } from '../../../shared/cabinet/bareme'
import { etoilesDesManches } from '../../../shared/cabinet/partie'
import { POUVOIRS } from '../../../shared/cabinet/pouvoirs'

/**
 * La règle telle que la page la dit, mot pour mot : la PREMIÈRE manche imparfaite, et seulement si
 * on y a répondu.
 */
function protegeeSelonLaPage(m: readonly { naturel: number | null; repondue: boolean }[]): number | null {
  const k = m.findIndex(x => x.naturel !== null && x.naturel < 3)
  return k >= 0 && m[k].repondue ? k : null
}

test('Protéger : une première manche laissée au chrono ne coûte pas la protection, la page dit le contraire', () => {
  assert.equal(POUVOIRS.proteger.dit, 'Ta première manche imparfaite gagne des étoiles, si tu y as répondu.')
  const d = departDe('pari', { carte: carte('proteger', 1, 'prudence') })
  const p = new PartieAuPli(d)
  p.joue(ouvrir(0), MIDI)
  // Manche 1 : rien de répondu, le chrono passe — la réponse vide arrive après la grâce, la manche expire.
  const apres = MIDI + DUREES_DES_JEUX.pari * S + GRACE_D_UNE_MANCHE_MS + S
  p.joue({ quoi: 'repondre', manche: 0, reponse: { pari: { choix: 0 } } }, apres)
  // Manche 2 : une réponse fausse.
  p.joue(ouvrir(1), apres + S)
  p.joue({ quoi: 'repondre', manche: 1, reponse: { pari: { choix: 0 } } }, apres + 5 * S)
  const manches = etoilesDesManches(d, p.etat)
  assert.deepEqual(
    manches.slice(0, 2).map(m => [m.naturel, m.fin]),
    [
      [0, 'expiree'],
      [0, 'jugee'],
    ],
  )
  const repondues = [false, true, false]
  const ditParLaPage = protegeeSelonLaPage(manches.map((m, k) => ({ naturel: m.naturel, repondue: repondues[k] })))
  const parLePli = manches.findIndex(m => m.protegee)
  assert.equal(parLePli < 0 ? null : parLePli, ditParLaPage, `le pli relève la manche ${parLePli + 1}, la page n'en promettait aucune`)
})

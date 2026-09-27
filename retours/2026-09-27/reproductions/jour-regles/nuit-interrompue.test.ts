// La nuit interrompue : `clore` écrit d'abord la clôture et le podium, PUIS
// l'expérience de chaque marche, une à une (server/src/core/jour.ts:1219-1230).
// Si Turso lâche au premier crédit, la requête échoue ; au passage suivant,
// le jour est déjà « clos » (`estClos`) et personne ne recrédite le podium :
// l'expérience des marches et le palier du Champion attendent la prochaine
// partie finie de chacun — ou jamais, s'il ne rejoue pas.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/nuit-interrompue.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { JourStore } from '../../../server/src/core/jour'
import { XP_PALIER } from '../../../shared/hautsfaits'
import { avecBanc, jouer, lire } from './outils'

ProfileStore.tirageEclat = () => false

test('Turso lâche au premier crédit de la nuit : le podium est écrit, jamais payé', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')
    await jouer(banc, horloge, alice, () => true)
    await jouer(banc, horloge, bob, i => i !== 0)
    await jouer(banc, horloge, carole, i => i > 1)
    const xp = async (cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.xp as number
    const [aliceAvant, bobAvant] = [await xp(alice), await xp(bob)]

    // Le lendemain, la base lâche au premier crédit du podium.
    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const proto = JourStore.prototype as any
    const ecrireXp = proto.ecrireXp
    let panne = true
    proto.ecrireXp = async function (this: JourStore, ...args: unknown[]) {
      if (panne) {
        panne = false
        throw new TypeError('fetch failed')
      }
      return ecrireXp.apply(this, args)
    }
    try {
      assert.equal((await lire(banc, carole, '/api/jour')).status, 500, 'la première visite du matin échoue')
    } finally {
      proto.ecrireXp = ecrireXp
    }
    // La visite suivante passe : le jour est clos, rien ne se rejoue.
    const matin = (await lire(banc, alice, '/api/jour')).corps
    const matinBob = (await lire(banc, bob, '/api/jour')).corps
    console.log(`[nuit] Alice : « Hier » ${JSON.stringify(matin.sonHier)} ; XP ${aliceAvant} → ${await xp(alice)}`)
    console.log(`[nuit] Bob : « Hier » ${JSON.stringify(matinBob.sonHier)} ; XP ${bobAvant} → ${await xp(bob)}`)
    assert.equal(matin.sonHier.xpPodium, 25, 'la première marche est écrite au podium')
    assert.equal(await xp(alice), aliceAvant + 25 + XP_PALIER[0], 'et payée : 25 XP et le Champion du jour · Bronze')
    assert.equal(await xp(bob), bobAvant + 15, 'la deuxième marche aussi')
  }))

// Contre-expertise de jour-regles-17 (non confirmé par l'expert : lecture
// seule). Deux processus sur la même base permanente — le déploiement sans
// coupure de Render, où l'ancienne et la nouvelle instance se chevauchent un
// instant, ou le PC de secours du CLAUDE.md. Le verrou `#tirage` ne vaut
// que dans un processus. On rejoue l'entrelacement qui compte : la seconde
// instance a lu « pas de tirage » (`tirageLu`) juste avant que la première
// écrive le sien, et lit la réserve juste après — son `tirer` part donc
// après le lot de la première. Son `INSERT OR IGNORE` est ignoré ; son
// `UPDATE … posee_le` du même lot, non.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/verification/jour/deux-tirages.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../../server/test/banc'
import { JourStore } from '../../../../server/src/core/jour'
import { avecBanc, base, JOUR, poster } from '../../jour-regles/outils'

test('deux instances qui tirent le même jour : dix questions de plus marquées posées, jamais jouées', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // La première instance tire le jour.
    assert.equal((await poster(banc, alice, '/api/jour/commencer')).status, 200)
    const avant = base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM jour_reserve WHERE posee_le = ?').get(JOUR) as { n: number }).n)

    // La seconde, sur la même base, arrive au même `tirer`.
    const seconde = new JourStore(banc.quizDbUrl, undefined, { profiles: {} as any, maintenant: () => horloge.t })
    try {
      await seconde.init()
      const lu = await (seconde as any).tirer(JOUR)
      const joue = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(JOUR) as { questions: string }).questions))
      const apres = base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM jour_reserve WHERE posee_le = ?').get(JOUR) as { n: number }).n)
      const libres = base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM jour_reserve WHERE posee_le IS NULL AND retiree_le IS NULL').get() as { n: number }).n)
      console.log(`[deux tirages] tirage joué : ${joue.length} questions (inchangé : ${JSON.stringify(lu.questions) === JSON.stringify(joue)}) ; marquées posées le ${JOUR} : ${avant} → ${apres} ; encore neuves : ${libres}`)
      assert.equal(apres, joue.length, 'seules les questions du tirage joué sont marquées posées')
    } finally {
      seconde.close()
    }
  }))

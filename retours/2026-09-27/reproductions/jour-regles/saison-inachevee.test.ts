// « Une partie commencée compte » (RECOMPENSES.md § 5.13, `joursDeSaison`,
// `statsDuJour`) — pour la jauge. Mais la saison et les paliers ne se
// décernent qu'à la FIN d'une partie (`enregistrer` → `ecrireXp(…, derniere)`,
// server/src/core/jour.ts:723 et 1251-1254) ou au podium de la nuit.
//
// 1. Trois jours d'Halloween, le troisième commencé et pas fini (le
//    téléphone a sonné, ou minuit est passé) : la page dit « 3 jours sur 3 »
//    tout le 1er novembre, et la Citrouille ne tombe jamais — le 2 novembre,
//    la saison est finie, `accorderSaison` n'y trouve plus de période.
// 2. Le septième jour de L'Assidu commencé et pas fini : la jauge dit 7 sur
//    7, le palier attend la prochaine partie finie — et se range sous un
//    autre jour.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/saison-inachevee.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { avecBanc, base, idDe, jouer, lire, poster } from './outils'

ProfileStore.tirageEclat = () => false

const partiesFinies = (banc: any, login: string, jours: string[]) =>
  base(banc, db => {
    const insert = db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
       VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
    )
    for (const jour of jours) insert.run(idDe(banc, login), jour)
  })

test('le troisième jour d’Halloween commencé mais pas fini : « 3 sur 3 », et jamais de Citrouille', () =>
  avecBanc(
    async (banc, horloge) => {
      const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      partiesFinies(banc, 'alice', ['2026-10-29', '2026-10-31'])
      // Le 1er novembre, dernier jour d'Halloween : elle commence, répond à
      // deux questions, et le téléphone sonne.
      let etat = (await poster(banc, alice, '/api/jour/commencer')).corps
      for (let n = 0; n < 2; n++) {
        await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
        etat = (await poster(banc, alice, '/api/jour/suivante')).corps
      }
      const soir = (await lire(banc, alice, '/api/jour')).corps
      console.log('[saison] le 1er novembre au soir :', JSON.stringify(soir.saison))
      assert.equal(soir.saison?.joues, 3, 'la page compte trois jours')
      assert.equal(soir.saison?.requis, 3)

      // Le 2 novembre, elle joue et finit.
      horloge.t = Date.UTC(2026, 10, 2, 9, 0)
      const fin = await jouer(banc, horloge, alice, () => true)
      const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
      console.log('[saison] le 2 novembre, partie finie : légendaires annoncés', fin.etat.legendaires, '; les siens :', moi.legendaires)
      assert.ok(moi.legendaires.includes('lg:citrouille'), 'trois jours joués pendant Halloween ouvrent la Citrouille')
    },
    Date.UTC(2026, 10, 1, 9, 0),
  ))

test('le septième jour commencé mais pas fini : la jauge de L’Assidu dit 7 sur 7, le palier ne tombe pas', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    partiesFinies(banc, 'alice', ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'])
    const etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: 0, choix: 0 })
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    const assidu = moi.hautsFaits.find((h: any) => h.key === 'hf:assidu')
    console.log('[assidu] après avoir commencé le septième jour :', JSON.stringify({ valeur: assidu.valeur, prochain: assidu.prochain, fois: assidu.fois }))
    assert.equal(assidu.valeur, 7)
    assert.equal(assidu.fois, 1, 'sept jours de quiz du jour — une partie commencée compte — font L’Assidu · Bronze')
    void horloge
  }))

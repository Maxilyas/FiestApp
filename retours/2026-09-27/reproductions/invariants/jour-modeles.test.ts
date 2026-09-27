// Invariant 8 (CLAUDE.md) : « Un profil ne donne aucun avantage de jeu. »
// RECOMPENSES.md § 5.13, la réserve : amorcée « par les quiz livrés qui se
// jouent seuls — jamais ceux à personnaliser, ni ceux des animateurs : leurs
// invités y liraient la prochaine soirée ».
//
// Or les quiz livrés SONT ceux des animateurs : `/api/modeles` les propose à
// chaque espace (« partir d'un modèle »), et « Culture générale » est même
// importé d'office dans la bibliothèque de l'administrateur (`amorce`). La
// réserve s'amorce avec leurs questions (`JourStore.amorcer`), les pose les
// premiers jours (`ORDER BY ajoutee_le`), et leur correction — bonne réponse
// comprise — s'ouvre à tout profil qui a fini, puis à tous à minuit. Un
// profil connaît donc d'avance les réponses d'un quiz que la soirée peut
// jouer ; un invité anonyme, non.
//
// Ce test échoue aujourd'hui ; il passera quand la réserve n'amorcera plus
// que des questions qu'aucun animateur ne reçoit.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/invariants/jour-modeles.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { empreinteDe } from '../../../server/src/core/jour'

ProfileStore.tirageEclat = () => false

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

test('les questions du quiz du jour, et leur correction, ne sont pas celles d’un quiz qu’un animateur peut jouer (invariant 8)', async () => {
  // Le premier jour de la réserve, à 10 h à Paris.
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 8, 28, 8, 0) })
  try {
    // Un joueur à profil fait son quiz du jour, puis lit la correction.
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let etat = (await poster(banc, alice, '/api/jour/commencer')).corps
    const jour: string = etat.jour
    while (etat.question) {
      const r = await poster(banc, alice, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
      assert.equal(r.status, 200, r.corps.error)
      etat = (await poster(banc, alice, '/api/jour/suivante')).corps
    }
    const correction = await lire(banc, alice, `/api/jour/correction/${jour}`)
    assert.equal(correction.status, 200, 'témoin : la correction s’ouvre à qui a fini')
    const connues = new Map<string, { texte: string; bonne: string }>(
      correction.corps.questions.map((q: any) => [empreinteDe(q.texte), { texte: q.texte, bonne: q.reponses[q.bonne] }]),
    )

    // Un animateur, lui, reçoit les modèles livrés — et « Culture générale » d'office.
    const animateur = await connexionAnimateur(banc.url)
    const modeles = (await lire(banc, animateur, '/api/modeles')).corps as { id: string; title: string }[]
    const communes: string[] = []
    for (const m of modeles) {
      // « Partir de ce modèle » : la copie arrive dans sa bibliothèque.
      const copie = await poster(banc, animateur, `/api/modeles/${m.id}`)
      assert.equal(copie.status, 201, copie.corps.error)
      for (const q of copie.corps.questions ?? []) {
        const c = connues.get(empreinteDe(q.text ?? ''))
        if (c) communes.push(`« ${c.texte} » → ${c.bonne} (modèle « ${m.title} »)`)
      }
    }
    assert.deepEqual(
      communes,
      [],
      `${communes.length} question(s) du quiz du jour du ${jour}, correction comprise, sont celles d’un quiz livré qu’une soirée peut jouer`,
    )
  } finally {
    await banc.close()
  }
})

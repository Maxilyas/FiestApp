// Les connexions vers la base permanente (la revue du 14 octobre 2026,
// `retours/2026-10-14/`, perf-turso-13). En production, un aller-retour vers
// Turso coûtait 29 ms sur une connexion gardée et 225 ms sur une connexion à
// rouvrir — le `fetch` de Node referme une connexion inactive au bout de 4 s,
// Turso lui-même au bout de 5 —, et rien ne disait laquelle des deux on
// payait. Le serveur compte ce que font ses connexions — ouvertes, refermées
// par la base, tombées en route — et peut les garder chaudes tant que des
// joueurs jouent (`QUIZ_DB_KEEPWARM`) : un `SELECT 1` après trois secondes de
// calme, qui ne compte ni dans le temps de Turso ni dans ses échecs. Et il
// referme à l'heure de Node celles qu'une boucle gelée lui a fait garder.
//
// Les épreuves de la garde, ici par le `fetch` de Node ; le transport léger
// passe les mêmes (`garde-des-connexions.ts`, `transport-leger.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chaudesDemandees, connexionsGardeesChaudes } from '../src/core/connexions'
import { releve } from '../src/core/pouls'
import { demarrer } from './banc'
import { attendre, quand, testerLesConnexions } from './garde-des-connexions'

testerLesConnexions('fetch', e => e instanceof TypeError)

test('un joueur garde les connexions chaudes, pas l’administrateur ; /healthz dit l’entretien, et le serveur fermé l’arrête', async () => {
  let battements = 0
  const battre = async () => void battements++
  const banc = await demarrer({ connexionsChaudes: { battre, battementMs: 150, chaudesMs: 700 } })
  try {
    const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { base: { connexions: { chaudes: Record<string, unknown> | null } } }
    // Des comptes de la minute, pour tout le processus : les épreuves d'avant y sont encore.
    const lus = sante.base.connexions.chaudes
    assert.ok(lus, '/healthz dit l’entretien')
    assert.deepEqual(Object.keys(lus).sort(), ['battementsParMin', 'ouvertesParMin', 'tombesParMin'])
    for (const v of Object.values(lus)) assert.equal(typeof v, 'number')
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.chaudes, true, 'l’heure dit qu’elles étaient gardées chaudes')
    await attendre(400)
    assert.equal(battements, 0, 'personne : rien à garder')
    // Le QG ouvert toute la journée se relit toutes les dix secondes : il ne garde rien.
    await fetch(`${banc.url}/api/admin/qg/direct`)
    await attendre(400)
    assert.equal(battements, 0, 'l’administrateur ne garde pas les connexions chaudes')
    // Un joueur — même sans session : il est là.
    await fetch(`${banc.url}/api/joueur/moi`)
    await quand(() => battements >= 1, 'un battement après la demande d’un joueur')
    // Parti, plus rien.
    await attendre(1_000)
    const apres = battements
    await attendre(500)
    assert.equal(battements, apres, 'plus un battement une fois le joueur parti')
  } finally {
    await banc.close()
  }
  assert.equal(connexionsGardeesChaudes(), false, 'le serveur fermé, l’entretien s’arrête')
  // Sans le demander, un serveur ne garde rien, et /healthz le dit.
  const neuf = await demarrer()
  try {
    const sante = (await (await fetch(`${neuf.url}/healthz`)).json()) as { base: { connexions: { chaudes: unknown } } }
    assert.equal(sante.base.connexions.chaudes, null)
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.chaudes, false)
  } finally {
    await neuf.close()
  }
})

test('QUIZ_DB_KEEPWARM se lit comme un humain l’écrit, et se refuse en disant quoi écrire', () => {
  for (const non of [undefined, '', '  ', '0', 'non', 'false', 'FALSE']) assert.deepEqual(chaudesDemandees(non), { chaudes: false }, `« ${non} »`)
  for (const oui of ['1', ' 1 ', 'oui', 'true', 'True']) assert.deepEqual(chaudesDemandees(oui), { chaudes: true }, `« ${oui} »`)
  for (const illisible of ['30000', 'yes', 'peut-être']) {
    const lu = chaudesDemandees(illisible)
    assert.ok('refus' in lu, `« ${illisible} » se refuse`)
    assert.ok(lu.refus.includes('1 pour garder') && lu.refus.includes(illisible), lu.refus)
  }
})

// Les connexions vers la base permanente (la revue du 14 octobre 2026,
// `retours/2026-10-14/`, perf-turso-13). En production, un aller-retour vers
// Turso coûtait 29 ms sur une connexion gardée et 225 ms sur une connexion à
// rouvrir — le `fetch` de Node referme une connexion inactive au bout de 4 s,
// Turso lui-même au bout de 5 —, et rien ne disait laquelle des deux on
// payait. Le serveur compte ce que font ses connexions — ouvertes, refermées
// par la base, tombées en route — et peut les garder chaudes tant que des
// joueurs jouent (`QUIZ_DB_KEEPWARM`) : un `SELECT 1` après trois secondes de
// calme, qui ne compte ni dans le temps de Turso ni dans ses échecs.
//
// Le faux Turso ne dit pas son délai (aucun en-tête `Keep-Alive`), comme le
// vrai : c'est la garde du client qui décide, ou la base qui referme.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { avecDelai, BaseMuette, clientDistant } from '../src/core/distante'
import { chaudesDemandees, connexionsGardeesChaudes, entretenirLesConnexions, gardeAnnoncee, noterUneDemande } from '../src/core/connexions'
import { pouls, releve } from '../src/core/pouls'
import { demarrer } from './banc'

const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Un faux Turso qui répond `{}` à tout. `refermeApresMs` : il referme une
 * connexion restée inactive aussi longtemps, comme une base qui a son délai ;
 * `coupe` : il coupe la connexion sous chaque requête ; `annonce` : l'en-tête
 * `Keep-Alive` qu'il envoie, s'il en dit un.
 */
async function fauxTurso(reglage: { refermeApresMs?: number; coupe?: boolean; annonce?: string } = {}) {
  const minuteries = new Map<Socket, NodeJS.Timeout>()
  const serveur = createServer((req: IncomingMessage, res) => {
    clearTimeout(minuteries.get(req.socket))
    if (reglage.coupe) return void req.socket.destroy()
    if (reglage.annonce) res.setHeader('Keep-Alive', reglage.annonce)
    req.resume()
    req.on('end', () => res.end('{}'))
    res.on('finish', () => {
      if (reglage.refermeApresMs !== undefined) minuteries.set(req.socket, setTimeout(() => req.socket.end(), reglage.refermeApresMs))
    })
  })
  // Sans délai à lui, Node n'envoie pas d'en-tête `Keep-Alive` : comme Turso, il ne dit rien.
  serveur.keepAliveTimeout = 0
  await new Promise<void>(r => serveur.listen(0, r))
  const port = (serveur.address() as AddressInfo).port
  const adresse = `http://127.0.0.1:${port}`
  // `clientDistant` suit l'hôte de son adresse : ses connexions comptent désormais.
  clientDistant(adresse).close()
  return {
    adresse,
    port,
    fermer: () =>
      new Promise<void>(r => {
        for (const m of minuteries.values()) clearTimeout(m)
        serveur.closeAllConnections()
        serveur.close(() => r())
      }),
  }
}

/** Un aller-retour vers le faux Turso, par le `fetch` du client libsql — un battement de l'entretien, si `battement`. */
const allerRetour = (adresse: string, { delaiMs = 5_000, battement = false } = {}) =>
  avecDelai(delaiMs, { battement })(new Request(`${adresse}/v2/pipeline`, { method: 'POST', body: '{}' })).then(async r => {
    await r.arrayBuffer()
    return r
  })

/** Les comptes de l'heure — et de celle d'avant, si l'heure a tourné pendant le test. */
function comptes() {
  return releve.lignes('banc').reduce(
    (t, l) => ({
      ouvertes: t.ouvertes + (l.connexions?.ouvertes ?? 0),
      refermees: t.refermees + (l.connexions?.refermeesParLaBase ?? 0),
      echecs: t.echecs + (l.connexions?.echecs ?? 0),
      battements: t.battements + (l.connexions?.battements ?? 0),
      tombes: t.tombes + (l.connexions?.battementsTombes ?? 0),
      ouvertesParUnBattement: t.ouvertesParUnBattement + (l.connexions?.ouvertesParUnBattement ?? 0),
    }),
    { ouvertes: 0, refermees: 0, echecs: 0, battements: 0, tombes: 0, ouvertesParUnBattement: 0 },
  )
}

/** Attend qu'une condition tienne — une machine chargée ne fait que la retarder. */
async function quand(condition: () => boolean, message: string, delaiMs = 5_000) {
  const fin = Date.now() + delaiMs
  while (!condition()) {
    if (Date.now() > fin) assert.fail(message)
    await attendre(20)
  }
}

// Le premier de ce fichier : la plus jeune connexion refermée par la base est la sienne.
test('une connexion que la base referme d’elle-même se compte, avec son âge — et la suivante se rouvre sans tomber', async () => {
  // Plus courte que la garde de Node : c'est la base qui referme.
  const turso = await fauxTurso({ refermeApresMs: 300 })
  try {
    const avant = comptes()
    await allerRetour(turso.adresse)
    await attendre(800)
    assert.equal(comptes().refermees - avant.refermees, 1, 'la base a refermé la connexion gardée')
    const age = releve.lignes('banc').at(-1)!.connexions!.plusJeuneRefermeeMs
    assert.ok(age !== null && age >= 250 && age < 800, `refermée à ${age} ms, la base referme à 300`)
    assert.ok(pouls.refermeesParLaBase.lire().n >= 1, '/healthz la compte aussi')
    // Le client l'a vue se fermer : la requête suivante en ouvre une autre, et passe.
    assert.equal((await allerRetour(turso.adresse)).status, 200)
    assert.equal(comptes().ouvertes - avant.ouvertes, 2)
    assert.equal(comptes().echecs, avant.echecs)
  } finally {
    await turso.fermer()
  }
})

test('une connexion neuve vers la base se compte, une connexion gardée non — et un autre hôte pas du tout', async () => {
  const turso = await fauxTurso()
  try {
    const avant = comptes()
    const avantMinute = pouls.connexions.lire().n
    // Trois allers-retours, une connexion gardée pour les deux suivants. Une
    // milliseconde les sépare : enchaînés dans la même tâche, le `fetch` de
    // Node en ouvre une seconde — la première n'est pas encore rendue quand la
    // requête suivante part (mesuré : deux connexions pour dix).
    for (let i = 0; i < 3; i++) {
      await allerRetour(turso.adresse)
      await attendre(10)
    }
    assert.equal(comptes().ouvertes - avant.ouvertes, 1)
    assert.equal(pouls.connexions.lire().n - avantMinute, 1, '/healthz dit la même')
    // Le même serveur sous un autre nom : ce n'est pas la base — les notifications du rappel du soir passent aussi par `fetch`.
    await allerRetour(`http://localhost:${turso.port}`)
    assert.equal(comptes().ouvertes - avant.ouvertes, 1)
  } finally {
    await turso.fermer()
  }
})

test('un aller-retour tombé en route se compte : la connexion coupée sous la requête, le délai dépassé', async () => {
  const coupe = await fauxTurso({ coupe: true })
  try {
    const avant = comptes().echecs
    await assert.rejects(allerRetour(coupe.adresse), TypeError)
    assert.equal(comptes().echecs - avant, 1)
  } finally {
    await coupe.fermer()
  }
  // Une base muette : le délai tombe, et compte aussi.
  const muette = createServer(() => {})
  await new Promise<void>(r => muette.listen(0, '127.0.0.1', r))
  try {
    const avant = comptes().echecs
    await assert.rejects(allerRetour(`http://127.0.0.1:${(muette.address() as AddressInfo).port}`, { delaiMs: 100 }), BaseMuette)
    assert.equal(comptes().echecs - avant, 1)
    assert.ok(pouls.echecsDeLaBase.lire().n >= 2, '/healthz les compte aussi')
  } finally {
    muette.closeAllConnections()
    muette.close()
  }
})

test('le délai que la base annonce se lit à chaque aller-retour — undici le préfère à sa propre garde', async () => {
  const muette = await fauxTurso()
  const bavarde = await fauxTurso({ annonce: 'timeout=7, max=100' })
  try {
    await allerRetour(muette.adresse)
    assert.equal(gardeAnnoncee(), null, 'une base qui ne dit rien : la garde décide')
    await allerRetour(bavarde.adresse)
    assert.equal(gardeAnnoncee(), 7_000)
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.annonceeMs, 7_000)
    await allerRetour(muette.adresse)
    assert.equal(gardeAnnoncee(), null, 'la dernière réponse fait foi')
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.annonceeMs, 7_000, 'l’heure garde la plus longue')
  } finally {
    await muette.fermer()
    await bavarde.fermer()
  }
})

test('gardée chaude, la connexion passe la pause d’un joueur ; sans entretien, Node la referme au bout de 4 s', async () => {
  const turso = await fauxTurso()
  const arreter = entretenirLesConnexions(() => allerRetour(turso.adresse, { battement: true }))
  try {
    // Un joueur demande quelque chose, sa réponse fait un aller-retour, puis il réfléchit six secondes —
    // la pause la plus courante entre deux réponses, en production.
    noterUneDemande()
    let avant = comptes()
    await allerRetour(turso.adresse)
    await attendre(5_000)
    await allerRetour(turso.adresse)
    assert.equal(comptes().ouvertes - avant.ouvertes, 1, 'une seule connexion : le battement l’a gardée')
    assert.ok(comptes().battements - avant.battements >= 1, 'un battement après trois secondes de calme')
    assert.equal(comptes().ouvertesParUnBattement - avant.ouvertesParUnBattement, 0, 'il a battu sur la connexion ouverte')

    // Sans entretien, la même pause : Node l'a refermée, la réponse suivante la repaie.
    arreter()
    avant = comptes()
    await attendre(5_000)
    await allerRetour(turso.adresse)
    assert.equal(comptes().ouvertes - avant.ouvertes, 1, 'rouverte après la garde de Node')
    assert.equal(comptes().battements - avant.battements, 0)
  } finally {
    arreter()
    await turso.fermer()
  }
})

test('les connexions qu’aucune réponse n’emprunte restent chaudes aussi, même quand le joueur répond vite', async () => {
  // Compté sur toutes les connexions à la fois, le calme n'arrivait jamais : une réponse par
  // seconde n'emprunte que la première connexion libre, et les deux autres d'une page se
  // refermaient sous l'entretien — la page suivante les repayait.
  const turso = await fauxTurso()
  const arreter = entretenirLesConnexions(() => allerRetour(turso.adresse, { battement: true }))
  try {
    noterUneDemande()
    const avant = comptes()
    const page = () => Promise.all([allerRetour(turso.adresse), allerRetour(turso.adresse), allerRetour(turso.adresse)])
    await page()
    for (let i = 0; i < 5; i++) {
      await attendre(1_000)
      noterUneDemande()
      await allerRetour(turso.adresse)
    }
    // Partie dans la même tâche, la page trouverait la dernière connexion pas encore rendue (la règle du domaine).
    await attendre(20)
    await page()
    assert.equal(comptes().ouvertes - avant.ouvertes, 3, 'les trois connexions de la page tiennent cinq secondes de réponses rapides')
    assert.ok(comptes().battements - avant.battements >= 3, 'des battements, alors que la base n’a jamais eu trois secondes de calme')
  } finally {
    arreter()
    await turso.fermer()
  }
})

test('l’entretien bat sur chaque connexion libre, autant qu’il en garde au plus, et s’arrête quand le joueur s’en va', async () => {
  const turso = await fauxTurso()
  let enVol = 0
  let auPlusFort = 0
  const battre = async () => {
    enVol++
    auPlusFort = Math.max(auPlusFort, enVol)
    try {
      await allerRetour(turso.adresse, { battement: true })
    } finally {
      enVol--
    }
  }
  const arreter = entretenirLesConnexions(battre, { battementMs: 300, chaudesMs: 1_500, auPlus: 2 })
  try {
    noterUneDemande()
    // Une page qui lance trois lectures de front : trois connexions.
    const avant = comptes()
    await Promise.all([allerRetour(turso.adresse), allerRetour(turso.adresse), allerRetour(turso.adresse)])
    assert.equal(comptes().ouvertes - avant.ouvertes, 3)
    await quand(() => comptes().battements - avant.battements >= 4, 'des battements après le calme')
    assert.equal(auPlusFort, 2, 'deux battements de front, pas trois : l’entretien en garde deux au plus')
    assert.equal(comptes().ouvertesParUnBattement - avant.ouvertesParUnBattement, 0, 'ils battent sur les connexions ouvertes')
    // Le joueur parti — plus une demande depuis une seconde et demie —, l'entretien se tait.
    await attendre(1_800)
    const apres = comptes().battements
    await attendre(900)
    assert.equal(comptes().battements, apres, 'plus un battement une fois le joueur parti')
    // De retour, il repart.
    noterUneDemande()
    await quand(() => comptes().battements > apres, 'un battement au retour du joueur')
  } finally {
    arreter()
    await turso.fermer()
  }
})

test('un battement ne compte ni dans le temps de Turso, ni dans ses échecs, ni parmi les connexions qu’un joueur a payées', async () => {
  const turso = await fauxTurso()
  const coupe = await fauxTurso({ coupe: true })
  let arreter = entretenirLesConnexions(() => allerRetour(turso.adresse, { battement: true }), { battementMs: 100, chaudesMs: 400 })
  try {
    const avant = comptes()
    const avantBase = pouls.base.lire().n
    // Aucune connexion vers cette base : le premier battement en ouvre une, pour la prochaine réponse du joueur.
    noterUneDemande()
    await quand(() => comptes().battements - avant.battements >= 2, 'des battements')
    assert.equal(pouls.base.lire().n, avantBase, 'le temps de Turso ne compte que les allers-retours qu’on attend')
    assert.equal(comptes().ouvertes - avant.ouvertes, 0, 'la part des connexions neuves ne compte que celles d’un joueur')
    assert.equal(comptes().ouvertesParUnBattement - avant.ouvertesParUnBattement, 1, 'celle du battement se compte à part')
    assert.ok(pouls.ouvertesParUnBattement.lire().n >= 1, '/healthz la compte aussi')
    arreter()

    // Une base qui coupe : le battement tombe, se compte, et rien d'autre ne tombe.
    arreter = entretenirLesConnexions(() => allerRetour(coupe.adresse, { battement: true }), { battementMs: 100, chaudesMs: 400 })
    const avantCoupe = comptes()
    noterUneDemande()
    await quand(() => comptes().tombes - avantCoupe.tombes >= 1, 'un battement tombé')
    assert.equal(comptes().echecs, avantCoupe.echecs, 'les échecs ne comptent que les allers-retours qu’on attend')
    assert.ok(pouls.battementsTombes.lire().n >= 1, '/healthz le compte aussi')
  } finally {
    arreter()
    await turso.fermer()
    await coupe.fermer()
  }
})

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

// Ce que tout transport vers la base permanente doit tenir (la revue du
// 14 octobre 2026, `retours/2026-10-14/`, perf-turso-13) : ses connexions
// comptées — ouvertes, refermées par la base, tombées en route —, le délai que
// la base annonce, la garde qui referme une connexion libre avant la base, et
// à l'heure même quand la boucle a gelé, une réponse longue jamais coupée sous
// elle, l'entretien qui les garde chaudes, et ses battements comptés à part.
// Déclarées pour un transport (`testerLesConnexions`) : le `fetch` de Node
// (`connexions-de-la-base.test.ts`), le transport léger
// (`transport-leger.test.ts`) — un fichier chacun, un processus chacun.
//
// Le faux Turso ne dit pas son délai (aucun en-tête `Keep-Alive`), comme le
// vrai : c'est la garde du client qui décide, ou la base qui referme.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { Worker } from 'node:worker_threads'
import { avecDelai, BaseMuette, choisirLeTransport, clientDistant, type TransportDeLaBase } from '../src/core/distante'
import { entretenirLesConnexions, gardeAnnoncee, noterUneDemande } from '../src/core/connexions'
import { pouls, releve } from '../src/core/pouls'

export const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Un faux Turso qui répond `{}` à tout. `refermeApresMs` : il referme une
 * connexion restée inactive aussi longtemps, comme une base qui a son délai ;
 * `coupe` : il coupe la connexion sous chaque requête ; `annonce` : l'en-tête
 * `Keep-Alive` qu'il envoie, s'il en dit un ; `enDeuxFoisMs` : il répond à
 * `/longue` en deux morceaux, le second après tant de ms.
 */
export async function fauxTurso(reglage: { refermeApresMs?: number; coupe?: boolean; annonce?: string; enDeuxFoisMs?: number } = {}) {
  const minuteries = new Map<Socket, NodeJS.Timeout>()
  const serveur = createServer((req: IncomingMessage, res) => {
    clearTimeout(minuteries.get(req.socket))
    if (reglage.coupe) return void req.socket.destroy()
    if (reglage.annonce) res.setHeader('Keep-Alive', reglage.annonce)
    req.resume()
    req.on('end', () => {
      if (reglage.enDeuxFoisMs === undefined || req.url !== '/longue') return void res.end('{}')
      res.write('{"morceaux":')
      minuteries.set(req.socket, setTimeout(() => res.end('2}'), reglage.enDeuxFoisMs))
    })
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

/**
 * Le même faux Turso, dans un fil à lui : sa minuterie ne gèle pas avec la
 * boucle du serveur — le vrai est à Dublin. Il referme une connexion restée
 * inactive `refermeApresMs`, à son heure, quoi que fasse le serveur.
 */
async function fauxTursoAilleurs(refermeApresMs: number) {
  const fil = new Worker(
    `const { createServer } = require('node:http')
     const { parentPort, workerData } = require('node:worker_threads')
     const minuteries = new Map()
     const serveur = createServer((req, res) => {
       clearTimeout(minuteries.get(req.socket))
       req.resume()
       req.on('end', () => res.end('{}'))
       res.on('finish', () => minuteries.set(req.socket, setTimeout(() => req.socket.end(), workerData.refermeApresMs)))
     })
     serveur.keepAliveTimeout = 0
     serveur.listen(0, '127.0.0.1', () => parentPort.postMessage(serveur.address().port))`,
    { eval: true, workerData: { refermeApresMs } },
  )
  const port = await new Promise<number>((r, refus) => {
    fil.once('message', r)
    fil.once('error', refus)
  })
  const adresse = `http://127.0.0.1:${port}`
  clientDistant(adresse).close()
  return { adresse, fermer: async () => void (await fil.terminate()) }
}

/** Un aller-retour vers le faux Turso, par le transport du client libsql — un battement de l'entretien, si `battement`. */
export const allerRetour = (adresse: string, { delaiMs = 5_000, battement = false } = {}) =>
  avecDelai(delaiMs, { battement })(new Request(`${adresse}/v2/pipeline`, { method: 'POST', body: '{}' })).then(async r => {
    await r.arrayBuffer()
    return r
  })

/** Les comptes de l'heure — et de celle d'avant, si l'heure a tourné pendant le test. */
export function comptes() {
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
export async function quand(condition: () => boolean, message: string, delaiMs = 5_000) {
  const fin = Date.now() + delaiMs
  while (!condition()) {
    if (Date.now() > fin) assert.fail(message)
    await attendre(20)
  }
}

/**
 * Déclare les épreuves de la garde des connexions pour ce transport — les
 * premières du fichier : la plus jeune connexion refermée par la base, que le
 * relevé de l'heure retient, est celle de la première. `coupee` reconnaît ce
 * qu'un aller-retour rend quand la base coupe la connexion sous lui : le
 * `fetch` de Node, une `TypeError` (« fetch failed ») ; le transport léger,
 * l'erreur du système.
 */
export function testerLesConnexions(transport: TransportDeLaBase, coupee: (e: unknown) => boolean) {
  choisirLeTransport(transport)

  test(`${transport} · une connexion que la base referme d’elle-même se compte, avec son âge — et la suivante se rouvre sans tomber`, async () => {
    // Plus courte que la garde de Node : c'est la base qui referme.
    const turso = await fauxTurso({ refermeApresMs: 300 })
    try {
      const avant = comptes()
      const debut = performance.now()
      await allerRetour(turso.adresse)
      // Attendre qu'elle se compte, pas une pause fixe : le faux Turso tourne
      // dans la boucle du test. Gelée une demi-seconde — la CI chargée du
      // 19 octobre 2026 —, sa minuterie et celle d'une pause de 800 ms
      // sonnaient au même tour, et le test concluait avant d'avoir lu la fin
      // que la base venait d'envoyer (« 0 !== 1 »), quel que soit le transport.
      await quand(() => comptes().refermees - avant.refermees >= 1, 'la base a refermé la connexion gardée')
      assert.equal(comptes().refermees - avant.refermees, 1, 'une seule connexion refermée')
      const age = releve.lignes('banc').at(-1)!.connexions!.plusJeuneRefermeeMs
      // Jamais avant les 300 ms de la base, jamais plus vieille que l'épreuve
      // (arrondie comme le relevé) : une boucle gelée ne fait que la vieillir.
      assert.ok(age !== null && age >= 250 && age <= Math.round(performance.now() - debut), `refermée à ${age} ms, la base referme à 300`)
      assert.ok(pouls.refermeesParLaBase.lire().n >= 1, '/healthz la compte aussi')
      // Le client l'a vue se fermer : la requête suivante en ouvre une autre, et passe.
      assert.equal((await allerRetour(turso.adresse)).status, 200)
      assert.equal(comptes().ouvertes - avant.ouvertes, 2)
      assert.equal(comptes().echecs, avant.echecs)
    } finally {
      await turso.fermer()
    }
  })

  test(`${transport} · une connexion neuve vers la base se compte, une connexion gardée non — et un autre hôte pas du tout`, async () => {
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

  test(`${transport} · un aller-retour tombé en route se compte : la connexion coupée sous la requête, le délai dépassé`, async () => {
    const coupe = await fauxTurso({ coupe: true })
    try {
      const avant = comptes().echecs
      await assert.rejects(allerRetour(coupe.adresse), coupee)
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

  test(`${transport} · le délai que la base annonce se lit à chaque aller-retour — la garde le préfère à la sienne`, async () => {
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

  test(`${transport} · une connexion que la boucle gelée a gardée au-delà de la garde de Node se referme avant de servir : Turso l’a fermée entre-temps`, async () => {
    // Turso referme à 5 s, Node à 4 : la seconde d'écart ne protège que si la
    // boucle tourne. Gelée par un calcul, la garde de Node ne sonnait qu'après,
    // et l'aller-retour suivant partait sur la connexion que Turso venait de
    // fermer — « fetch failed ← other side closed », sous `GET
    // /api/joueur/missions`, en production le 18 octobre 2026.
    const turso = await fauxTursoAilleurs(5_000)
    try {
      const avant = comptes()
      await allerRetour(turso.adresse)
      await attendre(3_500)
      // La boucle gelée 1,7 s : Turso ferme à 5 s, et Node ne l'a pas encore lu.
      const degel = performance.now() + 1_700
      while (performance.now() < degel) {
        // Un calcul qui ne rend pas la main.
      }
      assert.equal((await allerRetour(turso.adresse)).status, 200)
      assert.equal(comptes().ouvertes - avant.ouvertes, 2, 'l’attardée refermée avant de servir, une neuve pour la requête')
      assert.equal(comptes().echecs, avant.echecs, 'rien n’est tombé en route')
      assert.equal(comptes().refermees, avant.refermees, 'refermée par le serveur, à la garde de Node — pas par la base')
    } finally {
      await turso.fermer()
    }
  })

  test(`${transport} · une connexion qui attend sa réponse, ou la lit encore, ne se referme pas — même au-delà de la garde`, async () => {
    // Annoncé à 3 s, le délai de la base met la garde à 1 s, et la réponse en
    // prend 2 : son premier morceau arrive tout de suite, le second après.
    // Comptée depuis le dernier morceau reçu, la connexion aurait paru libre et
    // attardée, et l'aller-retour suivant l'aurait coupée sous la réponse — au
    // réveil, les bibliothèques arrivent en un demi-mégaoctet.
    const turso = await fauxTurso({ annonce: 'timeout=3', enDeuxFoisMs: 2_000 })
    const muette = await fauxTurso()
    try {
      const avant = comptes().echecs
      const longue = avecDelai(5_000)(new Request(`${turso.adresse}/longue`, { method: 'POST', body: '{}' })).then(r => r.text())
      await attendre(1_200)
      assert.equal(gardeAnnoncee(), 3_000, 'la garde est à 1 s')
      await allerRetour(muette.adresse)
      assert.equal(await longue, '{"morceaux":2}', 'la réponse arrive entière')
      assert.equal(comptes().echecs, avant, 'rien n’est tombé en route')
    } finally {
      await turso.fermer()
      await muette.fermer()
    }
  })

  test(`${transport} · gardée chaude, la connexion passe la pause d’un joueur ; sans entretien, Node la referme au bout de 4 s`, async () => {
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

  test(`${transport} · les connexions qu’aucune réponse n’emprunte restent chaudes aussi, même quand le joueur répond vite`, async () => {
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
      // Les réponses tombent entre les tours de battements. Le premier part quand
      // les deux connexions qu'elles n'empruntent pas ont trois secondes de calme ;
      // la troisième réponse, partie à 3 s elle aussi, les trouvait toutes trois
      // occupées par leur battement et en ouvrait une quatrième — sur une machine
      // chargée, trois fois sur dix (la CI du 17 octobre 2026).
      await attendre(500)
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

  test(`${transport} · l’entretien bat sur chaque connexion libre, autant qu’il en garde au plus, et s’arrête quand le joueur s’en va`, async () => {
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

  test(`${transport} · un battement ne compte ni dans le temps de Turso, ni dans ses échecs, ni parmi les connexions qu’un joueur a payées`, async () => {
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
}

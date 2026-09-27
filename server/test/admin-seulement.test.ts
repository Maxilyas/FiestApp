// Toute route de l'administration refuse l'animateur ordinaire — et la télé
// branchée de l'administrateur —, lue dans le routeur, pas dans une liste à
// tenir.
//
// Seules deux routes du catalogue vérifiaient ce refus ; les neuf de
// l'administration du quiz du jour et les sept des comptes n'avaient que le
// cas « un profil sans console » (401). Retirer `requireAdmin` de
// `/api/admin/jour/masquer` ne faisait rougir aucune épreuve : n'importe quel
// animateur aurait masqué un joueur du classement, annulé une question pour
// tous ou lu les questions à venir avec leurs réponses. L'administration est
// maintenant gardée d'un bloc (`api.ts`), et cette épreuve, comme
// `garde-fous.test.ts` pour les commandes `host:*`, lit la liste dans le code
// : une route de plus sous `/api/admin`, ou derrière `requireAdmin`, y entre
// d'elle-même.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { connexionAnimateur, cookieDe, demarrer, ecrire } from './banc'
import { requireAdmin } from '../src/auth/http'

// L'application Express du serveur, attrapée à sa première requête :
// socket.io l'enveloppe dans son propre écouteur de `request`. Ce qui suit
// lit les détails internes d'Express 4 ; sous Express 5, le compte minimal
// des routes le fera échouer bruyamment, pas passer en silence.
let application: { _router: { stack: Couche[] } } | null = null
const traiter = (express as any).application.handle
;(express as any).application.handle = function (this: any, ...args: unknown[]) {
  application ??= this
  return traiter.apply(this, args)
}

interface Couche {
  route?: { path: string | string[]; methods: Record<string, boolean>; stack: { handle: unknown }[] }
}

test('toute route de l’administration répond 403 à un animateur ordinaire, et à la télé branchée de l’administrateur', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' }, admin)
    assert.equal(cree.status, 201)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    const nadia = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'nadia-pass-1' }))
    // La télé que l'administrateur a branchée chez des amis.
    const { code, jeton } = (await (await ecrire(banc.url, '/api/auth/appairage', {})).json()) as { code: string; jeton: string }
    assert.equal((await ecrire(banc.url, '/api/auth/appairage/valider', { code }, admin)).status, 200)
    const tele = cookieDe(await ecrire(banc.url, '/api/auth/appairage/attente', { jeton }))

    assert.ok(application, 'l’application a servi la connexion')
    const routes = application._router.stack
      // Sous /api/admin, ou derrière requireAdmin : un garde retiré d'une
      // route ne la fait pas sortir de la liste.
      .filter(c => {
        const r = c.route
        if (!r) return false
        const chemins = Array.isArray(r.path) ? r.path : [r.path]
        return r.stack.some(s => s.handle === requireAdmin) || chemins.some(p => typeof p === 'string' && p.startsWith('/api/admin'))
      })
      .flatMap(c => {
        const chemins = Array.isArray(c.route!.path) ? c.route!.path : [c.route!.path]
        return chemins
          .filter((p): p is string => typeof p === 'string')
          .flatMap(p => Object.keys(c.route!.methods).map(m => ({ methode: m.toUpperCase(), chemin: p.replace(/:[a-zA-Z]+/g, 'x') })))
      })
    // Pas une boucle vide : les comptes, le catalogue et le quiz du jour y sont.
    assert.ok(routes.length >= 19, `${routes.length} routes trouvées`)

    const acceptees: string[] = []
    for (const { methode, chemin } of routes) {
      for (const [qui, cookie] of [['Nadia', nadia], ['la télé', tele]] as const) {
        const res =
          methode === 'GET'
            ? await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
            : await ecrire(banc.url, chemin, {}, cookie, methode)
        if (res.status !== 403) acceptees.push(`${qui} : ${methode} ${chemin} → ${res.status}`)
      }
    }
    assert.deepEqual(acceptees, [], 'chaque route de l’administration refuse l’animateur ordinaire et la télé')
  } finally {
    await banc.close()
  }
})

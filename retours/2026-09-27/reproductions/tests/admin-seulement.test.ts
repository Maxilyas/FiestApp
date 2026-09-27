// Épreuve proposée : toute route réservée à l'administrateur répond 403 à un
// animateur ordinaire — lue dans le routeur, pas dans une liste à tenir.
//
// Aujourd'hui, seules deux routes du catalogue (`partage.test.ts`) vérifient
// ce refus ; les neuf routes de l'administration du quiz du jour et les sept
// des comptes n'ont que le cas « un profil sans console » (401). Le mutant
// M13 (retirer `requireAdmin` de `/api/admin/jour/masquer`) passe toute la
// suite : n'importe quel animateur masquerait alors un joueur du classement,
// annulerait une question pour tous ou lirait les questions à venir.
//
// Comme `garde-fous.test.ts` pour les commandes `host:*`, l'épreuve lit la
// liste dans le code : une route de plus derrière `requireAdmin` y entre
// d'elle-même.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/tests/admin-seulement.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, cookieDe, demarrer, ecrire } from '../../../server/test/banc'
import { requireAdmin } from '../../../server/src/auth/http'
import express from 'express'

// L'application Express du serveur, attrapée à sa première requête :
// socket.io l'enveloppe dans son propre écouteur de `request`.
let application: { _router: { stack: Couche[] } } | null = null
const traiter = (express as any).application.handle
;(express as any).application.handle = function (this: any, ...args: unknown[]) {
  application ??= this
  return traiter.apply(this, args)
}

interface Couche {
  route?: { path: string | string[]; methods: Record<string, boolean>; stack: { handle: unknown }[] }
}

test('toute route de l’administration répond 403 à un animateur qui n’est pas l’administrateur', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' }, admin)
    assert.equal(cree.status, 201)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    const nadia = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'nadia-pass-1' }))

    assert.ok(application, 'l’application a servi la connexion')
    const routes = application._router.stack
      // Derrière requireAdmin, ou sous /api/admin : un garde retiré d'une
      // route de l'administration ne la fait pas sortir de la liste.
      .filter(c => {
        const r = c.route
        if (!r) return false
        const chemins = Array.isArray(r.path) ? r.path : [r.path]
        return r.stack.some(s => s.handle === requireAdmin) || chemins.some(p => typeof p === 'string' && p.startsWith('/api/admin'))
      })
      .flatMap(c => {
        const chemins = Array.isArray(c.route!.path) ? c.route!.path : [c.route!.path]
        return chemins.filter(p => typeof p === 'string').flatMap(p => Object.keys(c.route!.methods).map(m => ({ methode: m.toUpperCase(), chemin: p.replace(/:[a-zA-Z]+/g, 'x') })))
      })
    // Pas une boucle vide : les comptes, le catalogue et le quiz du jour y sont.
    assert.ok(routes.length >= 19, `${routes.length} routes trouvées derrière requireAdmin`)

    console.log(`[admin] ${routes.length} routes : ${routes.map(r => `${r.methode} ${r.chemin}`).join(', ')}`)
    const refus: string[] = []
    for (const { methode, chemin } of routes) {
      const res =
        methode === 'GET'
          ? await fetch(`${banc.url}${chemin}`, { headers: { Cookie: nadia } })
          : await ecrire(banc.url, chemin, {}, nadia, methode)
      if (res.status !== 403) refus.push(`${methode} ${chemin} → ${res.status}`)
    }
    assert.deepEqual(refus, [], 'chaque route réservée refuse l’animateur ordinaire')
  } finally {
    await banc.close()
  }
})

// Ce que partagent les scripts de l'expert « robustesse-espaces » : un serveur
// jetable dont les deux bases vivent dans export/evaluations/robustesse-espaces/,
// des espaces d'animateurs créés comme la régie les crée (compte, lien
// d'activation, mot de passe), et un petit registre d'essais.
//
// Lancer depuis server/ :
//   node --import tsx ../retours/2026-09-24/experts/scripts/robustesse-espaces/<script>.ts
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createQuizServer, type QuizServerOptions } from '../../../../../server/src/server'
import { ADMIN, connexionAnimateur, cookieDe, ecrire } from '../../../../../server/test/banc'

export * from '../../../../../server/test/banc'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
export const DOSSIER = path.join(RACINE, 'export/evaluations/robustesse-espaces')

export async function serveur(nom: string, opts: Partial<QuizServerOptions> = {}) {
  const dir = path.join(DOSSIER, nom)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'locale.db')
  const quizDbUrl = `file:${path.join(dir, 'permanente.db')}`
  const server = await createQuizServer({ port: 0, dbPath, quizDbUrl, admin: ADMIN, ...opts })
  return { server, url: `http://localhost:${server.port}`, dir, dbPath, quizDbUrl }
}

/** Un espace de plus, ouvert par l'administrateur et activé par son animateur. Rend le cookie de session. */
export async function espace(url: string, login: string, slug: string, name = login) {
  const admin = await connexionAnimateur(url)
  const cree = await ecrire(url, '/api/admin/accounts', { login, name, slug }, admin)
  if (cree.status !== 201) throw new Error(`création de ${slug} refusée (${cree.status})`)
  const { activation, account } = (await cree.json()) as any
  const active = await ecrire(url, '/api/auth/activate', { token: activation.token, password: `motdepasse-${login}` })
  if (!active.ok) throw new Error(`activation de ${slug} refusée (${active.status})`)
  return { cookie: cookieDe(active), id: account.id as string, slug }
}

/**
 * Éteint le serveur sans attendre les connexions des clients du script, qui
 * se reconnecteraient sans fin : au-delà de cinq secondes, on sort quand même.
 */
export async function eteindre(server: { close(): Promise<void> }) {
  await Promise.race([server.close(), new Promise(r => setTimeout(r, 5000))])
}

/** Lit la base permanente (le fichier `file:` qui tient le rôle de Turso), serveur en marche. */
export async function lire(quizDbUrl: string, sql: string, args: unknown[] = []): Promise<any[]> {
  const { createClient } = createRequire(path.join(RACINE, 'server/package.json'))('@libsql/client')
  const client = createClient({ url: quizDbUrl })
  try {
    return (await client.execute({ sql, args })).rows.map((r: any) => ({ ...r }))
  } finally {
    client.close()
  }
}

// ── Le registre des essais ───────────────────────────────────────────────

const essais: { nom: string; tenu: boolean; detail: string }[] = []
export function essai(nom: string, tenu: boolean, detail = '') {
  essais.push({ nom, tenu, detail })
  console.log(`${tenu ? 'TIENT ' : 'CÈDE  '} ${nom}${detail ? ` — ${detail}` : ''}`)
}
export function bilan() {
  const cedes = essais.filter(e => !e.tenu)
  console.log(`\n${essais.length} essais, ${essais.length - cedes.length} tiennent, ${cedes.length} cèdent`)
  return cedes.length
}

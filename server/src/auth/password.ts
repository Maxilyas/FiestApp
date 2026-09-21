import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * Les mots de passe, hachés avec scrypt — livré avec Node, aucune dépendance.
 *
 * Le haché est une chaîne qui se décrit elle-même (`scrypt$N$r$p$sel$clé`) :
 * durcir les paramètres un jour ne casse pas les comptes existants, chaque
 * haché dit comment il a été calculé. Le calcul part dans le pool de threads
 * de Node : une connexion ne fige jamais une partie en cours.
 */
const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  )

const N = 32768
const R = 8
const P = 1
const KEY_BYTES = 64
const SALT_BYTES = 16
/** scrypt réclame 128·N·r octets ; le double laisse de la marge au refus de Node. */
const MAXMEM = 128 * N * R * 2

export const MIN_PASSWORD = 8
export const MAX_PASSWORD = 200

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = (await scrypt(password.normalize('NFKC'), salt, KEY_BYTES, { N, r: R, p: P, maxmem: MAXMEM })) as Buffer
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

/** Vrai si le mot de passe correspond au haché. Faux, sans lever, sur un haché illisible. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (![n, r, p].every(x => Number.isInteger(x) && x > 0) || n > 2 ** 20) return false
  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  if (salt.length === 0 || expected.length === 0) return false
  try {
    const key = (await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 128 * n * r * 2,
    })) as Buffer
    return key.length === expected.length && timingSafeEqual(key, expected)
  } catch {
    return false
  }
}

let dummy: Promise<string> | null = null

/**
 * Un haché de référence, calculé une fois : on vérifie contre lui quand
 * l'identifiant est inconnu, pour qu'une connexion ratée coûte le même
 * temps qu'il existe ou non — rien ne trahit l'existence d'un compte.
 */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'))
  return dummy
}

/** Ce qui ne va pas dans un mot de passe choisi, ou null s'il convient. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string') return 'Il faut un mot de passe'
  if (password.length < MIN_PASSWORD) return `Au moins ${MIN_PASSWORD} caractères`
  if (password.length > MAX_PASSWORD) return `Au plus ${MAX_PASSWORD} caractères`
  return null
}

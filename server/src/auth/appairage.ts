import express, { type Express } from 'express'
import { randomBytes, randomInt } from 'node:crypto'
import { wrap } from '../core/http'
import type { AuthStore } from './store'
import { accountOf, clientIp, loginBudgetOf, requireAccount, sessionOf, setSessionCookie } from './http'

/**
 * Brancher la télé sans rien y taper.
 *
 * Léa animait depuis son téléphone : pour allumer la télé, deux adresses et
 * deux connexions tapées à la télécommande, avec des mots de passe accentués.
 * Maintenant, la télé ouvre `/host` sans session et affiche un code court ;
 * le téléphone de l'animateur, déjà connecté, le valide ; la télé reçoit une
 * session d'animateur de CET espace.
 *
 * C'est une porte d'authentification, et elle en a les garde-fous :
 * · le code est court (il se tape), mais à usage unique, périmé en cinq
 *   minutes, et il ne se valide que depuis une console déjà ouverte : le
 *   deviner ne rapporte que le droit de donner SA session à un inconnu ;
 * · les essais de validation passent par la réserve commune à toutes les
 *   portes (`loginBudgetOf`), et chaque console a son verrou d'échecs ;
 * · la télé, elle, attend avec un jeton de 256 bits qu'elle seule connaît —
 *   le code affiché à la salle ne suffit pas à récupérer la session.
 *
 * La session de la télé hérite de la porte qui l'a validée (invariant 16) :
 * validée par une console ouverte au profil, elle tombe avec les sessions de
 * ce profil — mot de passe changé, code de secours, espace perdu — car c'est
 * de lui qu'elle tient son accès ; validée par une console ouverte au mot de
 * passe du compte, elle est l'écran commun de la soirée, comme lui.
 */

/** Durée de vie d'un code : le temps de sortir son téléphone. */
export const APPAIRAGE_MS = 5 * 60_000
/** Sans ambiguïté à l'œil ni au doigt : ni 0/O, ni 1/I/L. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LONGUEUR = 6
/** Codes en attente au plus : au-delà, un plaisantin remplirait la mémoire — et l'espace des codes. */
const EN_ATTENTE_MAX = 500
/** Une télé branchée par un code tient une soirée, pas un mois. */
export const TELE_BRANCHEE_MS = 24 * 3600 * 1000

interface Attente {
  code: string
  /** Le secret de la télé : c'est lui, pas le code, qui récupère la session. */
  jeton: string
  expireA: number
  /** Posé par la validation : l'espace, et la session qui l'a validée. */
  valide?: { accountId: string; sessionId: string; profileId: string | null }
}

/** Le code tel qu'on le tape : sans espace, en majuscules. */
export const normaliserCode = (v: unknown): string =>
  typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''

export class Appairages {
  private parJeton = new Map<string, Attente>()
  private parCode = new Map<string, Attente>()

  private purger(now = Date.now()) {
    for (const a of this.parJeton.values()) {
      if (a.expireA <= now) {
        this.parJeton.delete(a.jeton)
        // Un code validé a quitté l'index, et le même code a pu être tiré
        // depuis pour une autre télé : on n'efface que le sien.
        if (this.parCode.get(a.code) === a) this.parCode.delete(a.code)
      }
    }
  }

  /** Un code neuf pour une télé. Null quand il y en a trop en attente. */
  ouvrir(now = Date.now()): { code: string; jeton: string; expireA: number } | null {
    this.purger(now)
    if (this.parJeton.size >= EN_ATTENTE_MAX) return null
    let code = ''
    do {
      code = Array.from({ length: LONGUEUR }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
    } while (this.parCode.has(code))
    const attente: Attente = { code, jeton: randomBytes(32).toString('base64url'), expireA: now + APPAIRAGE_MS }
    this.parJeton.set(attente.jeton, attente)
    this.parCode.set(code, attente)
    return { code, jeton: attente.jeton, expireA: attente.expireA }
  }

  /**
   * La console valide le code. Usage unique : une fois validé, il ne désigne
   * plus rien — un second téléphone ne peut pas le détourner vers son espace.
   */
  valider(code: string, qui: { accountId: string; sessionId: string; profileId: string | null }, now = Date.now()): boolean {
    this.purger(now)
    const attente = this.parCode.get(code)
    if (!attente || attente.valide) return false
    attente.valide = qui
    this.parCode.delete(code)
    return true
  }

  /**
   * Où en est la télé : `attente`, `valide` (et l'attente est consommée),
   * ou `perime` — code expiré, inconnu, ou déjà récupéré.
   */
  reclamer(
    jeton: string,
    now = Date.now(),
  ): { etat: 'attente' } | { etat: 'perime' } | { etat: 'valide'; qui: NonNullable<Attente['valide']> } {
    this.purger(now)
    const attente = this.parJeton.get(jeton)
    if (!attente) return { etat: 'perime' }
    if (!attente.valide) return { etat: 'attente' }
    this.parJeton.delete(jeton)
    return { etat: 'valide', qui: attente.valide }
  }
}

const appairages = new WeakMap<Express, Appairages>()

/** Les appairages d'un serveur : rangés par application, comme la réserve d'essais. */
export function appairagesOf(app: Express): Appairages {
  let a = appairages.get(app)
  if (!a) {
    a = new Appairages()
    appairages.set(app, a)
  }
  return a
}

export function mountAppairage(app: Express, deps: { auth: AuthStore; online: boolean }) {
  const { auth } = deps
  const small = express.json({ limit: '1kb' })
  const budget = loginBudgetOf(app)
  const attentes = appairagesOf(app)
  const trop = { error: 'Trop d’essais — réessaie dans un quart d’heure' }

  // La télé demande un code. Sans session : c'est tout l'objet.
  app.post(
    '/api/auth/appairage',
    small,
    wrap(async (req, res) => {
      res.set('Cache-Control', 'no-store')
      if (!budget.allow(clientIp(req))) return res.status(429).json(trop)
      const ouvert = attentes.ouvrir()
      // 429, pas 503 : un 503 se lit « le serveur redémarre » (`statutPassager`),
      // et la télé l'annonçait au lieu de dire d'attendre.
      if (!ouvert) return res.status(429).json({ error: 'Trop de télés en attente — réessaie dans quelques minutes' })
      res.json({ code: ouvert.code, jeton: ouvert.jeton, expireA: ouvert.expireA })
    }),
  )

  // Le téléphone de l'animateur, déjà connecté, valide le code affiché.
  app.post(
    '/api/auth/appairage/valider',
    requireAccount(auth),
    small,
    wrap(async (req, res) => {
      const account = accountOf(res)
      const sessionId = sessionOf(res)
      // Le verrou est celui de CETTE console : cinq codes faux et elle attend
      // un quart d'heure, sans fermer la porte aux autres.
      const cle = `appairage:${sessionId}`
      if (!budget.allow(clientIp(req), cle)) return res.status(429).json(trop)
      const code = normaliserCode(req.body?.code)
      const session = auth.sessionById(sessionId)
      if (!session || !attentes.valider(code, { accountId: account.id, sessionId, profileId: session.profileId })) {
        budget.failed(cle)
        return res.status(400).json({ error: 'Code inconnu ou périmé — vérifie celui de la télé' })
      }
      budget.succeeded(cle)
      res.json({ ok: true })
    }),
  )

  // La télé attend. Pas de réserve d'essais ici : elle demande toutes les
  // deux secondes, avec un jeton qui ne se devine pas — compter ses
  // demandes fermerait la connexion de l'animateur, sur le même wifi.
  app.post(
    '/api/auth/appairage/attente',
    small,
    wrap(async (req, res) => {
      res.set('Cache-Control', 'no-store')
      const jeton = typeof req.body?.jeton === 'string' ? req.body.jeton : ''
      const r = attentes.reclamer(jeton)
      if (r.etat === 'attente') return res.json({ attente: true })
      // Un code périmé se dit dans une réponse, pas dans une erreur : la télé
      // ne jette son code que sur `perime`, et garde le même jeton sur toute
      // autre panne — une coupure du wifi la faisait redemander un code, et
      // celui que l'animateur venait de valider ne servait plus à rien.
      if (r.etat === 'perime') return res.json({ perime: true })
      // Entre la validation et ce moment, la console qui a validé a pu se
      // fermer, ou son profil perdre l'espace : la télé n'hérite pas d'un
      // accès que sa source n'a plus.
      const account = auth.byId(r.qui.accountId)
      const source = auth.sessionById(r.qui.sessionId)
      if (!account || account.disabledAt || !source || source.accountId !== account.id) {
        return res.json({ perime: true })
      }
      // Une télé branchée ainsi est souvent celle de quelqu'un d'autre — le
      // bar, les parents, la salle louée : sa session ne dure qu'une soirée,
      // sans glisser, au lieu des trente jours d'une console.
      const token = await auth.createSession(account.id, req.header('user-agent') ?? '', r.qui.profileId, {
        dureeMax: TELE_BRANCHEE_MS,
      })
      // Brancher une télé, c'est ouvrir l'espace : la dernière connexion le dit.
      await auth.touchLogin(account.id)
      setSessionCookie(res, token, deps.online)
      res.json({ ok: true })
    }),
  )
}

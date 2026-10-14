import { subscribe } from 'node:diagnostics_channel'
import type { Socket } from 'node:net'
import { performance } from 'node:perf_hooks'
import { lireNombre } from '../../../shared/nombres'
import { GARDE_DE_NODE_MS } from '../../../shared/santeDuServeur'
import { pouls, releve } from './pouls'

// Les connexions vers la base permanente (la revue du 14 octobre 2026,
// `retours/2026-10-14/`, perf-turso-13).
//
// En production, au repos, un aller-retour vers Turso coûtait 29 ms sur une
// connexion gardée et 225 ms sur une connexion à rouvrir : le `fetch` de Node
// referme une connexion restée inactive 4 s quand le serveur ne dit pas son
// délai — Turso ne le dit pas —, et hors soirée presque chaque requête arrive
// après une pause. Le chiffre de « Turso » suivait le rythme du trafic plus
// que le code, et rien ne le disait.
//
// D'où deux choses. Compter, sans rien changer : les connexions qui
// s'ouvrent, celles que la base referme d'elle-même, les allers-retours
// tombés en route — `/healthz` à la minute, le relevé de l'heure pour la page
// « Le serveur ». Et garder les connexions plus longtemps quand on le demande
// (`QUIZ_DB_KEEPALIVE_MS`), en préproduction d'abord : une garde plus longue
// que le délai de Turso tomberait sur une connexion qu'il a déjà fermée, et
// l'écriture qui l'emprunte échouerait — ce que disent les deux derniers
// comptes. Ce délai ne se lit nulle part ailleurs : la session qui a lu la
// base de production passait par un proxy, et c'est lui qu'elle mesurait.

/** Une garde réglée tient entre ces bornes : en dessous, rien à gagner sur celle de Node ; au-delà de dix minutes, aucune base ne garde une connexion muette. */
export const GARDE_MIN_MS = 1_000
export const GARDE_MAX_MS = 10 * 60_000

// ── Compter ───────────────────────────────────────────────────────────────

/**
 * Les hôtes de la base, lus dans les adresses données à `clientDistant` :
 * les autres `fetch` du serveur — les notifications du rappel du soir — ne
 * comptent pas.
 */
const hotes = new Set<string>()

export function suivreLaBase(url: string) {
  try {
    const u = new URL(url)
    // Une base `file:` ne passe pas par le réseau.
    if (u.protocol !== 'file:' && u.hostname) hotes.add(u.hostname)
  } catch {
    // Une adresse illisible : le client libsql le dira mieux.
  }
}

// Le `fetch` de Node (undici, embarqué) annonce chaque connexion qu'il ouvre
// sur ce canal : rien à ajouter pour l'entendre. Derrière un proxy, elle
// s'ouvre vers lui et ne se compte pas — sur l'hébergeur, il n'y en a pas.
subscribe('undici:client:connected', message => {
  const { connectParams, socket } = message as { connectParams?: { hostname?: string }; socket?: Socket }
  if (!connectParams?.hostname || !hotes.has(connectParams.hostname)) return
  pouls.connexions.noter()
  releve.connexion()
  const ouverte = performance.now()
  // Refermée par la base, la connexion reçoit sa fin ; refermée par nous — la
  // garde écoulée —, elle se détruit sans. Undici écoute la même fin et
  // n'emprunte plus la connexion.
  socket?.once('end', () => {
    const age = performance.now() - ouverte
    pouls.refermeesParLaBase.noter(age)
    releve.refermeeParLaBase(age)
  })
})

/** Un aller-retour tombé en route — réseau coupé, connexion fermée sous la requête, délai dépassé (`avecDelai`). */
export function noterUnEchec() {
  pouls.echecsDeLaBase.noter()
  releve.echecDeLaBase()
}

/**
 * Ce que la base annonce de son délai (`Keep-Alive: timeout=…`), au dernier
 * aller-retour ; null tant qu'elle n'en dit rien. Undici préfère l'annonce à
 * toute garde : au-delà d'elle, une garde ne sert à rien, la base referme à
 * son heure. La session qui a lu la base de production ne voyait pas cet
 * en-tête — un proxy le retire —, le serveur, lui, le reçoit.
 */
let annonceeMs: number | null = null

export function noterLaReponse(entetes: Headers) {
  const lu = /(?:^|[\s,;])timeout\s*=\s*(\d+)/i.exec(entetes.get('keep-alive') ?? '')
  annonceeMs = lu ? Number(lu[1]) * 1000 : null
  if (annonceeMs !== null) releve.annonceDeLaBase(annonceeMs)
}

export function gardeAnnoncee(): number | null {
  return annonceeMs
}

// ── Garder ────────────────────────────────────────────────────────────────

/** Le dispatcher du `fetch` de Node, tel que ses options le connaissent. */
type Dispatcher = NonNullable<RequestInit['dispatcher']>

let reglee: number | null = null
/** L'agent des requêtes de la base, construit à la première ; null s'il n'a pas pu l'être. */
let agent: Dispatcher | null | undefined

/**
 * Règle la garde des connexions inactives vers la base — sans argument, celle
 * de Node. Elle vaut pour tout le processus, comme les clients qu'elle sert.
 */
export function reglerLaGarde(ms?: number) {
  if (agent) void agent.close().catch(() => {})
  agent = undefined
  reglee = ms ?? null
  releve.garde(gardeDeLaBase())
}

/** Combien de temps une connexion inactive vers la base se garde, en vigueur. */
export function gardeDeLaBase(): number {
  return reglee !== null && agent !== null ? reglee : GARDE_DE_NODE_MS
}

/**
 * Le dispatcher d'une requête vers la base : sans garde réglée, aucun — le
 * `fetch` garde le sien. Sinon un agent de la classe de celui de Node, pris
 * sur son dispatcher global : undici est embarqué dans Node, et l'ajouter en
 * dépendance en ferait une seconde copie. Il se construit à la première
 * requête, quand le `fetch` a posé le sien.
 */
export function dispatcherDeLaBase(): Dispatcher | undefined {
  if (reglee === null) return undefined
  if (agent === undefined) {
    const global = (globalThis as Record<symbol, { constructor?: unknown } | undefined>)[Symbol.for('undici.globalDispatcher.1')]
    const Agent = global?.constructor as (new (options: { keepAliveTimeout: number }) => Dispatcher) | undefined
    try {
      agent = typeof Agent === 'function' ? new Agent({ keepAliveTimeout: reglee }) : null
    } catch {
      agent = null
    }
    if (agent === null) console.warn(`[base] la garde de ${reglee} ms ne se pose pas : le fetch de Node garde la sienne (${GARDE_DE_NODE_MS} ms)`)
    releve.garde(gardeDeLaBase())
  }
  return agent ?? undefined
}

/**
 * La garde que demande `QUIZ_DB_KEEPALIVE_MS`, en millisecondes : absente,
 * aucune ; illisible ou hors des bornes, un refus qui dit quoi écrire.
 */
export function gardeDemandee(texte: string | undefined): { ms: number } | { refus: string } | null {
  if (!texte?.trim()) return null
  const ms = lireNombre(texte)
  if (ms !== null && Number.isInteger(ms) && ms >= GARDE_MIN_MS && ms <= GARDE_MAX_MS) return { ms }
  return {
    refus:
      `QUIZ_DB_KEEPALIVE_MS illisible (« ${texte.trim()} ») : un nombre de millisecondes entre ${GARDE_MIN_MS} et ${GARDE_MAX_MS}, comme 30000. ` +
      `Les connexions vers la base restent gardées ${GARDE_DE_NODE_MS / 1000} s, comme le fait Node.`,
  }
}

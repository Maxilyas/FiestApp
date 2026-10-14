import { subscribe } from 'node:diagnostics_channel'
import type { Socket } from 'node:net'
import { performance } from 'node:perf_hooks'
import { pouls, releve } from './pouls'

// Les connexions vers la base permanente (la revue du 14 octobre 2026,
// `retours/2026-10-14/`, perf-turso-13).
//
// En production, au repos, un aller-retour vers Turso coûtait 29 ms sur une
// connexion gardée et 225 ms sur une connexion à rouvrir : le `fetch` de Node
// referme une connexion restée inactive 4 s quand le serveur ne dit pas son
// délai — Turso ne le dit pas —, et presque chaque requête arrive après une
// pause : un joueur répond toutes les six à huit secondes.
//
// D'où deux choses. Compter, sans rien changer : les connexions qui
// s'ouvrent, celles que la base referme d'elle-même, les allers-retours
// tombés en route — `/healthz` à la minute, le relevé de l'heure pour la page
// « Le serveur ». Et garder les connexions chaudes tant que des joueurs jouent
// (`QUIZ_DB_KEEPWARM`, plus bas).
//
// Pas une garde plus longue : on l'a posée à 30 s en production le même jour
// (`QUIZ_DB_KEEPALIVE_MS`, retirée depuis), et les comptes ont dit le délai de
// Turso — il referme lui-même une connexion après 5 s de calme (838 sur 839 en
// une heure, la plus jeune à 5,0 s). Au-delà de 5 s la garde ne gardait rien ;
// juste à 5 s, une requête partait sur la connexion qu'il fermait : six
// allers-retours tombés en une heure, dont la réponse d'un joueur.

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

/** Les connexions ouvertes vers la base en ce moment : celles que l'entretien garde chaudes. */
const ouvertes = new Set<Socket>()

/**
 * Quand chacune a servi pour la dernière fois : sa dernière requête partie,
 * sa dernière réponse reçue. Node la referme 4 s après — chacune à son
 * heure : les réponses d'un joueur n'empruntent que les premières, et les
 * autres vieillissent pendant qu'il joue.
 */
const servies = new WeakMap<Socket, { envoi: number; reponse: number }>()

/** Les vrais allers-retours en vol — pas les battements de l'entretien. */
let enVol = 0

// Une requête part sur une connexion : le `fetch` de Node le dit sur ce canal.
subscribe('undici:client:sendHeaders', message => {
  const socket = (message as { socket?: Socket }).socket
  const servie = socket && servies.get(socket)
  if (servie) servie.envoi = performance.now()
})

// Le `fetch` de Node (undici, embarqué) annonce chaque connexion qu'il ouvre
// sur ce canal : rien à ajouter pour l'entendre. Derrière un proxy, elle
// s'ouvre vers lui et ne se compte pas — sur l'hébergeur, il n'y en a pas.
subscribe('undici:client:connected', message => {
  const { connectParams, socket } = message as { connectParams?: { hostname?: string }; socket?: Socket }
  if (!connectParams?.hostname || !hotes.has(connectParams.hostname)) return
  // Ouverte pendant un battement, aucun vrai aller-retour en vol : c'est
  // l'entretien qui l'a payée, pas un joueur — la part des connexions neuves
  // ne compte que les siennes.
  if (entretien?.bat() && enVol === 0) {
    pouls.ouvertesParUnBattement.noter()
    releve.connexionParUnBattement()
  } else {
    pouls.connexions.noter()
    releve.connexion()
  }
  const ouverte = performance.now()
  if (socket) {
    ouvertes.add(socket)
    const servie = { envoi: ouverte, reponse: ouverte }
    servies.set(socket, servie)
    socket.on('data', () => (servie.reponse = performance.now()))
    socket.once('close', () => ouvertes.delete(socket))
  }
  // Refermée par la base, la connexion reçoit sa fin ; refermée par nous — la
  // garde écoulée —, elle se détruit sans. Undici écoute la même fin et
  // n'emprunte plus la connexion.
  socket?.once('end', () => {
    const age = performance.now() - ouverte
    pouls.refermeesParLaBase.noter(age)
    releve.refermeeParLaBase(age)
  })
})

/**
 * Un vrai aller-retour part vers la base (`avecDelai`) ; la fonction rendue
 * dit qu'il est arrivé — ou tombé. L'entretien compte son calme depuis là.
 */
export function unAllerRetourPart(): () => void {
  enVol++
  let fini = false
  return () => {
    if (fini) return
    fini = true
    enVol--
    entretien?.allerRetourFini()
  }
}

/** Un aller-retour tombé en route — réseau coupé, connexion fermée sous la requête, délai dépassé (`avecDelai`). */
export function noterUnEchec() {
  pouls.echecsDeLaBase.noter()
  releve.echecDeLaBase()
}

/**
 * Ce que la base annonce de son délai (`Keep-Alive: timeout=…`), au dernier
 * aller-retour ; null tant qu'elle n'en dit rien. Undici préfère l'annonce à
 * sa propre garde. Turso n'annonçait rien le 14 octobre 2026 : un délai qui
 * paraîtrait ici dirait qu'il a changé.
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

// ── Garder chaudes ────────────────────────────────────────────────────────
//
// Turso referme à 5 s, Node à 4 : une connexion ne se garde qu'en servant.
// Tant qu'un joueur est là, l'entretien la fait servir — un `SELECT 1`, qui
// ne lit aucune ligne, avant qu'elle ait trois secondes de calme —, et la
// réponse suivante du joueur la trouve chaude : 29 ms au lieu de 225. Quand
// il s'en va, l'entretien s'arrête, et Node referme ses connexions comme
// avant.
//
// Le calme se compte connexion par connexion : compté sur toutes à la fois,
// une réponse toutes les deux secondes ne laissait jamais trois secondes de
// calme, et les connexions qu'elle n'empruntait pas — le `fetch` donne la
// première libre — se refermaient sous l'entretien : la page suivante les
// repayait (sur le banc, onze connexions neuves pour treize allers-retours).

/** Le calme d'une connexion avant son battement : la garde de Node referme à 4 s, Turso à 5 — une seconde de marge pour une boucle en retard. */
export const BATTEMENT_MS = 3_000
/**
 * Combien de temps les connexions restent chaudes après la dernière demande
 * d'un joueur : en production, 99 % des pauses entre deux réponses d'une même
 * partie, 96 % d'un joueur entre deux parties durent moins d'une minute (le
 * 14 octobre 2026, quatorze jours de réponses).
 */
export const CHAUDES_MS = 60_000
/**
 * Les connexions gardées chaudes, au plus : une réponse en emprunte deux —
 * ses deux allers-retours enchaînés en ouvrent deux —, la campagne et les
 * duels quatre à six de front. L'accueil en lance treize, et attend la plus
 * lente : il en faudrait treize, deux fois plus de battements pour une page
 * — ou HTTP/2, une seule connexion pour toute la vague.
 */
export const CHAUDES_AU_PLUS = 6

export interface ReglagesDeLEntretien {
  battementMs?: number
  chaudesMs?: number
  auPlus?: number
}

class Entretien {
  /** Jusqu'à quand un joueur est là — chaque demande repousse l'échéance. */
  private jusqua = 0
  /** Le dernier aller-retour arrivé, ou le retour d'un joueur : sans connexion ouverte, le calme se compte depuis là. */
  private repere = 0
  /** Le dernier tour de battements : deux tours ne se suivent jamais à moins de la moitié du calme. */
  private dernierTour = 0
  private minuterie: ReturnType<typeof setTimeout> | null = null
  /** Les battements en vol. */
  private enCours = 0
  private arrete = false
  private readonly battementMs: number
  private readonly chaudesMs: number
  private readonly auPlus: number

  constructor(
    private readonly battre: () => Promise<unknown>,
    reglages: ReglagesDeLEntretien = {},
  ) {
    this.battementMs = reglages.battementMs ?? BATTEMENT_MS
    this.chaudesMs = reglages.chaudesMs ?? CHAUDES_MS
    this.auPlus = reglages.auPlus ?? CHAUDES_AU_PLUS
  }

  /** Vrai pendant un battement. */
  bat(): boolean {
    return this.enCours > 0
  }

  /** Un joueur a demandé quelque chose. */
  demande() {
    const t = performance.now()
    // De retour après une absence : le calme repart de lui. Sinon le battement
    // partirait tout de suite, à côté des allers-retours qu'il va lancer.
    if (t >= this.jusqua) this.repere = Math.max(this.repere, t)
    this.jusqua = t + this.chaudesMs
    this.planifier()
  }

  allerRetourFini() {
    this.repere = performance.now()
    this.planifier()
  }

  /**
   * Quand le prochain tour doit partir : quand la plus anciennement servie
   * des connexions qu'il garde — les plus récemment servies, `auPlus` au
   * plus ; les autres, qu'aucune vague ne demande plus, se referment — aura
   * son calme. Une connexion qui attend sa réponse ne vieillit pas : Node ne
   * compte sa garde qu'une fois la réponse reçue. Sans connexion libre, le
   * calme part du dernier aller-retour, ou du retour du joueur.
   */
  private echeance(): number {
    const libres: number[] = []
    for (const socket of ouvertes) {
      const servie = servies.get(socket)
      if (servie && servie.envoi <= servie.reponse) libres.push(servie.reponse)
    }
    libres.sort((a, b) => b - a)
    const gardees = libres.slice(0, this.auPlus)
    const depuis = gardees.length > 0 ? gardees[gardees.length - 1] : this.repere
    return Math.max(depuis + this.battementMs, this.dernierTour + this.battementMs / 2)
  }

  private planifier() {
    if (this.arrete || this.minuterie || this.enCours > 0) return
    const t = performance.now()
    if (t >= this.jusqua) return
    this.minuterie = setTimeout(() => this.verifier(), Math.max(0, this.echeance() - t))
    // L'entretien ne retient jamais le processus : il sert qui est là.
    this.minuterie.unref()
  }

  private verifier() {
    this.minuterie = null
    const t = performance.now()
    if (this.arrete || t >= this.jusqua) return
    // Une connexion a servi depuis : son calme repart.
    if (t < this.echeance() - 1) return this.planifier()
    // Un battement par connexion libre — le `fetch` donne à chacun la
    // première libre : les toucher toutes, c'est toucher celle qui vieillit —,
    // une au moins : un joueur là dont les connexions sont déjà tombées en
    // retrouve une pour sa prochaine réponse.
    const n = Math.min(this.auPlus, Math.max(1, ouvertes.size - enVol))
    this.dernierTour = t
    this.enCours = n
    for (let i = 0; i < n; i++) pouls.battements.noter()
    releve.battements(n)
    // Un battement qui tombe ne fait rien tomber : il se compte, et le suivant partira.
    const battements = Array.from({ length: n }, () =>
      Promise.resolve()
        .then(() => this.battre())
        .catch(() => {
          pouls.battementsTombes.noter()
          releve.battementTombe()
        }),
    )
    void Promise.all(battements).then(() => {
      this.enCours = 0
      // Tombés, sans connexion qui tienne : le suivant attend son calme, pas la moitié.
      this.repere = Math.max(this.repere, performance.now())
      this.planifier()
    })
  }

  arreter() {
    this.arrete = true
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = null
  }
}

let entretien: Entretien | null = null

/**
 * Garde les connexions vers la base chaudes tant que des joueurs jouent :
 * `battre` fait un aller-retour qui ne lit rien (un `SELECT 1`) ; sans lui,
 * aucun entretien. Il vaut pour tout le processus, comme les connexions qu'il
 * garde : chaque serveur pose le sien, et la fonction rendue n'arrête que
 * celui-là — un serveur d'avant qu'on ferme n'arrête pas celui du suivant.
 */
export function entretenirLesConnexions(battre?: (() => Promise<unknown>) | null, reglages?: ReglagesDeLEntretien): () => void {
  entretien?.arreter()
  const lui = battre ? new Entretien(battre, reglages) : null
  entretien = lui
  releve.chaudes(lui !== null)
  return () => {
    if (!lui || entretien !== lui) return
    lui.arreter()
    entretien = null
    releve.chaudes(false)
  }
}

/** Un joueur est là (une route d'API, `server.ts`) : ses connexions restent chaudes. */
export function noterUneDemande() {
  entretien?.demande()
}

/** Vrai si l'entretien tourne pour ce processus. */
export function connexionsGardeesChaudes(): boolean {
  return entretien !== null
}

/**
 * Ce que demande `QUIZ_DB_KEEPWARM` : `1` les garde chaudes, `0` ou rien
 * s'en passe ; autre chose, un refus qui dit quoi écrire.
 */
export function chaudesDemandees(texte: string | undefined): { chaudes: boolean } | { refus: string } {
  const lu = texte?.trim().toLowerCase()
  if (!lu || ['0', 'non', 'false'].includes(lu)) return { chaudes: false }
  if (['1', 'oui', 'true'].includes(lu)) return { chaudes: true }
  return {
    refus:
      `QUIZ_DB_KEEPWARM illisible (« ${texte!.trim()} ») : 1 pour garder les connexions vers la base chaudes tant que des joueurs jouent, 0 ou rien pour s’en passer. ` +
      'Elles se referment après 4 s de calme, comme le fait Node.',
  }
}

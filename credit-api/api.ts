// L'API d'Anthropic, une seule fois : le crédit offert, dépensé sur la base de
// la campagne (`relire.ts`, `generer.ts`), puis ce dossier s'en va. Le dépôt
// n'a ni clé ni SDK, et les garde ainsi (le choix du 10 octobre 2026, confirmé
// le 13 : un seul passage, jamais d'autre) — rien d'ici n'entre dans server/.
//
// La clé se lit dans FIESTAPP_ANTHROPIC_KEY, jamais dans ANTHROPIC_API_KEY :
// Claude Code lit ce nom-là pour lui-même, et ses propres sessions se seraient
// payées sur le crédit au lieu du forfait. Tout passe par des lots (Message
// Batches) : moitié prix, rendus en minutes ou en heures. Derrière le proxy
// d'une session cloud, le `fetch` de Node ne le suit qu'avec
// NODE_USE_ENV_PROXY=1.

import Anthropic from '@anthropic-ai/sdk'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const VARIABLE_DE_LA_CLE = 'FIESTAPP_ANTHROPIC_KEY'

/**
 * Opus relit, toujours. Les agents du dépôt font écrire Sonnet, pour ménager
 * le forfait (`.claude/agents/`) ; ici le crédit le permet, et Opus écrit
 * aussi par défaut — moins de faits faux à retirer ensuite (`--redacteur=sonnet`
 * pour moitié prix).
 */
export const MODELES = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' } as const

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

/**
 * Dollars par million de jetons, hors lot — entrée, sortie (la pensée
 * comprise), lecture et écriture du cache. Un lot coûte la moitié. Une
 * estimation pour tenir le budget, pas une facture : la console fait foi.
 */
export const TARIFS: Readonly<Record<string, { entree: number; sortie: number; lecture: number; ecriture: number }>> = {
  'claude-sonnet-5-5': { entree: 2, sortie: 10, lecture: 0.2, ecriture: 2.5 },
  'claude-opus-5-5': { entree: 4, sortie: 20, lecture: 0.2, ecriture: 5 },
}

/** Une recherche sur le web : dix dollars les mille, sans remise de lot. */
export const PRIX_D_UNE_RECHERCHE = 0.01

/** Ce que coûte une réponse rendue par un lot, en dollars. */
export function coutDUnMessage(m: Pick<Anthropic.Message, 'model' | 'usage'>): number {
  // La réponse redit le modèle demandé, parfois suivi d'une précision : le tarif est celui de son nom.
  const cle = Object.keys(TARIFS).find(k => m.model === k || m.model.startsWith(`${k}-`))
  const t = cle ? TARIFS[cle] : undefined
  if (!t) throw new Error(`Tarif inconnu pour ${m.model} : ajoute-le à TARIFS.`)
  const u = m.usage
  const jetons = u.input_tokens * t.entree + u.output_tokens * t.sortie + (u.cache_read_input_tokens ?? 0) * t.lecture + (u.cache_creation_input_tokens ?? 0) * t.ecriture
  return (jetons / 1e6) * 0.5 + (u.server_tool_use?.web_search_requests ?? 0) * PRIX_D_UNE_RECHERCHE
}

/**
 * Ce qu'une demande coûtera, au pire raisonnable : l'entrée comptée à trois
 * caractères par jeton (le français en fait un peu plus), la sortie annoncée
 * par l'appelant. De quoi refuser d'envoyer un lot qui ferait passer le
 * budget, avant de le payer.
 */
export function coutPrevu(d: Demande, sortieAttendue: number, recherches = 0): number {
  const t = TARIFS[d.params.model]
  if (!t) throw new Error(`Tarif inconnu pour ${d.params.model}.`)
  const entree = JSON.stringify(d.params.system ?? '').length + JSON.stringify(d.params.messages).length
  return (((entree / 3) * t.entree + sortieAttendue * t.sortie) / 1e6) * 0.5 + recherches * PRIX_D_UNE_RECHERCHE
}

// ── Les lots ──────────────────────────────────────────────────────────────

/** Une demande d'un lot : `id` la retrouve, les lots ne gardent pas l'ordre. */
export interface Demande {
  id: string
  params: Anthropic.MessageCreateParamsNonStreaming
}

/** Ce qu'une demande a rendu : sa réponse (payée), et ce qui la rend inutilisable s'il y a lieu. */
export interface Rendu {
  message?: Anthropic.Message
  erreur?: string
}

export interface LotLu {
  fini: boolean
  /** Où il en est, pour l'écran : « 12 en cours, 30 rendues ». */
  resume: string
  resultats: Map<string, Rendu>
}

/** Ce que les scripts demandent à l'API : envoyer un lot, le relire. Les épreuves en donnent une fausse. */
export interface API {
  envoyer(demandes: readonly Demande[]): Promise<string>
  lire(id: string): Promise<LotLu>
}

/** Ce qui compose l'identifiant d'une demande, et rien d'autre (la règle de l'API). */
const ID_DE_DEMANDE = /^[a-zA-Z0-9_-]{1,64}$/

function client(): Anthropic {
  const cle = process.env[VARIABLE_DE_LA_CLE]
  if (!cle) {
    throw new Error(
      `${VARIABLE_DE_LA_CLE} manque : la clé de l'API d'Anthropic, ajoutée aux variables de l'environnement cloud (une nouvelle session la lit). Jamais sous ANTHROPIC_API_KEY, que Claude Code prendrait pour lui.`,
    )
  }
  // L'adresse et le jeton dits ici, pas lus dans l'environnement : celui d'une
  // session Claude Code en porte pour elle-même (ANTHROPIC_BASE_URL, parfois
  // ANTHROPIC_AUTH_TOKEN), qui n'ont rien à faire dans ces requêtes.
  return new Anthropic({ apiKey: cle, authToken: null, baseURL: 'https://api.anthropic.com' })
}

/** Une panne de réseau derrière un proxy dit quoi faire, plutôt que « fetch failed ». */
async function auReseau<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f()
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionError && process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== '1') {
      throw new Error('Appel impossible : derrière un proxy, relance avec NODE_USE_ENV_PROXY=1.')
    }
    throw e
  }
}

/** Ce qui rend une réponse inutilisable, même payée : coupée, refusée, en pause. */
function defautDe(m: Anthropic.Message): string | undefined {
  if (m.stop_reason === 'max_tokens') return 'coupée : max_tokens atteint'
  if (m.stop_reason === 'refusal') return `refusée par le modèle (${m.stop_details?.category ?? 'sans catégorie'})`
  if (m.stop_reason === 'pause_turn') return 'en pause : trop de recherches en un tour'
  return undefined
}

export function apiReelle(): API {
  const c = client()
  return {
    async envoyer(demandes) {
      for (const d of demandes) if (!ID_DE_DEMANDE.test(d.id)) throw new Error(`Identifiant de demande invalide : ${d.id}`)
      const lot = await auReseau(() => c.messages.batches.create({ requests: demandes.map(d => ({ custom_id: d.id, params: d.params })) }))
      return lot.id
    },
    async lire(id) {
      const lot = await auReseau(() => c.messages.batches.retrieve(id))
      const n = lot.request_counts
      const resume = `${n.processing} en cours, ${n.succeeded} rendue(s), ${n.errored} en erreur, ${n.expired} expirée(s)`
      const resultats = new Map<string, Rendu>()
      if (lot.processing_status !== 'ended') return { fini: false, resume, resultats }
      for await (const r of await auReseau(() => c.messages.batches.results(id))) {
        const res = r.result
        if (res.type === 'succeeded') resultats.set(r.custom_id, { message: res.message, erreur: defautDe(res.message) })
        else if (res.type === 'errored') resultats.set(r.custom_id, { erreur: `${res.error.error.type} : ${res.error.error.message}` })
        else resultats.set(r.custom_id, { erreur: res.type === 'expired' ? 'expirée (vingt-quatre heures passées)' : 'annulée' })
      }
      return { fini: true, resume, resultats }
    },
  }
}

// ── Ce qu'on lit d'une réponse ───────────────────────────────────────────

/** Le texte d'une réponse, sans la pensée ni les recherches. */
export function texteDe(m: Pick<Anthropic.Message, 'content'>): string {
  return m.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

/**
 * Le JSON d'une réponse : tel quel ; sinon le dernier bloc ```json qui se lit ;
 * sinon du premier crochet au dernier — un tableau entouré d'une phrase, ce
 * qu'un modèle ajoute parfois malgré la consigne. Rien, s'il n'y en a pas.
 */
export function jsonDe(texte: string): unknown {
  const lire = (s: string) => {
    try {
      return JSON.parse(s) as unknown
    } catch {
      return undefined
    }
  }
  const t = texte.trim()
  const direct = lire(t)
  if (direct !== undefined) return direct
  const blocs = [...t.matchAll(/```(?:json)?[ \t]*\n?([\s\S]*?)```/g)].map(m => m[1].trim()).reverse()
  for (const b of blocs) {
    const v = lire(b)
    if (v !== undefined) return v
  }
  for (const [ouvre, ferme] of [
    ['[', ']'],
    ['{', '}'],
  ]) {
    const i = t.indexOf(ouvre)
    const j = t.lastIndexOf(ferme)
    if (i >= 0 && j > i) {
      const v = lire(t.slice(i, j + 1))
      if (v !== undefined) return v
    }
  }
  return undefined
}

// ── Le carnet des dépenses ───────────────────────────────────────────────

/**
 * Tout ce que l'outillage garde — le carnet, l'état de chaque relecture et
 * de chaque génération, les brouillons —, dans ce dossier, commité au fil du
 * passage : un conteneur cloud qui s'en va n'emporte pas les identifiants des
 * lots payés. Il part avec le dossier, avant la fusion. Les lots de la
 * campagne, eux, attendent leur rangement où ils ont toujours attendu
 * (`.lots-campagne/`, que git ignore).
 */
export const DOSSIER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'etat')

/** Le budget par défaut : le crédit, moins une marge pour ce qu'une estimation rate. */
export const BUDGET = 190

export interface LotEnvoye {
  /** L'identifiant du lot chez Anthropic : sans lui, ce qu'il a payé se perd. */
  id: string
  /** Qui l'a envoyé, pour quoi : « relire base », « generer a1 ». */
  pour: string
  envoye: string
  demandes: number
  /** Son coût prévu, avant d'être rendu ; mesuré ensuite. */
  prevu: number
  recu?: string
  cout?: number
}

export interface Carnet {
  lots: LotEnvoye[]
}

export function lireLeCarnet(dossier = DOSSIER): Carnet {
  const f = path.join(dossier, 'carnet.json')
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Carnet) : { lots: [] }
}

export function ecrireLeCarnet(c: Carnet, dossier = DOSSIER) {
  mkdirSync(dossier, { recursive: true })
  writeFileSync(path.join(dossier, 'carnet.json'), `${JSON.stringify(c, null, 2)}\n`)
}

/** Dépensé (les lots rendus, à leur coût mesuré) et engagé (ceux en route, à leur coût prévu). */
export function depenses(c: Carnet): { depense: number; engage: number } {
  let depense = 0
  let engage = 0
  for (const l of c.lots) {
    if (l.cout !== undefined) depense += l.cout
    else engage += l.prevu
  }
  return { depense, engage }
}

/** Refuse un lot qui ferait passer le budget : ce qui est dépensé, ce qui est en route, et lui. */
export function verifierLeBudget(c: Carnet, prevu: number, budget: number) {
  const { depense, engage } = depenses(c)
  if (depense + engage + prevu > budget) {
    throw new Error(
      `Budget : ${dollars(depense)} dépensés, ${dollars(engage)} en route, et ce lot en coûterait ${dollars(prevu)} — plus que ${dollars(budget)}. Réduis-le, ou relève --budget si le crédit le permet.`,
    )
  }
}

/**
 * Un seul `avancer` à la fois : deux, lancés par mégarde, enverraient chacun
 * le même lot — payé deux fois. Le verrou dit le processus qui le tient ; un
 * verrou d'un processus mort se reprend. Rend de quoi le lâcher.
 */
export function verrouiller(dossier = DOSSIER): () => void {
  mkdirSync(dossier, { recursive: true })
  const f = path.join(dossier, 'verrou')
  try {
    writeFileSync(f, String(process.pid), { flag: 'wx' })
  } catch {
    const pid = Number(readFileSync(f, 'utf8'))
    let vivant = false
    try {
      process.kill(pid, 0)
      vivant = pid !== process.pid
    } catch {
      vivant = false
    }
    if (vivant) throw new Error(`Un autre « avancer » tourne déjà (processus ${pid}) : attends-le, ou arrête-le.`)
    writeFileSync(f, String(process.pid))
  }
  return () => rmSync(f, { force: true })
}

export const dollars = (x: number) => `${x.toFixed(2)} $`
export const maintenant = () => new Date().toISOString()
export const pause = (ms: number) => new Promise(ok => setTimeout(ok, ms))

/** Les options d'une ligne de commande : `--cle=valeur` ou `--drapeau`, et les mots. */
export function lireLesOptions(args: readonly string[], permises: readonly string[]): { mots: string[]; options: Map<string, string> } {
  const options = new Map<string, string>()
  const mots: string[] = []
  for (const a of args) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a)
    if (!m) mots.push(a)
    else if (!permises.includes(m[1])) throw new Error(`Option inconnue : --${m[1]} (${permises.map(k => `--${k}`).join(', ') || 'aucune'}).`)
    else options.set(m[1], m[2] ?? 'oui')
  }
  return { mots, options }
}

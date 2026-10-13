// Ce qu'on dit aux modèles, et ce qu'on lit de leurs réponses.
//
// Le rédacteur reçoit la consigne de la base telle que la routine du matin
// la reçoit (`consigneDEcriture`, sorte « routine ») : elle non plus n'a
// ni outil ni vérificateur, elle écrit d'un coup puis reçoit chaque refus avec
// son motif. Le correcteur juge comme l'agent du dépôt : son jugement se lit
// dans `.claude/agents/relecteur-campagne.md` même, pas dans une copie qui
// finirait par dire autre chose. Le vérificateur des doutes cherche sur le
// web, sources à l'appui.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import { SERVEUR } from '../server/src/racine'
import { ETIQUETTES_ECARTEES } from '../server/src/core/baseCampagne'
import { consigneCommune, consigneDEcriture, type QuotaDEcriture } from '../server/src/core/consigneCampagne'
import { CATEGORIES, categorieDe, type Categorie } from '../shared/categories'
import { ETIQUETTES, SOUS_THEMES } from '../shared/etiquettes'
import { lireNombre } from '../shared/nombres'
import { MODELES, jsonDe, texteDe, type Demande, type Effort } from './api'

// ── Le rédacteur ─────────────────────────────────────────────────────────

export const SYSTEME_DU_REDACTEUR = `Tu écris des questions de quiz pour la base de la campagne solo de FiestApp, un quiz joué sur téléphone par des francophones.

La consigne qui suit dit tout : le format JSON, chaque champ, les règles, deux exemples, et les intitulés que tes sous-thèmes ont déjà, à ne pas reprendre. Tu n'as aucun outil : ta réponse tient lieu du fichier dont elle parle, et ce qui parle de lancer un vérificateur ne te concerne pas — le juge de la base relit chaque question après toi, puis un correcteur.

- Rends uniquement le tableau JSON : ni phrase avant ou après, ni bloc de code.
- N'écris que des faits dont tu es certain ; une question qui te ferait hésiter, tu ne l'écris pas.
- Ne fais pas de plan : écris directement.`

/** Ce qu'un lot demande : sa part, ce que ses sous-thèmes ont déjà, et s'il se joue aussi au plus près. */
export interface LotAEcrire {
  categorie: Categorie
  quotas: readonly QuotaDEcriture[]
  deja: readonly string[]
  nombres?: boolean
}

export function consigneDuLot(l: LotAEcrire): string {
  return consigneDEcriture(l.categorie, l.quotas, { sorte: 'routine' }, l.deja, { nombres: l.nombres })
}

/** La sortie d'un rédacteur : une question en JSON fait trois cents jetons, la pensée basse quelques milliers. */
export const SORTIE_PAR_QUESTION = 450

function parametresDuRedacteur(contenu: string, maxTokens: number, modele: string): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: modele,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    // La réflexion basse de l'agent du dépôt : héritée de la session, la première vague coûtait quatre mille jetons de sortie par question.
    output_config: { effort: 'low' },
    system: SYSTEME_DU_REDACTEUR,
    messages: [{ role: 'user', content: contenu }],
  }
}

export function demandeDEcriture(id: string, l: LotAEcrire, modele: string = MODELES.opus): Demande {
  return { id, params: parametresDuRedacteur(consigneDuLot(l), 32000, modele) }
}

/** Une question que le juge refuse, telle qu'on la redit au rédacteur. */
export interface Refus {
  texte: string
  sousTheme: string
  difficulte: unknown
  motif: string
}

/**
 * Le tour de correction : la même consigne, puis ce que le juge garde et ce
 * qu'il refuse, avec chaque motif — ce que la routine reçoit à l'envoi. Une
 * conversation neuve plutôt qu'une suite : rien à renvoyer de la pensée du
 * premier tour, et la consigne reste la même en tête.
 */
export function demandeDeCorrection(id: string, l: LotAEcrire, gardees: readonly string[], refusees: readonly Refus[], modele: string = MODELES.opus): Demande {
  const juge = `LE JUGE A RELU TON LOT
Il garde celles-ci — n'en reprends aucune, même reformulée ou retournée :
${gardees.map(t => `- ${t}`).join('\n') || '- (aucune)'}

Il refuse celles-là, chacune avec son motif :
${refusees.map(r => `- [${r.sousTheme}, difficulté ${String(r.difficulte)}] « ${r.texte} » — ${r.motif}`).join('\n')}

Écris une question pour remplacer chaque refusée : le même sous-thème, la même difficulté, et un autre fait quand le motif dit que la base le pose déjà. Rends seulement le tableau JSON ${refusees.length === 1 ? 'de cette remplaçante' : `de ces ${refusees.length} remplaçantes`}.`
  return { id, params: parametresDuRedacteur(`${consigneDuLot(l)}\n${juge}`, 16000, modele) }
}

/** Les questions d'une réponse de rédacteur : un tableau, ou rien. */
export function questionsDe(m: Pick<Anthropic.Message, 'content'>): unknown[] | null {
  const v = jsonDe(texteDe(m))
  if (Array.isArray(v)) return v
  const dedans = (v as { questions?: unknown } | undefined)?.questions
  return Array.isArray(dedans) ? dedans : null
}

// ── Le correcteur ────────────────────────────────────────────────────────

const AGENT_RELECTEUR = path.join(SERVEUR, '..', '.claude/agents/relecteur-campagne.md')

/**
 * Le jugement de l'agent correcteur, lu dans son fichier : qui il est et ce
 * qu'il lit (`intro`), ce qu'il juge (`criteres`), et les deux décisions qu'il
 * rend (`decisions`) — sans ce qui ne vaut que pour un agent (écrire avec
 * Write, n'ouvrir que sa fiche).
 */
export function jugementDuRelecteur(fichier = AGENT_RELECTEUR): { intro: string; criteres: string; decisions: string } {
  const corps = readFileSync(fichier, 'utf8')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .trim()
  const paragraphes = corps.split(/\n\s*\n/)
  const i = paragraphes.findIndex(p => p.startsWith('Pour chaque question, juge'))
  const j = paragraphes.findIndex(p => p.startsWith('Écris tes décisions'))
  if (i < 1 || j < i) throw new Error(`${fichier} : le jugement du correcteur ne se lit plus (« Pour chaque question, juge », puis « Écris tes décisions »).`)
  const decisions = paragraphes[j]
    .split('\n')
    .filter(l => l.startsWith('- '))
    .join('\n')
  if (!decisions.includes('"retirer"') || !decisions.includes('"corriger"')) throw new Error(`${fichier} : les décisions « retirer » et « corriger » ne se lisent plus.`)
  return { intro: paragraphes.slice(0, i).join('\n\n'), criteres: paragraphes.slice(i, j).join('\n\n'), decisions }
}

/** Comment rendre ses décisions par l'API : l'objet du schéma, une entrée par question à changer. */
const RENDRE = `Rends tes décisions dans l'objet JSON demandé, sous la clé decisions : une entrée par question à changer, et rien pour les questions justes. ref est la référence de la question, telle qu'entre crochets sur la fiche ; champs vaut null pour un retrait, et dans une correction, seuls les champs corrigés sont remplis — les autres valent null.`

const SOBRE = `Sois sobre : ne commente pas les questions justes, ne réfléchis longuement qu'à celles qui te font hésiter.`

/**
 * Ce que la consigne d'écriture dit du classement, relu dans la consigne
 * même — ses étiquettes et leurs définitions, ses règles de partage —, et
 * les sous-thèmes avec leur nom : un correcteur qui juge le classement juge
 * avec les règles qu'avait le rédacteur.
 */
export function reglesDuClassement(): string {
  const consigne = consigneCommune({ sorte: 'routine' })
  const section = (debut: string, fin: string) => {
    const i = consigne.indexOf(`\n${debut}`)
    const j = consigne.indexOf(`\n${fin}`, i + 1)
    if (i < 0 || j < 0) throw new Error(`La consigne d'écriture n'a plus sa section « ${debut} », suivie de « ${fin} ».`)
    return consigne.slice(i, j).trim()
  }
  const regle = consigne.split('\n').find(l => l.startsWith('- etiquettes :'))
  if (!regle) throw new Error(`La consigne d'écriture n'a plus sa ligne « - etiquettes : ».`)
  const sousThemes = CATEGORIES.map(c => `- ${c} : ${SOUS_THEMES[c].map(s => `${s.cle} (${s.nom})`).join(', ')}`).join('\n')
  return [
    `LES CATÉGORIES ET LEURS SOUS-THÈMES — clé (nom)\n${sousThemes}`,
    `CE QUE LA CONSIGNE D'ÉCRITURE DIT DES ÉTIQUETTES\n${regle}`,
    section('LES ÉTIQUETTES', 'LES RÈGLES DE PARTAGE'),
    section('LES RÈGLES DE PARTAGE', 'COMMENT TRAVAILLER'),
  ].join('\n\n')
}

/**
 * Le correcteur d'un lot qui vient d'être écrit (`lots`) — l'agent du dépôt
 * tel quel : dans le doute, on retire, la base est grande. Ou le second
 * correcteur de la base (`base`), qui relit des questions déjà relues une
 * fois : il ne retire que ce dont il est sûr, et met en doute le reste, qu'un
 * vérificateur tranche sur le web — onze mille questions retirées au moindre
 * soupçon, c'est la moitié d'une catégorie perdue pour rien. Lui juge aussi
 * le classement (le souhait du propriétaire du 13 octobre 2026) : catégorie,
 * sous-thème, étiquettes — ce qui range une question dans un sentier, une
 * série ou un thème.
 */
export function systemeDuRelecteur(sorte: 'lots' | 'base', j = jugementDuRelecteur()): string {
  if (sorte === 'lots') return [j.intro, j.criteres, `${RENDRE}\n${j.decisions}`, SOBRE].join('\n\n')
  const classement = `6. est-elle bien classée ? Sa catégorie et son sous-thème d'après les règles de partage, plus bas — c'est le savoir demandé qui décide —, et chacune de ses étiquettes à la lettre de sa définition.`
  const base = `Cette base a déjà été relue une fois, question par question : tu en es la seconde relecture, et ce que la première a laissé passer est ce que tu cherches — un fait faux, un fait qui a changé depuis, une mauvaise réponse qui serait juste aussi, une question mal classée. Chaque question a pour référence son identifiant, entre crochets, et sa première ligne dit aussi sa catégorie et ses étiquettes : « [id] Catégorie › sous-thème · étiquettes : … · d3 · 10 ans ».
${RENDRE}
- retirer — seulement quand tu en es certain : une bonne réponse fausse, une mauvaise réponse juste aussi, une question ambiguë, deux questions de la fiche sur le même fait (retire la seconde).
- corriger — seulement quand tu es certain de la correction, sous les clés texte (l'intitulé), anecdote, explication et difficulte (un entier de 1 à 5). Ne corrige jamais une réponse : une réponse fausse retire la question.
- corriger aussi pour reclasser, sous les clés categorie (son nom exact, tel que dans la liste) et sousTheme (sa clé) — toujours les deux ensemble, même quand seul le sous-thème change —, et etiquettes (la liste entière, de zéro à trois clés). Seulement quand c'est net : un savoir à cheval sur deux catégories reste où il est, une étiquette discutable ne se touche pas.
- douter — un fait que tu crois faux ou périmé sans pouvoir l'affirmer : un second correcteur le vérifiera sur le web, sources à l'appui. Dis dans motif, précisément, ce qu'il faut vérifier ; s'il faut aussi la reclasser, mets le classement dans champs.

Une ligne « ⚠ racine » signale une bonne réponse que l'intitulé souffle par un mot de même racine (« Qui a peint Les Deux Fridas ? » → Frida Kahlo) : reformule l'intitulé (corriger texte) pour ne plus la souffler, sans changer ni le fait ni la réponse — ou ne dis rien si la parenté est voulue et fait la question (« une strophe de quatre vers » → Un quatrain).`
  return [j.intro, `${j.criteres}\n${classement}`, base, reglesDuClassement(), SOBRE].join('\n\n')
}

const OU_NUL = (type: 'string' | 'integer') => ({ anyOf: [{ type }, { type: 'null' }] })

/** Les étiquettes qu'une question peut porter : celles du catalogue, sauf ce que la campagne écarte. */
const CLES_DES_ETIQUETTES = ETIQUETTES.flatMap(f => f.etiquettes.map(e => e.cle)).filter(k => !ETIQUETTES_ECARTEES.includes(k))
const CLES_DES_SOUS_THEMES = [...new Set(Object.values(SOUS_THEMES).flatMap(l => l.map(s => s.cle)))]

/** Le schéma des décisions : la réponse se lit sans faute, l'API s'en porte garante — et un reclassement ne nomme que ce qui existe. */
export function schemaDesDecisions(actions: readonly string[], { classement = false } = {}) {
  const champs: Record<string, unknown> = { texte: OU_NUL('string'), anecdote: OU_NUL('string'), explication: OU_NUL('string'), difficulte: OU_NUL('integer') }
  if (classement) {
    champs.categorie = { anyOf: [{ type: 'string', enum: [...CATEGORIES] }, { type: 'null' }] }
    champs.sousTheme = { anyOf: [{ type: 'string', enum: CLES_DES_SOUS_THEMES }, { type: 'null' }] }
    champs.etiquettes = { anyOf: [{ type: 'array', items: { type: 'string', enum: CLES_DES_ETIQUETTES } }, { type: 'null' }] }
  }
  return {
    type: 'object',
    properties: {
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string' },
            action: { type: 'string', enum: [...actions] },
            champs: { anyOf: [{ type: 'null' }, { type: 'object', properties: champs, required: Object.keys(champs), additionalProperties: false }] },
            motif: { type: 'string' },
          },
          required: ['ref', 'action', 'champs', 'motif'],
          additionalProperties: false,
        },
      },
    },
    required: ['decisions'],
    additionalProperties: false,
  }
}

/** Une fiche de cent questions : quelques dizaines de jetons de décisions et de pensée par question. */
export const SORTIE_PAR_QUESTION_RELUE = 120

/** La consigne du second correcteur, la même pour toutes ses fiches : lue une fois, et gardée en cache chez Anthropic d'une demande à l'autre. */
let systemeDeLaBase: string | undefined

/**
 * L'agent relit les lots à réflexion basse ; la seconde relecture de la base
 * cherche ce que la première a manqué, et pense davantage — elle ne se fera
 * qu'une fois.
 */
export const EFFORT_DE_RELECTURE: Readonly<Record<'lots' | 'base', Effort>> = { lots: 'low', base: 'high' }

export function demandeDeRelecture(id: string, fiche: string, sorte: 'lots' | 'base', effort: Effort = EFFORT_DE_RELECTURE[sorte]): Demande {
  const base = sorte === 'base'
  return {
    id,
    params: {
      model: MODELES.opus,
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort,
        format: { type: 'json_schema', schema: base ? schemaDesDecisions(['retirer', 'corriger', 'douter'], { classement: true }) : schemaDesDecisions(['retirer', 'corriger']) },
      },
      system: base ? [{ type: 'text', text: (systemeDeLaBase ??= systemeDuRelecteur('base')), cache_control: { type: 'ephemeral' } }] : systemeDuRelecteur('lots'),
      messages: [{ role: 'user', content: `La fiche de relecture :\n\n${fiche}` }],
    },
  }
}

/** Ce qu'une correction de contenu change ; et ce qu'un reclassement change. */
export const CHAMPS_DE_CONTENU = ['texte', 'anecdote', 'explication', 'difficulte'] as const
export const CHAMPS_DE_CLASSEMENT = ['categorie', 'sousTheme', 'etiquettes'] as const

export type Champs = Record<string, string | number | string[]>

/**
 * Les champs d'une correction, parmi ceux permis, non vides : une difficulté
 * de 1 à 5, une catégorie du catalogue, des étiquettes en liste (vide : plus
 * aucune) ; rien, s'il n'en reste aucun.
 */
export function champsLus(brut: unknown, permis: readonly string[] = CHAMPS_DE_CONTENU): Champs | undefined {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return undefined
  const lus: Champs = {}
  for (const [k, v] of Object.entries(brut as Record<string, unknown>)) {
    const cle = k === 'intitule' || k === 'intitulé' ? 'texte' : k === 'difficulté' ? 'difficulte' : k === 'catégorie' ? 'categorie' : k
    if (!permis.includes(cle) || v === null || v === undefined) continue
    if (cle === 'difficulte') {
      const n = typeof v === 'number' ? v : lireNombre(String(v))
      if (n !== null && Number.isInteger(n) && n >= 1 && n <= 5) lus.difficulte = n
    } else if (cle === 'categorie') {
      const c = categorieDe(v)
      if (c) lus.categorie = c
    } else if (cle === 'etiquettes') {
      if (Array.isArray(v)) lus.etiquettes = [...new Set(v.filter((e): e is string => typeof e === 'string').map(e => e.trim()))]
    } else if (typeof v === 'string' && v.trim()) lus[cle] = v.trim()
  }
  return Object.keys(lus).length > 0 ? lus : undefined
}

export interface DecisionLue {
  ref: string
  action: 'retirer' | 'corriger' | 'douter'
  champs?: Champs
  motif: string
}

/**
 * Les décisions d'un correcteur, celles qui visent une question de sa fiche
 * et disent quoi faire : une correction sans champ qui se corrige ne change
 * rien, et s'écarte avec les références inconnues. Un doute garde le
 * reclassement qui l'accompagne. Rien, si la réponse ne se lit pas.
 */
export function decisionsDe(m: Pick<Anthropic.Message, 'content'>, refs: ReadonlySet<string>, { classement = false } = {}): { decisions: DecisionLue[]; ecartees: number } | null {
  const v = jsonDe(texteDe(m)) as { decisions?: unknown } | undefined
  if (!v || !Array.isArray(v.decisions)) return null
  const permis = classement ? [...CHAMPS_DE_CONTENU, ...CHAMPS_DE_CLASSEMENT] : CHAMPS_DE_CONTENU
  const decisions: DecisionLue[] = []
  for (const brut of v.decisions as Record<string, unknown>[]) {
    if (!brut || typeof brut !== 'object') continue
    const ref = String(brut.ref ?? '').replace(/[\s[\]]/g, '')
    const nue = refs.has(ref) ? ref : ref.replace(/^([A-Za-z0-9]+-\d+)#/, '$1.json#')
    if (!refs.has(nue)) continue
    const motif = typeof brut.motif === 'string' ? brut.motif : ''
    if (brut.action === 'retirer') decisions.push({ ref: nue, action: 'retirer', motif })
    else if (brut.action === 'douter') {
      const reclasse = classement ? champsLus(brut.champs, CHAMPS_DE_CLASSEMENT) : undefined
      decisions.push({ ref: nue, action: 'douter', ...(reclasse ? { champs: reclasse } : {}), motif })
    } else if (brut.action === 'corriger') {
      const champs = champsLus(brut.champs, permis)
      if (champs) decisions.push({ ref: nue, action: 'corriger', champs, motif })
    }
  }
  return { decisions, ecartees: v.decisions.length - decisions.length }
}

// ── Le vérificateur des doutes ───────────────────────────────────────────

export const SYSTEME_DU_VERIFICATEUR = `Tu es le second correcteur de la base de questions de FiestApp, un quiz joué sur téléphone par des francophones, surtout des adultes en France. Un premier correcteur a mis en doute une question, et dit pourquoi. Une question fausse serait vue par des milliers de joueurs.

Vérifie sur le web ce qui tranche — Wikipédia en français ou en anglais d'abord, puis des sources sérieuses (encyclopédies, institutions, presse de référence) : la bonne réponse est-elle exacte, aujourd'hui, et la seule possible ? Chaque mauvaise réponse est-elle certainement fausse ? L'anecdote et l'explication sont-elles exactes ? Deux ou trois recherches suffisent d'ordinaire.

Termine ta réponse par un seul bloc \`\`\`json, cet objet :
{"verdict": "garder" | "corriger" | "retirer", "champs": null | {"texte": …, "anecdote": …, "explication": …, "difficulte": …}, "motif": "…", "sources": ["adresse", …]}
- garder : les sources confirment la question telle quelle ; champs vaut null.
- corriger : la bonne réponse tient, mais l'intitulé, l'anecdote, l'explication ou la difficulté (un entier de 1 à 5) est à reprendre — ne mets dans champs que ce qui change, en entier. Jamais une réponse.
- retirer : la bonne réponse est fausse ou discutable, une mauvaise réponse est juste aussi, les sources se contredisent, ou tu ne trouves rien de sûr. Dans le doute, on retire : la base est grande.`

/** Une vérification : quelques recherches, et leurs pages lues, qui pèsent dans l'entrée. */
export const RECHERCHES_PAR_DOUTE = 3

export function demandeDeVerification(id: string, carte: string, doute: string): Demande {
  return {
    id,
    params: {
      model: MODELES.opus,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEME_DU_VERIFICATEUR,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: `La question :\n\n${carte}\n\nLe doute du premier correcteur : ${doute}` }],
    },
  }
}

export interface Verdict {
  action: 'garder' | 'corriger' | 'retirer'
  /** Le contenu seulement : le classement, c'est la première passe qui le juge. */
  champs?: Champs
  motif: string
  sources: string[]
}

/** Le verdict d'un vérificateur ; rien, s'il ne se lit pas — une correction sans champ qui se corrige n'en est pas une. */
export function verdictDe(m: Pick<Anthropic.Message, 'content'>): Verdict | null {
  const v = jsonDe(texteDe(m)) as Record<string, unknown> | undefined
  if (!v || typeof v !== 'object') return null
  const motif = typeof v.motif === 'string' ? v.motif : ''
  const sources = Array.isArray(v.sources) ? v.sources.filter((s): s is string => typeof s === 'string') : []
  if (v.verdict === 'garder' || v.verdict === 'retirer') return { action: v.verdict, motif, sources }
  if (v.verdict === 'corriger') {
    const champs = champsLus(v.champs)
    return champs ? { action: 'corriger', champs, motif, sources } : null
  }
  return null
}

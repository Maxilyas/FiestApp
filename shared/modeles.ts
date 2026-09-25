// Les modèles à personnaliser : « Pour qui ? ».
//
// Le modèle « Qui connaît le mieux [Prénom] ? » se personnalisait à la main :
// neuf « [Prénom] », trois « il/elle » et un « né·e » à retaper un à un —
// 35 gestes avant même de penser aux réponses, et un prénom oublié partait au
// mur tel quel. Un prénom (deux pour un couple) et un accord suffisent
// maintenant : tout est remplacé, titre compris. Les réponses, elles, restent
// marquées ✏️ — seul l'animateur les connaît —, et la question attend qu'on
// les écrive (`trouDans`, `shared/library.ts`).

import { tronquer } from './avatars'
import { PRENOM_A_ECRIRE } from './library'

/** Comment s'accordent les mots d'un modèle : « née » ou « né ». « neutre » garde l'écriture inclusive. */
export type Accord = 'elle' | 'il' | 'neutre'

export const ACCORDS: readonly Accord[] = ['elle', 'il', 'neutre']

/** Un prénom de modèle : court, sans retour à la ligne, et jamais un crochet qui referait un trou. */
export const MAX_PRENOM = 30

export interface PourQui {
  /** Le prénom de la personne fêtée — ou les deux prénoms d'un couple, dans l'ordre du modèle. */
  prenoms: string[]
  accord: Accord
}

/** Ce qu'un modèle demande pour se personnaliser : combien de prénoms. */
export interface APersonnaliser {
  prenoms: 1 | 2
}

/**
 * Le rayon d'un modèle : « fete », un quiz à écrire pour quelqu'un — ses
 * réponses, seul l'animateur les connaît — ; « jeu », un quiz qui se joue
 * tel quel, et montre ce que l'application sait faire.
 */
export type Rayon = 'fete' | 'jeu'

/** Un modèle tel que « Partir d'un modèle » le liste. */
export interface ModeleResume {
  id: string
  title: string
  questionCount: number
  /** Une phrase qui dit à quoi il sert. */
  description?: string
  personnaliser?: APersonnaliser
  rayon: Rayon
}

/** Lit la demande d'un navigateur : null si un prénom manque ou si rien ne se lit. */
export function lirePourQui(brut: unknown, attendus: number): PourQui | null {
  const b = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : null
  if (!b || !Array.isArray(b.prenoms)) return null
  const prenoms = b.prenoms
    .slice(0, attendus)
    .map(p => (typeof p === 'string' ? tronquer(p.replace(/[\s[\]]+/g, ' ').trim(), MAX_PRENOM).trim() : ''))
  if (prenoms.length < attendus || prenoms.some(p => !p)) return null
  const accord = ACCORDS.includes(b.accord as Accord) ? (b.accord as Accord) : 'neutre'
  return { prenoms, accord }
}

/** Les mots inclusifs d'un modèle, accordés : « il/elle » et les finales « ·e ». */
function accorder(texte: string, accord: Accord): string {
  if (accord === 'neutre') return texte
  return texte
    .replace(/\bil\/elle\b/g, accord)
    .replace(/\bIl\/elle\b/g, accord === 'elle' ? 'Elle' : 'Il')
    .replace(/(\p{L})·e(s?)\b/gu, (_, lettre: string, pluriel: string) => (accord === 'elle' ? `${lettre}e${pluriel}` : `${lettre}${pluriel}`))
}

/** Un texte du modèle, pour qui on l'a demandé. */
export function pourQuiLeTexte(texte: string, pourQui: PourQui): string {
  const avecPrenoms = texte.replace(PRENOM_A_ECRIRE, (trou: string, rang?: string) => {
    const i = rang ? Number(rang) - 1 : 0
    return pourQui.prenoms[i] ?? trou
  })
  return accorder(avecPrenoms, pourQui.accord)
}

/**
 * Le modèle, pour qui on l'a demandé : le titre et chaque texte — intitulé,
 * réponses, unité, photo attendue. Rien d'autre ne change.
 */
export function personnaliser<Q extends Record<string, unknown>>(
  titre: string,
  questions: readonly Q[],
  pourQui: PourQui,
): { titre: string; questions: Q[] } {
  const texte = (v: unknown) => (typeof v === 'string' ? pourQuiLeTexte(v, pourQui) : v)
  return {
    titre: pourQuiLeTexte(titre, pourQui),
    questions: questions.map(q => ({
      ...q,
      text: texte(q.text),
      unit: texte(q.unit),
      photoAttendue: texte(q.photoAttendue),
      ...(Array.isArray(q.answers) && { answers: q.answers.map(texte) }),
    })),
  }
}

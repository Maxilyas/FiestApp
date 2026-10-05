// Nano Banana, par l'API Gemini : ce que les essais anime partagent
// (`essai.ts`, `styles.ts`). Une requête, des images et une consigne ; une
// image en retour, et ce qu'elle a coûté en jetons.
//
// La clé est lue dans GEMINI_API_KEY et passe en en-tête, jamais dans
// l'adresse. Derrière un proxy, le `fetch` de Node ne le suit qu'avec
// NODE_USE_ENV_PROXY=1.
import { readFileSync } from 'node:fs'

export interface Partie {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface Rendu {
  image: Buffer
  mime: string
  /** `usageMetadata` tel que l'API le rend : jetons d'entrée, de sortie, de pensée. */
  jetons: any
  secondes: number
}

/**
 * Le format d'une image, à ses premiers octets : selon le modèle, Nano Banana
 * rend du PNG ou du JPEG, et une image renvoyée comme étalon doit dire ce
 * qu'elle est.
 */
export function formatDe(b: Buffer): { mime: string; ext: string } {
  if (b[0] === 0xff && b[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return { mime: 'image/png', ext: 'png' }
}

export const enPartie = (f: string): Partie => {
  const b = readFileSync(f)
  return { inlineData: { mimeType: formatDe(b).mime, data: b.toString('base64') } }
}

const pause = (ms: number) => new Promise(ok => setTimeout(ok, ms))

/**
 * Les formats que Nano Banana Pro sait rendre. Le carré reste celui de tous
 * les médaillons ; les décors des thèmes peints sont des images en hauteur,
 * à la mesure d'un téléphone (`decors.ts`).
 */
export type FormatDImage = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

/** Ce qu'on demande d'une image : le carré par défaut, pour que rien ne change aux appelants d'avant le format. */
function configDImage(taille: string, format: FormatDImage = '1:1') {
  // Le premier Nano Banana (2.5) ne connaît pas de taille : une taille vide la retire.
  return { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: format, ...(taille ? { imageSize: taille } : {}) } }
}

/** Un appel à Nano Banana : des images et une consigne, une image en retour — carrée, sauf format demandé. */
export async function generer(
  parties: Partie[],
  { modele, taille, format }: { modele: string; taille: string; format?: FormatDImage },
): Promise<Rendu> {
  const cle = process.env.GEMINI_API_KEY
  if (!cle) throw new Error('GEMINI_API_KEY manque : la clé de l’API Gemini.')
  const corps = JSON.stringify({ contents: [{ role: 'user', parts: parties }], generationConfig: configDImage(taille, format) })
  // Une surcharge passagère (503) se réessaie ; un quota (429) jamais :
  // à l'offre gratuite, les modèles d'image ont un quota de zéro, et
  // insister n'y change rien.
  for (let essai = 1; ; essai++) {
    const t0 = Date.now()
    let rep: Response
    try {
      rep = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': cle, 'content-type': 'application/json' },
        body: corps,
      })
    } catch (e) {
      const proxy = process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== '1'
      throw new Error(proxy ? 'Appel impossible : derrière un proxy, relance avec NODE_USE_ENV_PROXY=1.' : `Appel impossible : ${(e as Error).message}`)
    }
    const texte = await rep.text()
    if (rep.status === 429 && texte.includes('free_tier')) {
      throw new Error(`${modele} refuse : la clé est sur l’offre gratuite, où les modèles d’image ont un quota de zéro. Active la facturation de son projet, puis relance.`)
    }
    if ((rep.status === 503 || rep.status === 500) && essai < 4) {
      console.log(`  ${modele} surchargé (${rep.status}), nouvel essai dans ${10 * essai} s`)
      await pause(10_000 * essai)
      continue
    }
    if (!rep.ok) throw new Error(`${modele} : HTTP ${rep.status} — ${texte.slice(0, 600)}`)
    const d = JSON.parse(texte)
    // Nano Banana Pro pense en images : ses brouillons (`thought`) précèdent la bonne, la dernière.
    const images: Partie[] = (d.candidates ?? [])
      .flatMap((c: any) => c.content?.parts ?? [])
      .filter((p: any) => p.inlineData && !p.thought)
    const derniere = images.at(-1)?.inlineData
    if (!derniere) throw new Error(`${modele} n’a rendu aucune image : ${texte.slice(0, 600)}`)
    return { image: Buffer.from(derniere.data, 'base64'), mime: derniere.mimeType, jetons: d.usageMetadata, secondes: (Date.now() - t0) / 1000 }
  }
}

// ── Les lots ──────────────────────────────────────────────────────────────
// Un lot part d'un coup et revient quand Google l'a traité — des minutes,
// parfois des heures —, pour la moitié du prix : ce qui compte quand les
// soixante-douze portraits tiennent dans vingt euros.

export interface Demande {
  /** Ce qui retrouve la réponse : les lots ne gardent pas l'ordre. */
  cle: string
  parties: Partie[]
  /** Son format, s'il n'est pas celui du lot : un même lot peut mêler carrés et décors en hauteur. */
  format?: FormatDImage
}

const API = 'https://generativelanguage.googleapis.com/v1beta'

async function appel(url: string, init: RequestInit = {}): Promise<any> {
  const cle = process.env.GEMINI_API_KEY
  if (!cle) throw new Error('GEMINI_API_KEY manque : la clé de l’API Gemini.')
  let rep: Response
  try {
    rep = await fetch(url, { ...init, headers: { 'x-goog-api-key': cle, 'content-type': 'application/json', ...(init.headers ?? {}) } })
  } catch (e) {
    const proxy = process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== '1'
    throw new Error(proxy ? 'Appel impossible : derrière un proxy, relance avec NODE_USE_ENV_PROXY=1.' : `Appel impossible : ${(e as Error).message}`)
  }
  const texte = await rep.text()
  if (!rep.ok) throw new Error(`HTTP ${rep.status} — ${texte.slice(0, 600)}`)
  return JSON.parse(texte)
}

/** Envoie un lot ; rend son nom (`batches/…`), qu'on relit ensuite. */
export async function lancerLot(
  demandes: Demande[],
  { modele, taille, nom, format }: { modele: string; taille: string; nom: string; format?: FormatDImage },
): Promise<string> {
  const requests = demandes.map(d => ({
    request: { contents: [{ role: 'user', parts: d.parties }], generationConfig: configDImage(taille, d.format ?? format) },
    metadata: { key: d.cle },
  }))
  const r = await appel(`${API}/models/${modele}:batchGenerateContent`, {
    method: 'POST',
    body: JSON.stringify({ batch: { displayName: nom, inputConfig: { requests: { requests } } } }),
  })
  if (!r.name) throw new Error(`Lot refusé : ${JSON.stringify(r).slice(0, 600)}`)
  return r.name
}

export interface EtatDuLot {
  etat: string
  fini: boolean
  /** Par clé : l'image rendue, ou la raison de son absence. */
  resultats: Map<string, Rendu | string>
}

/** Relit un lot : son état, et ses images une fois fini. */
export async function lireLot(nom: string): Promise<EtatDuLot> {
  const r = await appel(`${API}/${nom}`)
  const etat: string = r.metadata?.state ?? r.state ?? 'inconnu'
  const resultats = new Map<string, Rendu | string>()
  // La réponse range ses résultats selon la version de l'API : on les cherche aux deux places connues.
  const lignes: any[] =
    r.response?.inlinedResponses?.inlinedResponses ?? r.metadata?.output?.inlinedResponses?.inlinedResponses ?? r.response?.inlinedResponses ?? []
  for (const l of lignes) {
    const cle = l.metadata?.key ?? '?'
    if (l.error) {
      resultats.set(cle, `erreur ${l.error.code ?? ''} ${l.error.message ?? ''}`.trim())
      continue
    }
    const parties: any[] = (l.response?.candidates ?? []).flatMap((c: any) => c.content?.parts ?? [])
    const image = parties.filter(p => p.inlineData && !p.thought).at(-1)?.inlineData
    if (!image) {
      const raison = l.response?.candidates?.[0]?.finishReason ?? l.response?.promptFeedback?.blockReason ?? 'aucune image'
      resultats.set(cle, String(raison))
      continue
    }
    resultats.set(cle, { image: Buffer.from(image.data, 'base64'), mime: image.mimeType, jetons: l.response?.usageMetadata, secondes: 0 })
  }
  return { etat, fini: r.done === true || /SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(etat), resultats }
}

/**
 * Ce qu'un appel a coûté, en dollars, à partir de ses jetons. Les tarifs sont
 * ceux qu'on connaissait de Nano Banana Pro (entrée 2 $, texte et pensée
 * 12 $, image 120 $ le million de jetons) : une estimation pour tenir un
 * budget, pas une facture — la page des prix de Google fait foi. Un lot
 * coûte la moitié.
 */
export function coutEstime(jetons: any, { lot = false }: { lot?: boolean } = {}): number {
  if (!jetons) return 0
  const images = (jetons.candidatesTokensDetails ?? []).filter((d: any) => d.modality === 'IMAGE').reduce((n: number, d: any) => n + (d.tokenCount ?? 0), 0)
  const sortie = (jetons.candidatesTokenCount ?? 0) - images + (jetons.thoughtsTokenCount ?? 0)
  return (((jetons.promptTokenCount ?? 0) * 2 + sortie * 12 + images * 120) / 1e6) * (lot ? 0.5 : 1)
}

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

/** Un appel à Nano Banana : des images et une consigne, une image carrée en retour. */
export async function generer(parties: Partie[], { modele, taille }: { modele: string; taille: string }): Promise<Rendu> {
  const cle = process.env.GEMINI_API_KEY
  if (!cle) throw new Error('GEMINI_API_KEY manque : la clé de l’API Gemini.')
  const corps = JSON.stringify({
    contents: [{ role: 'user', parts: parties }],
    // Le premier Nano Banana (2.5) ne connaît pas de taille : une taille vide la retire.
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1', ...(taille ? { imageSize: taille } : {}) } },
  })
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

/**
 * Ce qu'un appel a coûté, en dollars, à partir de ses jetons. Les tarifs sont
 * ceux qu'on connaissait de Nano Banana Pro (entrée 2 $, texte et pensée
 * 12 $, image 120 $ le million de jetons) : une estimation pour tenir un
 * budget, pas une facture — la page des prix de Google fait foi.
 */
export function coutEstime(jetons: any): number {
  if (!jetons) return 0
  const images = (jetons.candidatesTokensDetails ?? []).filter((d: any) => d.modality === 'IMAGE').reduce((n: number, d: any) => n + (d.tokenCount ?? 0), 0)
  const sortie = (jetons.candidatesTokenCount ?? 0) - images + (jetons.thoughtsTokenCount ?? 0)
  return ((jetons.promptTokenCount ?? 0) * 2 + sortie * 12 + images * 120) / 1e6
}

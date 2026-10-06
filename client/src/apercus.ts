/**
 * Les aperçus des thèmes : l'écran d'une question, photographié dans
 * l'application sous chaque thème (`server/scripts/apercus-themes.ts`). Des
 * adresses seulement : une image ne part que si sa case se montre. La
 * boutique, « Mon thème » et « Ma collection » les montrent ; hors de Vite
 * (les tests rendent la page dans Node), des cases sans image.
 */
const APERCUS: Record<string, string> = import.meta.env
  ? import.meta.glob<string>('./themes/apercus/*.webp', { eager: true, query: '?url', import: 'default' })
  : {}

export const apercuDe = (cle: string): string | undefined => APERCUS[`./themes/apercus/${cle}.webp`]

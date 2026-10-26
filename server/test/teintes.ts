// Les couleurs des thèmes lues dans leurs feuilles, et le contraste WCAG qu'on
// en tire. Pas un fichier de tests : ceux qui jugent une couleur le partagent
// (`design.test.ts` pour tout le client, `cabinet-ecran.test.ts` pour le
// Cabinet) — un calcul retouché l'est pour chacun, et aucun n'en garde une
// copie qui vieillirait seule.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

/** Un thème : ses variables telles qu'écrites, `var(--autre)` compris. */
export type Jetons = Map<string, string>

const CLIENT = new URL('../../client/src/', import.meta.url)
const CSS = readFileSync(new URL('styles.css', CLIENT), 'utf8')

/** Les variables d'un bloc de thème, telles qu'écrites. */
export function jetonsDuBloc(css: string, ouverture: string): Jetons {
  const debut = css.indexOf(ouverture)
  assert.ok(debut >= 0, `le bloc ${ouverture} existe`)
  const corps = css.slice(debut, css.indexOf('\n}', debut))
  return new Map([...corps.matchAll(/^\s*(--[\w-]+|color-scheme):\s*([^;]+);/gm)].map(m => [m[1], m[2].trim()] as [string, string]))
}

// Ses couleurs se posent aussi sur un fond de carte, qui reste nocturne sous
// tous les thèmes ; ses formes et ses polices, sur la racine seule.
export const VELOURS: Jetons = new Map([...jetonsDuBloc(CSS, ':root, .carte-fond {'), ...jetonsDuBloc(CSS, ':root {')])
export const IVOIRE: Jetons = new Map([...VELOURS, ...jetonsDuBloc(CSS, ":root[data-theme='ivoire'] {")])

/**
 * Chaque thème qu'un profil peut porter : les deux offerts, puis chaque
 * feuille de `client/src/themes/`, posée sur le Velours comme la page la pose.
 */
export function themesDuClient(): { cle: string; jetons: Jetons; css: string }[] {
  const dossier = new URL('themes/', CLIENT)
  return [
    { cle: 'velours', jetons: VELOURS, css: CSS },
    { cle: 'ivoire', jetons: IVOIRE, css: CSS },
    ...readdirSync(dossier)
      .filter(f => f.endsWith('.css'))
      .sort()
      .map(f => {
        const cle = f.replace(/\.css$/, '')
        const css = readFileSync(new URL(f, dossier), 'utf8')
        return { cle, css, jetons: new Map([...VELOURS, ...jetonsDuBloc(css, `:root[data-theme='${cle}'] {`)]) }
      }),
  ]
}

/** La couleur d'un jeton, `var(--autre)` suivi jusqu'à un #rrggbb. */
export function teinte(theme: Jetons, nom: string): string {
  let valeur = theme.get(nom)
  for (let i = 0; valeur && i < 5; i++) {
    const renvoi = /^var\((--[\w-]+)\)$/.exec(valeur)
    if (!renvoi) break
    valeur = theme.get(renvoi[1])
  }
  assert.match(valeur ?? '', /^#[0-9a-f]{6}$/i, `${nom} se résout en une couleur`)
  return valeur!
}

/** Une couleur `rgba(…)` posée sur un fond opaque : la carte telle qu'on la voit. */
export function surFond(couleur: string, fond: string): string {
  const m = /^rgba?\(([^)]+)\)$/.exec(couleur)
  if (!m) return couleur
  const [r, g, b, a = 1] = m[1].split(',').map(Number)
  const f = [1, 3, 5].map(i => parseInt(fond.slice(i, i + 2), 16))
  return '#' + [r, g, b].map((c, i) => Math.round(a * c + (1 - a) * f[i]).toString(16).padStart(2, '0')).join('')
}

/** Le contraste WCAG entre deux couleurs. */
export function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, v] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * v
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

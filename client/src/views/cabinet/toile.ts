// Ce que la carte de la traversée écrit et trace sur ses toiles 2D, avant que three.js n'en fasse des textures
// (`TraverseeEn3D.ts`). À part, et sans three.js : ses épreuves l'importent seul (`cabinet-toile.test.ts`).
//
// Tout ce qu'un navigateur ne dessine pas comme Chromium sur une toile a sa fonction ici, et la carte n'écrit ni ne trace
// autrement : rien de la carte en 3D ne s'essaie sans un iPhone, et c'est sur un iPhone qu'elle a montré ses médailles
// vides (le retour du propriétaire, le 16 novembre 2026).

/** Les polices d'emoji, celle de chaque système : la médaille d'une épreuve s'écrit avec. */
export const EMOJI_POLICE = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'

/** L'or pâle des titres de la carte. */
export const OR_PALE = '#f7dc9a'

/**
 * Un texte sur une toile, d'une encre pleine — le seul passage vers `fillText` (`cabinet-toile.test.ts` relit le client).
 *
 * L'encre se donne à chaque texte, en couleur : écrit à la suite d'un tracé, un texte gardait l'encre qui traînait, et
 * la médaille d'une épreuve écrivait son emoji sous le dégradé de son disque. Chromium ne lit pas l'encre pour un emoji,
 * il le dessine dans ses couleurs ; WebKit — tout navigateur d'un iPhone — n'écrit pas un texte dont l'encre est un
 * dégradé ou un motif : il en fait un pochoir, et peint le dégradé à travers. L'emoji sortait en silhouette, peinte du
 * dégradé même du disque sous lui : une médaille sombre et vide, à toutes les épreuves et chez le marchand (« Icône
 * noire sauf pour le coffre », le 16 novembre 2026 — le coffre est une image, le gardien aussi).
 */
export function ecrire(g: CanvasRenderingContext2D, texte: string, x: number, y: number, encre: string): void {
  g.fillStyle = encre
  g.fillText(texte, x, y)
}

/**
 * Le tracé d'une pastille aux coins ronds, à remplir ou à border. Par quatre arcs, que toute toile sait tracer :
 * `roundRect` n'existe dans Safari que depuis sa version 16, et sur un iPhone d'avant l'appel lève — à la première
 * étiquette, dans l'effet qui construit la carte, et une exception dans un effet emporte toute la page.
 */
export function pastille(g: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + l, y, x + l, y + h, r)
  g.arcTo(x + l, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + l, y, r)
  g.closePath()
}

/**
 * La médaille d'une épreuve ou du marchand, sur une toile de 256 pixels : un disque à la teinte de l'acte, son liseré
 * d'or, l'emoji du jeu dessus.
 */
export function dessinerLaMedaille(g: CanvasRenderingContext2D, emoji: string, teinte: number): void {
  const d = g.createRadialGradient(128, 110, 10, 128, 128, 120)
  d.addColorStop(0, `hsl(${teinte} 45% 30%)`)
  d.addColorStop(1, `hsl(${teinte} 55% 10%)`)
  g.beginPath()
  g.arc(128, 128, 116, 0, Math.PI * 2)
  g.fillStyle = d
  g.fill()
  const o = g.createLinearGradient(0, 0, 256, 256)
  o.addColorStop(0, '#fff1c4')
  o.addColorStop(0.5, '#c8963f')
  o.addColorStop(1, '#fbe3a0')
  g.lineWidth = 10
  g.strokeStyle = o
  g.stroke()
  g.font = `118px ${EMOJI_POLICE}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // L'or pâle, pas le dégradé du disque resté sur la toile. Un emoji garde ses couleurs sous une encre pleine ; et un
  // signe qu'une police rendrait au trait, sans couleurs, se lirait encore, clair sur le disque sombre.
  ecrire(g, emoji, 128, 138, OR_PALE)
}

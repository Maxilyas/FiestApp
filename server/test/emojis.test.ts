// Aucun emoji d'après Unicode 12 : l'écran commun tourne sous Windows 10, qui
// affiche les plus récents en carré vide — devant toute la salle. La règle
// est écrite dans CLAUDE.md ; ce test la garde (81 emojis le 24 septembre
// 2026, tous conformes : c'est le prochain qu'on surveille).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

// Les points de code d'Emoji 13.0 et au-delà (emoji-data.txt d'Unicode) —
// la table du script `emojis.mjs` de la tablée. Le moteur d'expressions de
// Node connaît tous les emojis, mais pas l'année de chacun.
const RECENTS: [number, number][] = [
  // Emoji 13.0
  [0x1f6d6, 0x1f6d7], [0x1f6fb, 0x1f6fc], [0x1f90c, 0x1f90c], [0x1f972, 0x1f972], [0x1f977, 0x1f978],
  [0x1f9a3, 0x1f9a4], [0x1f9ab, 0x1f9ad], [0x1f9cb, 0x1f9cb], [0x1fa74, 0x1fa74], [0x1fa83, 0x1fa86],
  [0x1fa96, 0x1faa8], [0x1fab0, 0x1fab6], [0x1fac0, 0x1fac2], [0x1fad0, 0x1fad6], [0x26a7, 0x26a7],
  // Emoji 14.0 et suivants
  [0x1f6dc, 0x1f6df], [0x1f7f0, 0x1f7f0], [0x1f979, 0x1f979], [0x1f9cc, 0x1f9cc], [0x1fa75, 0x1fa77],
  [0x1fa7b, 0x1fa7c], [0x1fa87, 0x1fa89], [0x1fa8f, 0x1fa8f], [0x1faa9, 0x1faaf], [0x1fab7, 0x1fabf],
  [0x1fac3, 0x1facf], [0x1fad7, 0x1fadf], [0x1fae0, 0x1faef], [0x1faf0, 0x1faff],
]
// Des séquences d'Emoji 13.0 et 13.1 faites de points de code anciens : un
// ours et un flocon, séparés par un liant, font un carré vide sous Windows 10.
const SEQUENCES_RECENTES = ['🐻‍❄', '🐈‍⬛', '🐦‍⬛', '❤️‍🔥', '❤️‍🩹', '😮‍💨', '😵‍💫', '😶‍🌫', '🧑‍🎄', '👩‍🍼', '👨‍🍼', '🧑‍🍼', '🏳️‍⚧', '🧔‍♀', '🧔‍♂']

const EMOJI = /\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}️?)*/gu

/** Les fichiers d'un dossier du dépôt que la salle peut voir s'afficher. */
function fichiers(dossier: string): { nom: string; texte: string }[] {
  const racine = new URL(`../../${dossier}/`, import.meta.url)
  return (readdirSync(racine, { recursive: true }) as string[])
    .filter(f => /\.(tsx?|css|html)$/.test(f))
    .map(f => ({ nom: `${dossier}/${f}`, texte: readFileSync(new URL(f.replace(/\\/g, '/'), racine), 'utf8') }))
}

test('aucun emoji d’après Unicode 12 dans ce que la salle peut voir', () => {
  const fautifs: string[] = []
  const vus = new Set<string>()
  // Le serveur aussi : ses toasts et ses prix s'affichent au mur.
  for (const { nom, texte } of [...fichiers('client/src'), ...fichiers('shared'), ...fichiers('server/src')]) {
    // Un commentaire ne s'affiche nulle part — et il cite parfois l'emoji
    // qu'on a retiré, pour dire pourquoi.
    const affichable = texte
      .split('\n')
      .map(l => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l))
      .join('\n')
    for (const m of affichable.matchAll(EMOJI)) {
      const e = m[0]
      const points = [...e].map(c => c.codePointAt(0)!)
      // ©, ®, ↔ : des symboles de texte, sans variante emoji en cause.
      if (points.length === 1 && points[0] < 0x2000) continue
      vus.add(e)
      const recent = points.some(p => RECENTS.some(([a, b]) => p >= a && p <= b))
      const sequence = SEQUENCES_RECENTES.some(s => e.replace(/️/g, '').includes(s.replace(/️/g, '')))
      if (recent || sequence) {
        const ligne = affichable.slice(0, m.index).split('\n').length
        fautifs.push(`${e} (U+${points.map(p => p.toString(16).toUpperCase()).join(' U+')}) — ${nom}:${ligne}`)
      }
    }
  }
  assert.deepEqual(fautifs, [], 'ces emojis s’afficheraient en carré vide sous Windows 10')
  assert.ok(vus.size > 50, `les emojis sont bien trouvés (${vus.size})`)
})

test('la garde reconnaît un emoji récent', () => {
  // Qu'elle ne passe pas à vide : 🥲 (Emoji 13.0), 🫠 (14.0), l'ours polaire.
  for (const e of ['🥲', '🫠', '🐻‍❄️']) {
    const points = [...e].map(c => c.codePointAt(0)!)
    const recent = points.some(p => RECENTS.some(([a, b]) => p >= a && p <= b))
    const sequence = SEQUENCES_RECENTES.some(s => e.replace(/️/g, '').includes(s.replace(/️/g, '')))
    assert.ok(recent || sequence, e)
  }
  assert.ok(!RECENTS.some(([a, b]) => 0x1f98a >= a && 0x1f98a <= b), '🦊 (Emoji 3.0) passe')
})

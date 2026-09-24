// Chaque emoji du client et de shared/, face à la règle « antérieurs à
// Unicode 13 » (Windows 10 affiche les plus récents en carré vide).
// Les points de code d'Emoji 13.0 et au-delà sont listés ici en dur (tables
// d'Unicode, emoji-data.txt) ; les séquences ZWJ sont signalées à part, car
// une séquence de 13.x peut n'utiliser que des points de code anciens
// (🐻‍❄️, 🐈‍⬛, ❤️‍🔥, 😮‍💨).
// Usage, depuis la racine du dépôt :
//   node retours/2026-09-24/experts/scripts/design-systeme/emojis.mjs [--tout]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RECENTS = [
  // Emoji 13.0
  [0x1f6d6, 0x1f6d7], [0x1f6fb, 0x1f6fc], [0x1f90c, 0x1f90c], [0x1f972, 0x1f972], [0x1f977, 0x1f978],
  [0x1f9a3, 0x1f9a4], [0x1f9ab, 0x1f9ad], [0x1f9cb, 0x1f9cb], [0x1fa74, 0x1fa74], [0x1fa83, 0x1fa86],
  [0x1fa96, 0x1faa8], [0x1fab0, 0x1fab6], [0x1fac0, 0x1fac2], [0x1fad0, 0x1fad6], [0x26a7, 0x26a7],
  // Emoji 14.0 et suivants
  [0x1f6dc, 0x1f6df], [0x1f7f0, 0x1f7f0], [0x1f979, 0x1f979], [0x1f9cc, 0x1f9cc], [0x1fa75, 0x1fa77],
  [0x1fa7b, 0x1fa7c], [0x1fa87, 0x1fa89], [0x1fa8f, 0x1fa8f], [0x1faa9, 0x1faaf], [0x1fab7, 0x1fabf],
  [0x1fac3, 0x1facf], [0x1fad7, 0x1fadf], [0x1fae0, 0x1faef], [0x1faf0, 0x1faff],
]
// Séquences ZWJ d'Emoji 13.0/13.1 faites de points de code anciens.
const SEQUENCES_RECENTES = ['🐻‍❄️', '🐈‍⬛', '🐦‍⬛', '❤️‍🔥', '❤️‍🩹', '😮‍💨', '😵‍💫', '😶‍🌫️', '🧑‍🎄', '👩‍🍼', '👨‍🍼', '🧑‍🍼', '🏳️‍⚧️', '🧔‍♀️', '🧔‍♂️']
const recent = (cp) => RECENTS.some(([a, b]) => cp >= a && cp <= b)

const fichiers = []
const parcourir = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) parcourir(p)
    else if (/\.(tsx?|css|html)$/.test(f)) fichiers.push(p)
  }
}
parcourir('client/src')
parcourir('shared')
parcourir('server/src')

const reEmoji = /(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}️?)*)|\p{Regional_Indicator}{2}/gu
const trouves = new Map()
for (const f of fichiers) {
  const lignes = readFileSync(f, 'utf8').split('\n')
  lignes.forEach((l, i) => {
    // Les commentaires comptent aussi peu que possible : on les signale à part.
    const commentaire = /^\s*(\/\/|\*|\/\*)/.test(l)
    for (const m of l.matchAll(reEmoji)) {
      const e = m[0]
      const cps = [...e].map((c) => c.codePointAt(0))
      // Les symboles texte sans variante emoji (©, ®, ™, ↔…) ne sont pas en cause.
      if (cps.length === 1 && cps[0] < 0x2000) continue
      const cle = e
      if (!trouves.has(cle)) trouves.set(cle, { e, cps, lieux: [], commentaire: true })
      const t = trouves.get(cle)
      t.lieux.push(`${f}:${i + 1}`)
      if (!commentaire) t.commentaire = false
    }
  })
}

const tous = [...trouves.values()].filter((t) => !t.commentaire)
const suspects = tous.filter((t) => t.cps.some(recent) || SEQUENCES_RECENTES.includes(t.e))
const sansVariante = tous.filter((t) => t.cps.length === 1 && t.cps[0] < 0x1f000)
console.log(`emojis distincts hors commentaires : ${tous.length} (dans ${fichiers.length} fichiers)`)
console.log(`postérieurs à Unicode 12 : ${suspects.length}`)
for (const t of suspects) console.log(`  ${t.e}  ${t.cps.map((c) => 'U+' + c.toString(16).toUpperCase()).join(' ')}  ${t.lieux.slice(0, 3).join(' ')}`)
console.log(`\nsymboles BMP sans sélecteur de variante (U+FE0F), rendus en texte ou en emoji selon la police :`)
for (const t of sansVariante) console.log(`  ${t.e}  U+${t.cps[0].toString(16).toUpperCase()}  ×${t.lieux.length}  ${t.lieux.slice(0, 2).join(' ')}`)
const zwj = tous.filter((t) => t.cps.includes(0x200d))
console.log(`\nséquences ZWJ : ${zwj.length}`)
for (const t of zwj) console.log(`  ${t.e}  ${t.lieux.slice(0, 2).join(' ')}`)
if (process.argv.includes('--tout')) {
  console.log('\ntous, par nombre de lieux :')
  for (const t of tous.sort((a, b) => b.lieux.length - a.lieux.length)) console.log(`  ${t.e} ×${t.lieux.length}  ${t.lieux.slice(0, 2).join(' ')}`)
}

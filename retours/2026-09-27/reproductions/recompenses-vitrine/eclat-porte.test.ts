// « Ce qui éclate, c'est ce qu'on porte » (`cibleEclat`,
// shared/legendaires.ts) : sous un légendaire, c'est lui qui brille ; sinon
// l'emoji. Chaque page qui calcule elle-même l'éclat d'un avatar porté —
// l'en-tête du profil, l'aperçu « Ce que la salle voit », l'entrée — passe
// par `cibleEclat`. Sauf « Mon profil joueur », à la page du compte
// (AccountApp.tsx) : `profil.eclats.includes(profil.avatar)`. Sous un
// légendaire, il montre la version rare du médaillon quand c'est l'emoji
// caché qui a éclaté, et la version ordinaire quand c'est le légendaire.
//
// Une garde, comme `emojis.test.ts` : tout `<Avatar … legendaire=…>` dont
// l'éclat se calcule au client (`eclats.includes(…)`) passe par `cibleEclat`.
// Elle passe le jour où la page du compte le fait aussi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

test('l’éclat d’un avatar porté se calcule partout par cibleEclat', () => {
  const racine = new URL('../../../client/src/', import.meta.url)
  const fautifs: string[] = []
  let vus = 0
  for (const f of readdirSync(racine, { recursive: true }) as string[]) {
    if (!f.endsWith('.tsx')) continue
    const texte = readFileSync(new URL(f.replace(/\\/g, '/'), racine), 'utf8')
    for (const m of texte.matchAll(/<Avatar\b[^>]*?\/>/gs)) {
      const el = m[0]
      if (!/legendaire=/.test(el) || !/eclats\.includes\(/.test(el)) continue
      vus++
      if (!/cibleEclat\(/.test(el)) {
        const ligne = texte.slice(0, m.index).split('\n').length
        fautifs.push(`client/src/${f}:${ligne}`)
      }
    }
  }
  assert.ok(vus >= 4, `la garde trouve les avatars portés (${vus})`)
  assert.deepEqual(fautifs, [], 'l’éclat s’y lit sur l’emoji même sous un légendaire')
})

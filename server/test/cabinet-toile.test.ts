// Ce que la carte de la traversée écrit sur ses toiles 2D (`client/src/views/cabinet/toile.ts`), avant que three.js n'en
// fasse des textures — là où WebKit ne dessine pas comme Chromium, et où rien ne s'essaie sans un iPhone.
//
// Le 16 novembre 2026, le propriétaire : « la visualisation des icônes sur iPhone ne fonctionne pas lors des traversées.
// Icône noire sauf pour le coffre. » La médaille d'une épreuve écrivait son emoji juste après avoir peint son disque, le
// dégradé du disque encore posé comme encre. Chromium ne lit pas l'encre pour un emoji : il le dessine dans ses couleurs.
// WebKit, lui, n'écrit pas un texte dont l'encre est un dégradé ou un motif : il en fait un pochoir et peint le dégradé à
// travers. L'emoji sortait donc en silhouette, peinte du dégradé même du disque sur lequel il était posé : un disque
// sombre et vide. Le coffre est une image chargée, le gardien un portrait collé, les étiquettes s'écrivent d'une couleur
// pleine : eux se voyaient.
//
// Sans navigateur : une fausse toile note l'encre posée à chaque texte écrit, et les sources du client sont relues — un
// texte de toile écrit ailleurs que par `ecrire` rouvrirait le piège. L'écran, lui, se regarde par
// `server/scripts/rendu-traversee.ts` (skill `regarder-le-rendu`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** Le module tel que la carte l'importe ; la toile en `unknown` : le serveur se vérifie sans les types du navigateur. */
const laToile = async () =>
  (await import(url('views/cabinet/toile.ts'))) as {
    ecrire(g: unknown, texte: string, x: number, y: number, encre: string): void
    pastille(g: unknown, x: number, y: number, l: number, h: number, r: number): void
    dessinerLaMedaille(g: unknown, emoji: string, teinte: number): void
  }

/** Un dégradé de la fausse toile : un objet, comme le vrai — jamais une chaîne. */
class Degrade {
  addColorStop() {}
}

/**
 * Une toile 2D qui ne dessine rien et note ce qui compte ici : chaque texte écrit et l'encre posée à cet instant, les
 * gestes faits dans l'ordre. `roundRect` y manque, comme sur un iPhone d'avant iOS 16.
 */
function fausseToile() {
  const ecrits: { texte: string; encre: unknown }[] = []
  const gestes: string[] = []
  const etat: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000' }
  const g = new Proxy(etat, {
    get(cible, cle) {
      if (typeof cle !== 'string') return undefined
      if (cle in cible) return cible[cle]
      if (cle === 'roundRect') return undefined
      if (cle === 'createRadialGradient' || cle === 'createLinearGradient') return () => new Degrade()
      if (cle === 'fillText' || cle === 'strokeText')
        return (texte: string) => {
          gestes.push(cle)
          ecrits.push({ texte, encre: cle === 'fillText' ? cible.fillStyle : cible.strokeStyle })
        }
      return () => void gestes.push(cle)
    },
    set(cible, cle, valeur) {
      cible[String(cle)] = valeur
      return true
    },
  })
  return { g, ecrits, gestes, etat }
}

/** La clarté d'une couleur `#rrggbb`, de 0 (noir) à 1 (blanc) : la luminance relative du WCAG. */
function clarte(couleur: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(couleur)
  assert.ok(m, `« ${couleur} » : une couleur pleine s'écrit #rrggbb`)
  const [r, v, b] = m.slice(1).map(x => {
    const c = parseInt(x, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * v + 0.0722 * b
}

test('la médaille d\'une épreuve écrit son emoji d\'une encre pleine, jamais du dégradé de son disque', async () => {
  const { dessinerLaMedaille } = await laToile()
  for (const [emoji, teinte] of [
    ['🎲', 152],
    ['💰', 268],
    ['❓', 14],
  ] as const) {
    const { g, ecrits, gestes } = fausseToile()
    dessinerLaMedaille(g, emoji, teinte)
    assert.deepEqual(
      ecrits.map(e => e.texte),
      [emoji],
      'la médaille écrit son emoji, une fois',
    )
    const { encre } = ecrits[0]
    // Le piège du 16 novembre 2026 : sous un dégradé, WebKit peint le dégradé à travers la silhouette de l'emoji.
    assert.ok(!(encre instanceof Degrade), `${emoji} : l'emoji s'écrit sous le dégradé du disque — sur iPhone, il sort en silhouette de ce dégradé, invisible sur lui`)
    assert.equal(typeof encre, 'string', `${emoji} : l'encre d'un texte de toile est une couleur pleine`)
    // Claire : un signe qu'une police rendrait au trait, sans ses couleurs, se lit encore sur le disque sombre.
    assert.ok(clarte(encre as string) > 0.5, `${emoji} : une encre sombre (${String(encre)}) se perdrait sur le disque de la médaille`)
    // Le disque et son liseré d'or sont peints avant l'emoji : il se pose sur eux.
    assert.ok(gestes.indexOf('fill') >= 0 && gestes.indexOf('fill') < gestes.indexOf('fillText'), 'le disque d\'abord, l\'emoji dessus')
    assert.ok(gestes.indexOf('stroke') >= 0 && gestes.indexOf('stroke') < gestes.indexOf('fillText'), 'le liseré d\'abord, l\'emoji dessus')
  }
})

test('« ecrire » pose son encre avant d\'écrire, quoi que la toile ait porté', async () => {
  const { ecrire } = await laToile()
  const { g, ecrits, etat } = fausseToile()
  etat.fillStyle = new Degrade()
  ecrire(g, 'Le Pari', 10, 20, '#f7dc9a')
  assert.deepEqual(ecrits, [{ texte: 'Le Pari', encre: '#f7dc9a' }])
})

test('la pastille d\'une étiquette se trace sans « roundRect », qu\'un iPhone d\'avant iOS 16 n\'a pas', async () => {
  const { pastille } = await laToile()
  const { g, gestes } = fausseToile()
  // Sur la fausse toile comme sur Safari 15, `roundRect` n'est pas une fonction : l'appeler lèverait, et la carte entière avec.
  assert.doesNotThrow(() => pastille(g, 2, 2, 300, 122, 30))
  assert.equal(gestes[0], 'beginPath', 'un tracé neuf : il ne prolonge pas celui d\'avant')
  assert.equal(gestes.filter(x => x === 'arcTo').length, 4, 'quatre coins arrondis')
  assert.equal(gestes[gestes.length - 1], 'closePath')
})

/** Les sources du client, chacune son texte. */
function sourcesDuClient(): { nom: string; texte: string }[] {
  const racine = new URL('../../client/src/', import.meta.url)
  return (readdirSync(racine, { recursive: true }) as string[])
    .map(f => f.replace(/\\/g, '/'))
    .filter(f => /\.tsx?$/.test(f))
    .map(f => ({ nom: f, texte: readFileSync(new URL(f, racine), 'utf8') }))
}

test('aucun texte de toile ne s\'écrit hors de « ecrire », et rien ne trace par « roundRect »', () => {
  const fautifs: string[] = []
  for (const { nom, texte } of sourcesDuClient()) {
    texte.split('\n').forEach((ligne, k) => {
      // Un texte écrit à la main garde l'encre qui traînait sur la toile — un dégradé, et l'iPhone le rend en silhouette.
      if (nom !== 'views/cabinet/toile.ts' && /\.(fillText|strokeText)\s*\(/.test(ligne)) fautifs.push(`${nom}:${k + 1} écrit sur une toile sans passer par « ecrire » (views/cabinet/toile.ts)`)
      // Safari n'a `roundRect` que depuis sa version 16 : avant, l'appel lève et emporte ce qui se dessinait.
      if (/\.roundRect\s*\(/.test(ligne)) fautifs.push(`${nom}:${k + 1} trace par « roundRect », qu'iOS 15 n'a pas : « pastille » (views/cabinet/toile.ts)`)
    })
  }
  assert.deepEqual(fautifs, [])
})

test('la carte en 3D dessine ses médailles et ses étiquettes par ce module', () => {
  const carte = readFileSync(new URL('../../client/src/views/cabinet/TraverseeEn3D.ts', import.meta.url), 'utf8')
  for (const f of ['dessinerLaMedaille', 'ecrire', 'pastille']) assert.match(carte, new RegExp(`\\b${f}\\(`), `TraverseeEn3D.ts n'appelle plus « ${f} »`)
})

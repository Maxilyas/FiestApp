// Un nombre tapé par un humain — l'estimation d'un invité, la cible de
// l'animateur, la ligne « = … » d'un import — se lit d'une seule façon, comme
// on l'écrit en France : `shared/nombres.ts`, sans navigateur ni serveur.
//
// Le téléphone lisait par `Number(texte.replace(',', '.'))` : « 35 000 », tel
// que la révélation l'affiche, valait NaN, et le formulaire se taisait —
// l'invité croyait avoir répondu. L'éditeur relisait sa cible à chaque
// touche : la virgule de « 0,8 » disparaissait, et la cible devenait 8.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireNombre } from '../../shared/nombres'

test('une estimation se lit comme on l’écrit en France', () => {
  const lus: [string, number][] = [
    ['35 000', 35000],
    ['35 000', 35000], // insécable
    ['35 000', 35000], // fine insécable, celle de la révélation
    ['35 000', 35000], // fine, glissée par un clavier
    ['35  000', 35000], // deux espaces tapées de suite
    ['2 100 000', 2100000],
    ["1'234", 1234],
    ['35000', 35000],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1 234,5', 1234.5],
    ['0,8', 0.8],
    ['-40', -40],
    ['−40', -40],
    ['+5', 5],
    ['  42 ', 42],
    ['007', 7],
    // Un nombre qu'on est en train de taper : la virgule attend sa décimale.
    ['12,', 12],
  ]
  for (const [texte, attendu] of lus) assert.equal(lireNombre(texte), attendu, JSON.stringify(texte))
})

test('ce qui ne se lit pas sans deviner ne se lit pas', () => {
  // Le téléphone le dit à l'invité, plutôt que d'envoyer autre chose que ce
  // qu'il a voulu dire : « 10 93 » n'est ni 10 ni 1 093, « 1,000,000 » n'est
  // pas un nombre français, et « 15OO » a pris la lettre O pour un zéro.
  const illisibles = ['', ' ', '-', ',', 'abc', '10 93', '1,000,000', '15OO', '35 000 communes', 'environ 300', '1e3', '0x10', 'Infinity']
  for (const texte of illisibles) assert.equal(lireNombre(texte), null, JSON.stringify(texte))
})

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = path.join(dossier, nom)
    if (statSync(chemin).isDirectory()) return nom === 'node_modules' || nom === 'dist' ? [] : sources(chemin)
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

test('le client ne lit plus un nombre tapé avec replace(\',\', \'.\')', () => {
  const fautifs = sources(path.join(racine, 'client/src'))
    .filter(f => /\.replace\(\s*['"],['"]\s*,\s*['"]\.['"]\s*\)/.test(readFileSync(f, 'utf8')))
    .map(f => path.relative(racine, f))
  assert.deepEqual(fautifs, [], 'un nombre tapé se lit avec lireNombre (shared/nombres.ts)')
})

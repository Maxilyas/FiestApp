// La vitrine (`docs/vitrine/`) part telle quelle sur GitHub Pages
// (`.github/workflows/vitrine.yml`), servie sous `/FiestApp/` : rien ne la
// construit, et rien ne la relisait. Une capture renommée par
// `rendu-vitrine.ts`, un chemin qui commence par `/`, et la page en ligne
// montrait un trou ; une image d'aperçu absente ou trop lourde, et le lien
// partagé sur WhatsApp arrivait sans image.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dossier = path.join(racine, 'docs/vitrine')
const page = readFileSync(path.join(dossier, 'index.html'), 'utf8')

/** Le contenu d'une balise `<meta property="…">` (ou `name`) de la page. */
function meta(nom: string): string | undefined {
  return new RegExp(`<meta (?:property|name)="${nom}" content="([^"]*)"`).exec(page)?.[1]
}

/** La largeur et la hauteur d'un JPEG, lues dans l'en-tête de sa trame (SOF). */
function tailleDuJpeg(octets: Buffer): { largeur: number; hauteur: number } {
  assert.ok(octets[0] === 0xff && octets[1] === 0xd8, 'ce n’est pas un JPEG')
  let i = 2
  while (i + 8 < octets.length) {
    const marqueur = octets[i + 1]
    // SOF0 à SOF15, sauf DHT (C4), JPG (C8) et DAC (CC), qui partagent leur plage.
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
      return { hauteur: octets.readUInt16BE(i + 5), largeur: octets.readUInt16BE(i + 7) }
    }
    i += 2 + octets.readUInt16BE(i + 2)
  }
  assert.fail('aucune trame dans ce JPEG')
}

test('chaque image et chaque lien de la vitrine restent dans le site publié', () => {
  const sortis: string[] = []
  for (const [, attribut, cible] of page.matchAll(/\b(src|href)="([^"]*)"/g)) {
    if (/^(https?:|mailto:|#)/.test(cible)) continue
    if (cible.startsWith('/') || !existsSync(path.join(dossier, cible.split('#')[0]))) sortis.push(`${attribut}="${cible}"`)
  }
  assert.deepEqual(sortis, [], 'un chemin relatif, vers un fichier de docs/vitrine/ : la page est servie sous /FiestApp/')
})

test('l’aperçu d’un lien partagé : une image publiée avec la page, à la taille dite, assez légère pour WhatsApp', () => {
  const site = meta('og:url')
  assert.ok(site && /^https:\/\/[^/]+\/(.*\/)?$/.test(site), `og:url : « ${site} », l'adresse complète de la vitrine`)
  for (const nom of ['og:title', 'og:description', 'og:image:alt']) assert.ok(meta(nom), `${nom} manque`)
  // WhatsApp ne lit qu'une adresse complète ; elle doit mener à un fichier
  // que le workflow publie, donc rangé dans docs/vitrine/.
  const image = meta('og:image') ?? ''
  assert.ok(image.startsWith(site), `og:image hors de la vitrine : « ${image} »`)
  const fichier = path.join(dossier, image.slice(site.length))
  assert.ok(existsSync(fichier), `${path.relative(racine, fichier)} n'existe pas`)
  const octets = readFileSync(fichier)
  // Au-delà, WhatsApp laisse l'aperçu sans image.
  assert.ok(octets.length <= 300 * 1024, `${path.relative(racine, fichier)} pèse ${Math.round(octets.length / 1024)} Ko`)
  assert.equal(meta('og:image:type'), 'image/jpeg')
  assert.deepEqual(tailleDuJpeg(octets), { largeur: Number(meta('og:image:width')), hauteur: Number(meta('og:image:height')) })
})

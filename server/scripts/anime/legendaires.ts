// Les légendaires et les Divins peints : l'essai de style.
//
// Les légendaires deviennent des illustrations de carte légendaire, pleine
// page, peintes à la feuille d'or — l'app pose par-dessus une pellicule holo
// vivante, plus intense encore quand il est éclaté. Les Divins deviennent des
// bijoux sacrés (or, émail, pierres), chacun sa silhouette, que l'app anime
// de lumière.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/legendaires.ts --lot
//
// Trois passes au plus : les images, puis ce qui part d'elles (la version
// rare, repeinte sur la même pose ; les découpes, sur un fond uni), puis le
// détourage et les fichiers de la démo (WebP). Une image payée n'est jamais
// redemandée ; le journal garde le coût de chacune.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { coutEstime, enPartie, formatDe, generer, lancerLot, lireLot, type Partie, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'

const args = process.argv.slice(2)
const LOT = args.includes('--lot')
const ATTENTE = Number(process.env.ATTENTE ?? 1800)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
const TAILLE = process.env.TAILLE ?? '1K'
const sortie = path.resolve('../export/legendaires/essai')
mkdirSync(sortie, { recursive: true })
const fichier = (nom: string) => path.join(sortie, nom)
const existant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`${nom}.${e}`)).find(f => existsSync(f))

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles des portraits. Un seul style pour les seize : une
// collection, comme un set de cartes — et aucun des douze styles des branches.

const CARTE =
  'Square illustration for a round avatar in a party quiz game: it must read instantly even as a tiny icon — one colossal creature with a bold, ' +
  'clear silhouette and a well-lit head, centered; the scene fills the whole square edge to edge: no round badge, no drawn circle, no frame, ' +
  'no border, no text, no letters, no signature, no watermark. Output one square image (1:1 aspect ratio).'

const LEGENDAIRE =
  'Style: epic fantasy full-art illustration for the rarest card of a collectible card game — a rich painterly digital painting with cinematic ' +
  'composition and scale, volumetric light and a glowing atmosphere, luminous saturated color against deep shadows, ultra detailed. Accents of real ' +
  'gold leaf and fine gilded filigree are woven into the design — the creature’s ornaments, the rims of the light, the edges of clouds and stars — ' +
  'so that a holographic foil will catch them. An original creature design: imitate no existing game, film or card.'

const OMBRE =
  'This is a legend of the shadows: the same epic finish, but darker and eerier — the gilding turns to tarnished silver and violet sheen.'

const RARE = (variante: string) =>
  'Edit the attached illustration into its rare variant, the one a player may find once in forty evenings: keep exactly the same composition, pose, ' +
  `framing, scale and level of detail, and change its colors and matter: ${variante} Same painterly style, same gold-leaf accents recolored to match. ` +
  'No text, no frame. Output one square image (1:1 aspect ratio).'

const DECOUPE = (garde: string, retirer: string) =>
  `Edit the attached image. Keep ${garde} exactly as it is — same pose, same position, same size, same outline, same colors and details, untouched. ` +
  'Replace everything else with a single perfectly flat, uniform chroma-key green (#00FF00) filling the canvas edge to edge: no gradient, no shadow, ' +
  `no glow, no texture on it. In particular, replace ${retirer} with the flat color. Do not move, resize, crop, redraw or restyle what you keep. ` +
  'Output one square image (1:1 aspect ratio).'

const BIJOU =
  'Style: a sacred emblem painted as a goldsmith’s masterpiece — solid polished gold, deep glowing enamel and faceted gemstones, fine filigree ' +
  'engraving, warm light gleaming on the metal; ultra detailed yet with a bold, instantly readable silhouette. Seen straight on, the emblem alone, ' +
  'centered, filling about 90% of the canvas. Background: a single perfectly flat, uniform chroma-key green (#00FF00) filling the entire canvas ' +
  'edge to edge — no shadow, no glow or light spilling onto it. Do not use any green on the emblem. No text, no letters, no numbers. ' +
  'Output one square image (1:1 aspect ratio).'

interface Travail {
  nom: string
  consigne: string
  /** L'image dont il part (repeinte, découpée) : il attend qu'elle existe. */
  source?: string
}

const TRAVAUX: Travail[] = [
  {
    nom: 'phenix',
    consigne: [
      CARTE,
      LEGENDAIRE,
      'Subject: the Phoenix — a colossal firebird bursting upward out of an erupting volcano under a night full of stars, its immense wings spread ' +
        'across the whole canvas; feathers of living flame turning into golden stars at their tips, a crown of white fire, blazing golden eyes, ' +
        'embers and gold-leaf sparks spiraling around it. Palette: blazing orange, gold and crimson against a deep indigo night.',
    ].join('\n\n'),
  },
  {
    nom: 'kraken',
    consigne: [
      CARTE,
      LEGENDAIRE,
      OMBRE,
      'Subject: the Kraken — a colossal abyssal titan rising from a black storm sea, its tentacles coiling around a sinking ghost ship lit by a ' +
        'single red lantern, one enormous glowing eye, lightning tearing a violet sky, spray catching the light. Palette: deep teal, black and violet, ' +
        'with the one red glow of the lantern.',
    ].join('\n\n'),
  },
  {
    nom: 'helios',
    consigne: [
      BIJOU,
      'Subject: the divine badge of Helios, god of the sun — a radiant sun disc with a serene golden face in high relief, crowned by a corona of ' +
        'sharp golden rays of different lengths that make its silhouette, rubies and topaz set around the face, a thin ring of deep blue enamel ' +
        'with tiny gold stars behind the face.',
    ].join('\n\n'),
  },
  {
    nom: 'phenix-rare',
    source: 'phenix',
    consigne: RARE(
      'the Phoenix becomes an ice phoenix — feathers of translucent crystal ice and cyan-white flame, silver and pale-gold gilding, an aurora sky ' +
        'of teal and violet above a volcano of blue fire.',
    ),
  },
  {
    nom: 'decoupe-phenix',
    source: 'phenix',
    consigne: DECOUPE('the Phoenix, its flaming wings and the flames and sparks right around its body', 'the volcano, the sky, the stars and the smoke'),
  },
  {
    nom: 'decoupe-kraken',
    source: 'kraken',
    consigne: DECOUPE('the Kraken — its head, its eye and all its tentacles', 'the sea, the ship, the lantern, the sky and the lightning'),
  },
]

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.resolve('../export/legendaires/journal-legendaires.json')
const lireJournal = (): any[] => (existsSync(cheminJournal) ? JSON.parse(readFileSync(cheminJournal, 'utf8')) : [])
function ranger(nom: string, r: Rendu, lot: boolean) {
  writeFileSync(fichier(`${nom}.${formatDe(r.image).ext}`), r.image)
  const journal = lireJournal()
  const cout = coutEstime(r.jetons, { lot })
  journal.push({ nom, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, lot, jetons: r.jetons, cout })
  writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
  console.log(`  ${nom} : environ ${cout.toFixed(3)} $ (total ${journal.reduce((n, e) => n + (e.cout ?? 0), 0).toFixed(2)} $)`)
}

// ── Le tout ───────────────────────────────────────────────────────────────

const cheminLots = path.resolve('../export/legendaires/lots-en-cours.json')
async function attendre(noms: string[]) {
  const t0 = Date.now()
  const restants = [...noms]
  while (restants.length) {
    for (const nom of [...restants]) {
      const l = await lireLot(nom)
      if (!l.fini) continue
      console.log(`lot ${nom} : ${l.etat} en ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      for (const [cle, r] of l.resultats) typeof r === 'string' ? console.log(`  ${cle} : ${r}`) : ranger(cle, r, true)
      restants.splice(restants.indexOf(nom), 1)
      writeFileSync(cheminLots, JSON.stringify(restants) + '\n')
    }
    if (!restants.length) return true
    if (Date.now() - t0 > ATTENTE * 1000) return false
    await new Promise(ok => setTimeout(ok, 20_000))
  }
  return true
}

const enCours = existsSync(cheminLots) ? JSON.parse(readFileSync(cheminLots, 'utf8') || '[]') : []
if (enCours.length && !(await attendre(enCours))) process.exit(0)

for (let passe = 1; passe <= 3; passe++) {
  const aFaire = TRAVAUX.filter(t => !existant(t.nom) && (!t.source || existant(t.source)))
  if (!aFaire.length) break
  const demandes = aFaire.map(t => {
    writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
    const parties: Partie[] = t.source ? [enPartie(existant(t.source)!), { text: t.consigne }] : [{ text: t.consigne }]
    return { cle: t.nom, parties }
  })
  console.log(`Passe ${passe} : ${aFaire.map(t => t.nom).join(', ')}`)
  if (LOT) {
    const nom = await lancerLot(demandes, { modele: MODELE, taille: TAILLE, nom: 'fiestapp-legendaires-essai' })
    writeFileSync(cheminLots, JSON.stringify([nom]) + '\n')
    console.log(`lot ${nom}`)
    if (!(await attendre([nom]))) process.exit(0)
  } else {
    for (const d of demandes) ranger(d.cle, await generer(d.parties, { modele: MODELE, taille: TAILLE }), false)
  }
}

// Les fichiers de la démo : l'illustration en 512, les détourés (découpes et
// badge) en 512 avec leur transparence.
function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'legendaires.js'))('playwright')
}
const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })
try {
  const page = await pagePixels(nav, 512)
  const enDataUrl = (f: string) => {
    const b = readFileSync(f)
    return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
  }
  const demo = path.join(sortie, 'demo')
  mkdirSync(demo, { recursive: true })
  for (const nom of ['phenix', 'phenix-rare', 'kraken']) {
    const f = existant(nom)
    if (!f) continue
    const w = await dansLaPage<string>(page, 'jpegReduit', enDataUrl(f), 640, 0.9)
    writeFileSync(path.join(demo, `${nom}.jpg`), deDataUrl(w))
  }
  // Le badge : détouré tel quel. Les créatures : leur illustration sous
  // l'opacité de leur découpe — la version rare garde la pose, elle prend la
  // découpe de l'autre.
  const helios = existant('helios')
  if (helios) {
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(helios), null, [0, 255, 0])
    const r = await dansLaPage<any>(page, 'assembler', { image: d.plein, disque: 1, cadre: [0, 100], tailles: [640], qualite: 0.9 })
    writeFileSync(path.join(demo, 'helios.webp'), deDataUrl(r.perso[640]))
    console.log(`  helios : fond ${d.fond}, ${(d.transparents * 100).toFixed(0)} % transparent${d.bordFaux ? ' ⚠ bord faux' : ''}`)
  }
  for (const [nom, decoupe] of [['phenix', 'decoupe-phenix'], ['phenix-rare', 'decoupe-phenix'], ['kraken', 'decoupe-kraken']]) {
    const image = existant(nom)
    const dec = existant(decoupe)
    if (!image || !dec) continue
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(dec), null, [0, 255, 0])
    // La version rare garde la pose mais change toutes ses couleurs : un
    // alignement par la couleur y déraillait (×1,066). Elle prend la découpe
    // de l'autre telle quelle.
    const a = nom.endsWith('-rare')
      ? { s: 1, dx: 0, dy: 0, ecart: 0 }
      : await dansLaPage<any>(page, 'aligner', enDataUrl(image), d.plein)
    const r = await dansLaPage<any>(page, 'assembler', { image: enDataUrl(image), decoupe: d.plein, ...a, disque: 1, cadre: [0, 100], tailles: [640], qualite: 0.9 })
    writeFileSync(path.join(demo, `${nom}-perso.webp`), deDataUrl(r.perso[640]))
    console.log(`  ${nom} : ${(d.transparents * 100).toFixed(0)} % transparent, aligné ×${a.s.toFixed(3)}, écart ${a.ecart.toFixed(0)}${d.bordFaux ? ' ⚠ bord faux' : ''}`)
  }
  console.log(demo)
} finally {
  await nav.close()
}

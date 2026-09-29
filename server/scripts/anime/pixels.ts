// Ce qui lit et écrit des pixels, pour les scripts des portraits en images
// (`essai.ts`, `portraits.ts`) : Node ne sait pas décoder une image sans
// dépendance, Chromium si. Du JavaScript en chaîne, posé dans une page
// (`pagePixels`) — le serveur se vérifie sans les types du navigateur.
//
// - `detourer` : le fond uni (vert ou magenta) devient transparent, les bords
//   se démêlent ;
// - `recaler` : une forme détourée retombe sur une autre, par recouvrement —
//   l'essai recale l'image générée sur son croquis ;
// - `aligner` : la découpe d'une illustration (le personnage seul, que Nano
//   Banana a repeint sur un fond uni) retombe sur l'illustration, par la
//   couleur — le modèle déplace parfois d'un cheveu ce qu'il devait garder ;
// - `assembler` : les fichiers de l'application, le disque et le personnage,
//   à leurs tailles.
export const NAVIGATEUR = String.raw`
function charger(src) {
  return new Promise((ok, ko) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ko(new Error('image illisible'))
    i.src = src
  })
}
function toile(l, h) { const c = document.createElement('canvas'); c.width = l; c.height = h; return c }
const borne = v => Math.max(0, Math.min(255, Math.round(v)))
const cb = (r, g, b) => 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
const cr = (r, g, b) => 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

// La couleur du fond, lue sur le pourtour : la médiane de chaque canal. Le
// buste touche le bas du canevas, la foudre un coin — la médiane les ignore
// tant que le fond tient plus de la moitié du bord.
function couleurDuFond(d, l, h) {
  const bande = Math.max(2, Math.round(l * 0.015))
  const canaux = [[], [], []]
  const prendre = (x, y) => {
    const k = (y * l + x) * 4
    canaux[0].push(d[k]); canaux[1].push(d[k + 1]); canaux[2].push(d[k + 2])
  }
  for (let y = 0; y < h; y++) {
    if (y < bande || y >= h - bande) for (let x = 0; x < l; x++) prendre(x, y)
    else for (let x = 0; x < bande; x++) { prendre(x, y); prendre(l - 1 - x, y) }
  }
  return canaux.map(t => { t.sort((p, q) => p - q); return t[t.length >> 1] })
}

// Le détourage : l'opacité suit la distance de chrominance à la couleur du
// fond — un bord à moitié vert est à moitié transparent —, puis chaque bord
// se démêle (on retire la part de fond qu'il avait prise).
//
// Le reflet du fond, lui, dépend de sa couleur. Sur le vert, le personnage
// n'a pas de vert : il n'y dépasse jamais le plus fort des deux autres
// canaux, partout (« partout »). Sur le magenta — le fond des sujets qui
// portent du vert —, le rose d'une fleur ou d'une joue est à eux : le reflet
// ne se retire qu'aux bords, là où le fond s'est mêlé (« bords »).
async function detourer(src, reflet) {
  const img = await charger(src)
  const l = img.naturalWidth, h = img.naturalHeight
  const c = toile(l, h), x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const donnees = x.getImageData(0, 0, l, h), d = donnees.data
  const K = couleurDuFond(d, l, h)
  const magenta = K[0] > K[1] + 60 && K[2] > K[1] + 60
  const partout = reflet ? reflet === 'partout' : !magenta
  const kb = cb(K[0], K[1], K[2]), kr = cr(K[0], K[1], K[2])
  const T0 = 0.06, T1 = 0.4
  let transparents = 0
  for (let k = 0; k < d.length; k += 4) {
    const r = d[k], g = d[k + 1], b = d[k + 2]
    let a = (Math.hypot(cb(r, g, b) - kb, cr(r, g, b) - kr) / 255 - T0) / (T1 - T0)
    a = Math.max(0, Math.min(1, a))
    // Le fond franc, même assombri (une ombre que le modèle aurait posée), reste du fond.
    if (magenta) {
      const m = Math.min(r, b)
      if (m > 40 && (m - g) / m > 0.6 && Math.abs(r - b) < 70) a = 0
    } else {
      const m = Math.max(r, b)
      if (g > 40 && (g - m) / g > 0.6) a = 0
    }
    if (a < 0.02) { d[k + 3] = 0; transparents++; continue }
    let R = r, G = g, B = b
    if (a < 0.98) { R = (r - (1 - a) * K[0]) / a; G = (g - (1 - a) * K[1]) / a; B = (b - (1 - a) * K[2]) / a }
    if (partout || a < 0.98) {
      if (magenta) {
        const exces = Math.min(R, B) - G
        if (exces > 0) { R -= exces; B -= exces }
      } else G = Math.min(G, Math.max(R, B))
    }
    d[k] = borne(R); d[k + 1] = borne(G); d[k + 2] = borne(B); d[k + 3] = borne(a * 255)
  }
  x.putImageData(donnees, 0, 0)
  // Une image qui n'est pas carrée (l'app Gemini choisit parfois son
  // format) se complète en carré, centrée sur du transparent : étirée, elle
  // déformait le personnage.
  const m = Math.max(l, h), carre = toile(m, m)
  carre.getContext('2d').drawImage(c, (m - l) / 2, (m - h) / 2)
  return { plein: carre.toDataURL('image/png'), fond: K, magenta, transparents: transparents / (l * h), taille: [l, h] }
}

// Une image réduite par moitiés successives : d'un coup, de 1024 à 128,
// le navigateur saute des pixels, et les traits fins se hachent.
function reduire(source, cote) {
  let c = source, t = source.width
  while (t / 2 >= cote * 1.5) {
    const moitie = toile(Math.round(t / 2), Math.round(t / 2)), x = moitie.getContext('2d')
    x.imageSmoothingQuality = 'high'
    x.drawImage(c, 0, 0, moitie.width, moitie.height)
    c = moitie; t = moitie.width
  }
  const fin = toile(cote, cote), x = fin.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.drawImage(c, 0, 0, cote, cote)
  return fin
}

async function masque(src, n) {
  const img = await charger(src)
  const c = toile(n, n), x = c.getContext('2d', { willReadFrequently: true })
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, n, n)
  const d = x.getImageData(0, 0, n, n).data
  const m = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) m[i] = d[i * 4 + 3] / 255
  return m
}

// Le recouvrement des deux formes (intersection sur union, en opacités),
// l'image générée mise à l'échelle s autour du centre puis décalée de
// (dx, dy) pixels. Sous la ligne « bas », le buste que le modèle prolonge
// jusqu'au bord du canevas ne compte pas : le disque le coupe avant.
function recouvrement(ref, gen, n, s, dx, dy, bas) {
  const c = n / 2
  let inter = 0, union = 0
  for (let Y = 0; Y < bas; Y++) {
    const v = Math.round(c + (Y - c - dy) / s)
    const dedans = v >= 0 && v < n
    for (let X = 0; X < n; X++) {
      const u = Math.round(c + (X - c - dx) / s)
      const g = dedans && u >= 0 && u < n ? gen[v * n + u] : 0
      const r = ref[Y * n + X]
      inter += r < g ? r : g
      union += r > g ? r : g
    }
  }
  return union ? inter / union : 0
}

async function recaler(srcRef, srcGen, n, bas) {
  const ref = await masque(srcRef, n), gen = await masque(srcGen, n)
  const identite = recouvrement(ref, gen, n, 1, 0, 0, bas)
  let mieux = { s: 1, dx: 0, dy: 0, score: identite }
  // De 0,4 à 1,8 : l'app Gemini remplit le canevas (le Minotaure y revient
  // une fois et demie plus grand que son croquis), et une image rendue en
  // 4:3, complétée en carré, arrive aux trois quarts de sa taille.
  for (let s = 0.4; s <= 1.8001; s += 0.05)
    for (let dx = -32; dx <= 32; dx += 4)
      for (let dy = -32; dy <= 32; dy += 4) {
        const q = recouvrement(ref, gen, n, s, dx, dy, bas)
        if (q > mieux.score) mieux = { s, dx, dy, score: q }
      }
  const b = { ...mieux }
  for (let s = b.s - 0.04; s <= b.s + 0.0401; s += 0.01)
    for (let dx = b.dx - 4; dx <= b.dx + 4; dx += 1)
      for (let dy = b.dy - 4; dy <= b.dy + 4; dy += 1) {
        const q = recouvrement(ref, gen, n, s, dx, dy, bas)
        if (q > mieux.score) mieux = { s, dx, dy, score: q }
      }
  return { ...mieux, identite }
}

async function pixelsDe(src, n) {
  const img = await charger(src)
  const c = toile(n, n), x = c.getContext('2d', { willReadFrequently: true })
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, n, n)
  return x.getImageData(0, 0, n, n).data
}

// L'écart moyen de couleur entre la découpe, posée à l'échelle s autour du
// centre puis décalée de (dx, dy), et l'illustration sous elle — sur les
// pixels opaques de la découpe seulement, un sur deux.
function ecart(image, decoupe, n, s, dx, dy) {
  const c = n / 2
  let somme = 0, compte = 0
  for (let v = 0; v < n; v += 2) {
    const Y = Math.round(c + (v - c) * s + dy)
    if (Y < 0 || Y >= n) continue
    for (let u = 0; u < n; u += 2) {
      const k = (v * n + u) * 4
      if (decoupe[k + 3] < 230) continue
      const X = Math.round(c + (u - c) * s + dx)
      if (X < 0 || X >= n) continue
      const j = (Y * n + X) * 4
      somme += Math.abs(image[j] - decoupe[k]) + Math.abs(image[j + 1] - decoupe[k + 1]) + Math.abs(image[j + 2] - decoupe[k + 2])
      compte++
    }
  }
  return compte > 200 ? somme / compte : Infinity
}

// La découpe retombe sur l'illustration : Nano Banana garde le personnage,
// mais le déplace ou le grandit parfois d'un ou deux pour cent. En 256, à
// ±4 % et de 0,94 à 1,06, puis au pixel près en 512.
async function aligner(srcImage, srcDecoupe) {
  let n = 256
  let image = await pixelsDe(srcImage, n), decoupe = await pixelsDe(srcDecoupe, n)
  const brut = ecart(image, decoupe, n, 1, 0, 0)
  let mieux = { s: 1, dx: 0, dy: 0, e: brut }
  for (let s = 0.94; s <= 1.0601; s += 0.01)
    for (let dx = -10; dx <= 10; dx++)
      for (let dy = -10; dy <= 10; dy++) {
        const e = ecart(image, decoupe, n, s, dx, dy)
        if (e < mieux.e) mieux = { s, dx, dy, e }
      }
  n = 512
  image = await pixelsDe(srcImage, n); decoupe = await pixelsDe(srcDecoupe, n)
  // L'écart sans alignement, relu en 512 : en 256, il ne se comparait pas à l'autre.
  const sans = ecart(image, decoupe, n, 1, 0, 0)
  const b = { s: mieux.s, dx: mieux.dx * 2, dy: mieux.dy * 2 }
  mieux = { ...b, e: ecart(image, decoupe, n, b.s, b.dx, b.dy) }
  for (let s = b.s - 0.006; s <= b.s + 0.00601; s += 0.002)
    for (let dx = b.dx - 2; dx <= b.dx + 2; dx++)
      for (let dy = b.dy - 2; dy <= b.dy + 2; dy++) {
        const e = ecart(image, decoupe, n, s, dx, dy)
        if (e < mieux.e) mieux = { s, dx, dy, e }
      }
  // Le décalage, en fraction de la largeur : il vaut à toutes les tailles.
  if (sans <= mieux.e) mieux = { s: 1, dx: 0, dy: 0, e: sans }
  return { s: mieux.s, dx: mieux.dx / n, dy: mieux.dy / n, ecart: mieux.e, sansAlignement: sans }
}

// Les fichiers d'un portrait, à chaque taille (des pixels pour 100 unités du
// disque de Portrait.tsx) :
// - le disque : le carré 0 → 100 de l'illustration, que le disque découpe ;
// - le personnage : l'illustration sous l'opacité de la découpe alignée — ses
//   couleurs à elle, la forme de l'autre —, dans son cadre (le carré, ou plus
//   large quand il en sort). Sans découpe (le premier palier, peint sur un
//   fond uni), l'image détourée elle-même.
// « disque » est la part de la largeur de l'image que couvre le carré 0 → 100.
async function assembler(o) {
  const img = await charger(o.image)
  const W = img.naturalWidth
  let perso = toile(W, W)
  const px = perso.getContext('2d')
  px.drawImage(img, 0, 0, W, W)
  if (o.decoupe) {
    const dec = await charger(o.decoupe)
    const m = toile(W, W), mx = m.getContext('2d')
    mx.imageSmoothingQuality = 'high'
    mx.translate(W / 2 + o.dx * W, W / 2 + o.dy * W)
    mx.scale(o.s, o.s)
    mx.translate(-W / 2, -W / 2)
    mx.drawImage(dec, 0, 0, W, W)
    px.globalCompositeOperation = 'destination-in'
    px.drawImage(m, 0, 0)
    px.globalCompositeOperation = 'source-over'
  }
  const L = 100 / o.disque
  const debut = 50 - L / 2
  const sortie = { disque: {}, perso: {} }
  for (const T of o.tailles) {
    if (o.decoupe) {
      // Le carré du disque, pris au centre de l'illustration.
      const cote = Math.round(o.disque * W), x0 = Math.round((W - cote) / 2)
      const carre = toile(cote, cote)
      carre.getContext('2d').drawImage(img, x0, x0, cote, cote, 0, 0, cote, cote)
      sortie.disque[T] = reduire(carre, T).toDataURL('image/webp', o.qualite)
    }
    // Le cadre du personnage : l'image y est posée à sa place, le reste transparent.
    const [origine, cote] = o.cadre
    const echelle = W / L
    const grand = toile(Math.round(cote * echelle), Math.round(cote * echelle))
    grand.getContext('2d').drawImage(perso, (debut - origine) * echelle, (debut - origine) * echelle, W, W)
    sortie.perso[T] = reduire(grand, Math.round((T * cote) / 100)).toDataURL('image/webp', o.qualite)
  }
  return sortie
}

// Une image JPEG réduite, pour l'envoyer : la découpe ne demande que la
// forme, et un lot en ligne ne passe pas les vingt mégaoctets.
async function jpegReduit(src, cote, qualite) {
  const img = await charger(src)
  const c = toile(img.naturalWidth, img.naturalHeight)
  c.getContext('2d').drawImage(img, 0, 0)
  return reduire(c, cote).toDataURL('image/jpeg', qualite)
}
`

/** Une page de Chromium, avec les outils de pixels chargés. */
export async function pagePixels(nav: any, cote = 1024) {
  const page = await nav.newPage({ viewport: { width: cote, height: cote }, deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>')
  await page.addScriptTag({ content: NAVIGATEUR })
  return page
}

/** Une fonction des outils, appelée dans la page : le code tourne là-bas, pas ici. */
export function dansLaPage<T>(page: any, fonction: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(`${fonction}(...${JSON.stringify(args)})`)
}

export const deDataUrl = (d: string) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64')

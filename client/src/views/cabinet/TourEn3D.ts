// La tour du Cabinet en trois dimensions : les neuf salles en îles flottantes,
// posées en spirale au-dessus d'une galaxie, chacune son pavillon, le médaillon
// de son gardien et ses œuvres qui tournent autour en cadres — peintes si on
// les a, un « ? » sinon. La maquette que le propriétaire a validée le
// 31 octobre 2026 (« super joli visuellement, du 3D »), sans en changer le
// geste : glisser pour parcourir la tour, toucher une île pour la regarder.
//
// Chargé à la demande (`Tour.tsx`, `aLaDemande`) : three.js ne descend qu'avec
// la tour, jamais avec le reste de l'application. Rien n'y juge ni n'y décide :
// la scène dessine ce que la vue du serveur dit, et la page dit le reste en
// mots — le dessin est décoratif (`aria-hidden`), la liste des étages le
// double pour qui ne le voit pas. Sans WebGL, la page garde cette liste.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Une œuvre autour d'une île : sa peinture si elle est à lui, rien sinon ; sa rareté fait la couleur du cadre. */
export interface OeuvreDeLIle {
  image: string | null
  rarete: 'commun' | 'rare' | 'maudit' | 'epique'
}

/** Une île de la tour : son nom, sa teinte, son gardien — éveillé ou non —, ses œuvres, et la brume tant qu'aucune montée ne l'a atteinte. */
export interface IleDeLaTour {
  nom: string
  teinte: number
  gardien: string | null
  eveille: boolean
  oeuvres: readonly OeuvreDeLIle[]
  brume: boolean
}

/** Ce que la scène dessine : les îles, celle que la caméra regarde, le chemin allumé jusqu'où, et l'étage de la comète pendant une montée. */
export interface EtatDeLaTour {
  iles: readonly IleDeLaTour[]
  focus: number
  allume: number
  joueur: number | null
}

export interface SceneDeLaTour {
  maj(etat: EtatDeLaTour): void
  detruire(): void
}

/** La tour se dessine-t-elle ici ? Un navigateur sans WebGL garde la liste des étages. */
export function webglPossible(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

const RAYON = 7.5
const ANGLE = 0.95
const HAUT = 4.6
const helice = (t: number) => new Vector3(Math.cos(t * ANGLE) * RAYON, t * HAUT, Math.sin(t * ANGLE) * RAYON)
const dehors = (t: number) => new Vector3(Math.cos(t * ANGLE), 0, Math.sin(t * ANGLE))
const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Le relief de chaque cadre selon sa rareté : l'argent, le bleu, le pourpre, l'or — les gemmes de l'application. */
const COULEURS_DES_CADRES: Record<OeuvreDeLIle['rarete'], { color: number; emissive: number; intensite: number }> = {
  commun: { color: 0xc9ccd6, emissive: 0x000000, intensite: 0 },
  rare: { color: 0x6fa8ff, emissive: 0x10306a, intensite: 0.6 },
  maudit: { color: 0xc0579a, emissive: 0x4a0f35, intensite: 0.6 },
  epique: { color: 0xf2c75c, emissive: 0x7a5410, intensite: 0.9 },
}

interface CadreDeLIle {
  groupe: Group
  toile: Mesh
  image: string | null
}

interface IleDessinee {
  groupe: Group
  anneau: Group
  cristal: Mesh
  gardien: Sprite
  halo: Sprite
  nom: Sprite
  nuages: Sprite[]
  cadres: CadreDeLIle[]
  cible: Mesh
  donnee: IleDeLaTour
}

/** Ce qu'une animation de la scène fait d'elle-même, frame après frame, jusqu'à sa fin. */
interface Fondu {
  t: number
  duree: number
  pas: (u: number) => void
  fin?: () => void
}

/** Le champ vertical de la caméra, en degrés, sur la hauteur de la toile. */
const CHAMP = 52

export function creerLaTour(
  conteneur: HTMLElement,
  etatInitial: EtatDeLaTour,
  /** `couvert` : les pixels que la page pose en haut de la scène — le titre de la tour —, que le regard laisse au-dessus de lui. */
  rappels: { surIle?: (i: number) => void; surFocus?: (i: number) => void; couvert?: () => number } = {},
): SceneDeLaTour {
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches
  const police = getComputedStyle(conteneur).fontFamily || 'Georgia, serif'
  const jetables: { dispose(): void }[] = []
  const garder = <T extends { dispose(): void }>(x: T): T => {
    jetables.push(x)
    return x
  }

  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.outputColorSpace = SRGBColorSpace
  renderer.domElement.className = 'cab-tour-toile'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  conteneur.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x07050e)
  scene.fog = new FogExp2(0x0b0718, 0.0085)
  const camera = new PerspectiveCamera(CHAMP, 1, 0.1, 600)
  const pmrem = new PMREMGenerator(renderer)
  const environnement = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environnement
  pmrem.dispose()
  jetables.push(environnement)

  scene.add(new HemisphereLight(0x9d8cff, 0x1a1020, 0.55))
  const soleil = new DirectionalLight(0xffe2b0, 1.4)
  soleil.position.set(12, 40, 18)
  const contre = new DirectionalLight(0x6fb8ff, 0.9)
  contre.position.set(-18, 12, -14)
  scene.add(soleil, contre)

  // ── Les textures dessinées ──
  const toile = (l: number, h: number, dessin: (g: CanvasRenderingContext2D, l: number, h: number) => void) => {
    const c = document.createElement('canvas')
    c.width = l
    c.height = h
    const g = c.getContext('2d')
    if (g) dessin(g, l, h)
    const t = garder(new CanvasTexture(c))
    t.colorSpace = SRGBColorSpace
    return t
  }
  const texPoint = toile(64, 64, (g, l) => {
    const d = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    d.addColorStop(0, 'rgba(255,255,255,1)')
    d.addColorStop(0.25, 'rgba(255,255,255,.7)')
    d.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = d
    g.fillRect(0, 0, l, l)
  })
  const texEtoile = toile(128, 128, g => {
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    d.addColorStop(0, 'rgba(255,240,200,.9)')
    d.addColorStop(0.3, 'rgba(255,210,120,.25)')
    d.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = d
    g.fillRect(0, 0, 128, 128)
    g.beginPath()
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 14 : 36
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
    }
    g.closePath()
    g.fillStyle = '#fff6d8'
    g.fill()
  })
  const texNuage = toile(256, 256, g => {
    // Une brume régulière d'une page à l'autre : ses bouffées sont écrites, pas tirées.
    const bouffees = [
      [96, 120, 80],
      [150, 110, 70],
      [128, 150, 90],
      [80, 160, 60],
      [175, 150, 60],
    ]
    for (const [x, y, r] of bouffees) {
      const d = g.createRadialGradient(x, y, 0, x, y, r)
      d.addColorStop(0, 'rgba(255,255,255,.55)')
      d.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = d
      g.fillRect(0, 0, 256, 256)
    }
  })
  const texVide = toile(256, 192, g => {
    const d = g.createLinearGradient(0, 0, 0, 192)
    d.addColorStop(0, '#2a1d3d')
    d.addColorStop(1, '#120c1c')
    g.fillStyle = d
    g.fillRect(0, 0, 256, 192)
    g.font = `110px ${police}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = 'rgba(226,189,110,.45)'
    g.fillText('?', 128, 100)
  })
  const nebuleuse = (couleur: string) =>
    toile(256, 256, g => {
      const d = g.createRadialGradient(128, 128, 0, 128, 128, 128)
      d.addColorStop(0, couleur)
      d.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = d
      g.fillRect(0, 0, 256, 256)
    })
  const etiquette = (texte: string) => {
    const taille = 52
    const mesure = document.createElement('canvas').getContext('2d')
    if (mesure) mesure.font = `${taille}px ${police}`
    const l = Math.ceil((mesure?.measureText(texte).width ?? texte.length * 26) + taille * 1.4)
    const h = Math.ceil(taille * 1.7)
    const tex = toile(l, h, g => {
      g.fillStyle = 'rgba(14,9,24,.72)'
      g.strokeStyle = 'rgba(247,220,154,.75)'
      g.lineWidth = 4
      g.beginPath()
      // `roundRect` manque aux navigateurs d'avant 2023 : un rectangle simple y suffit.
      if (typeof g.roundRect === 'function') g.roundRect(2, 2, l - 4, h - 4, h / 2)
      else g.rect(2, 2, l - 4, h - 4)
      g.fill()
      g.stroke()
      g.font = `${taille}px ${police}`
      g.fillStyle = '#f7dc9a'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(texte, l / 2, h / 2 + 3)
    })
    const sp = new Sprite(garder(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false })))
    sp.scale.set(l * 0.012, h * 0.012, 1)
    sp.renderOrder = 5
    return sp
  }

  const chargeur = new TextureLoader()
  const peintures = new Map<string, Texture>()
  const peinture = (adresse: string) => {
    let t = peintures.get(adresse)
    if (!t) {
      t = garder(chargeur.load(adresse))
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 4
      peintures.set(adresse, t)
    }
    return t
  }
  const medaille = (adresse: string) => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const t = garder(new CanvasTexture(c))
    t.colorSpace = SRGBColorSpace
    const img = new Image()
    img.onload = () => {
      const g = c.getContext('2d')
      if (!g) return
      g.save()
      g.beginPath()
      g.arc(128, 128, 118, 0, Math.PI * 2)
      g.clip()
      g.drawImage(img, 0, 0, 256, 256)
      g.restore()
      const d = g.createLinearGradient(0, 0, 256, 256)
      d.addColorStop(0, '#fff1c4')
      d.addColorStop(0.5, '#c8963f')
      d.addColorStop(1, '#fbe3a0')
      g.lineWidth = 12
      g.strokeStyle = d
      g.beginPath()
      g.arc(128, 128, 120, 0, Math.PI * 2)
      g.stroke()
      t.needsUpdate = true
    }
    img.src = adresse
    return t
  }

  // ── Les matières ──
  const or = garder(new MeshStandardMaterial({ color: 0xe0b867, metalness: 1, roughness: 0.3, envMapIntensity: 0.7 }))
  const marbre = garder(new MeshStandardMaterial({ color: 0xd9d0c2, metalness: 0, roughness: 0.5, envMapIntensity: 0.25 }))
  const bords = Object.fromEntries(
    Object.entries(COULEURS_DES_CADRES).map(([r, c]) => [r, garder(new MeshStandardMaterial({ color: c.color, metalness: 0.95, roughness: 0.28, emissive: c.emissive, emissiveIntensity: c.intensite }))]),
  ) as Record<OeuvreDeLIle['rarete'], MeshStandardMaterial>
  const vide = garder(new MeshStandardMaterial({ map: texVide, roughness: 0.7, metalness: 0 }))
  const toiles = new Map<string, MeshBasicMaterial>()
  const matiereDeLaToile = (adresse: string | null): Material => {
    if (!adresse) return vide
    let m = toiles.get(adresse)
    if (!m) {
      m = garder(new MeshBasicMaterial({ map: peinture(adresse), toneMapped: false, color: new Color(0.92, 0.92, 0.92) }))
      toiles.set(adresse, m)
    }
    return m
  }

  // ── Le ciel : des étoiles lointaines, des nébuleuses, une galaxie en spirale sous la tour ──
  {
    const n = 3000
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const c = new Color()
    const v = new Vector3()
    for (let k = 0; k < n; k++) {
      // Un ciel régulier : chaque étoile à sa place, d'une ouverture à l'autre.
      const a = k * 2.399963
      const z = 1 - (2 * (k + 0.5)) / n
      const r = Math.sqrt(1 - z * z)
      v.set(Math.cos(a) * r, z, Math.sin(a) * r).multiplyScalar(160 + ((k * 37) % 120))
      pos.set([v.x, v.y + 20, v.z], k * 3)
      c.setHSL(k % 3 === 0 ? 0.12 : 0.62, 0.5, 0.75 + ((k * 13) % 25) / 100)
      col.set([c.r, c.g, c.b], k * 3)
    }
    const geo = garder(new BufferGeometry())
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('color', new BufferAttribute(col, 3))
    scene.add(new Points(geo, garder(new PointsMaterial({ size: 1.3, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }))))
  }
  for (const [couleur, x, y, z] of [
    ['rgba(130,80,255,.9)', -70, 30, -80],
    ['rgba(40,170,200,.8)', 80, 10, -60],
    ['rgba(220,80,160,.7)', 20, 60, -110],
    ['rgba(255,170,80,.5)', -40, -20, 70],
  ] as const) {
    const sp = new Sprite(garder(new SpriteMaterial({ map: nebuleuse(couleur), transparent: true, opacity: 0.38, depthWrite: false, blending: AdditiveBlending, fog: false })))
    sp.position.set(x, y, z)
    sp.scale.set(140, 140, 1)
    scene.add(sp)
  }
  const galaxie = (() => {
    const n = 12000
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const coeur = new Color(2.2, 1.5, 0.8)
    const violet = new Color(0.45, 0.3, 1.1)
    const bleu = new Color(0.25, 0.8, 1.1)
    const c = new Color()
    let graine = 7
    const hasard = () => ((graine = (graine * 16807) % 2147483647) - 1) / 2147483646
    for (let k = 0; k < n; k++) {
      const bras = k % 4
      const r = Math.pow(hasard(), 1.7) * 75 + 1.5
      const a = (bras / 4) * Math.PI * 2 + r * 0.085 + (hasard() - 0.5) * 0.7 * (1.2 - r / 80)
      const ecart = (hasard() - 0.5) * (2 + r * 0.08)
      pos.set([Math.cos(a) * r + ecart, (hasard() - 0.5) * Math.max(0.4, 3 - r * 0.03), Math.sin(a) * r + ecart], k * 3)
      c.copy(coeur).lerp(k % 2 ? violet : bleu, Math.min(1, r / 40))
      col.set([c.r, c.g, c.b], k * 3)
    }
    const geo = garder(new BufferGeometry())
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('color', new BufferAttribute(col, 3))
    const g = new Points(geo, garder(new PointsMaterial({ size: 0.42, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending })))
    g.position.y = -16
    g.rotation.x = 0.12
    scene.add(g)
    return g
  })()

  // ── Les îles ──
  const geoRoche = (graine: number, teinte: number) => {
    const geo = garder(new IcosahedronGeometry(1, 3))
    const p = geo.attributes.position
    const v = new Vector3()
    const cols: number[] = []
    const haut = new Color().setHSL(teinte / 360, 0.32, 0.5)
    const bas = new Color().setHSL(teinte / 360, 0.35, 0.07)
    const c = new Color()
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k)
      const n = Math.sin(v.x * 4.1 + graine) * Math.cos(v.z * 3.7 + graine * 1.3) * 0.13 + Math.sin(v.y * 5.3 + graine * 2.1) * 0.07
      if (v.y < 0) {
        v.y *= 2.1 + n * 2.5
        const serre = 1 + v.y * 0.2
        v.x *= serre * (1 + n)
        v.z *= serre * (1 + n)
      } else {
        v.y = Math.min(v.y * 0.3, 0.1)
        v.x *= 1 + n * 0.4
        v.z *= 1 + n * 0.4
      }
      v.multiplyScalar(2.35)
      p.setXYZ(k, v.x, v.y, v.z)
      c.copy(bas).lerp(haut, borne((v.y + 4.5) / 4.8, 0, 1) ** 1.6)
      cols.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3))
    geo.computeVertexNormals()
    return geo
  }
  const geoColonne = garder(new CylinderGeometry(0.075, 0.09, 1.25, 14))
  const geoSocle = garder(new CylinderGeometry(1.15, 1.28, 0.26, 40))
  const geoEntab = garder(new CylinderGeometry(1.1, 1.1, 0.16, 40))
  const geoDome = garder(new SphereGeometry(1.02, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2))
  const geoFleuron = garder(new SphereGeometry(0.11, 16, 12))
  const geoCristal = garder(new OctahedronGeometry(0.3))
  const geoSol = garder(new CylinderGeometry(2.2, 2.32, 0.24, 56))
  const geoLisere = garder(new TorusGeometry(2.28, 0.05, 8, 80))
  const geoCible = garder(new SphereGeometry(4.2, 12, 8))
  const invisible = garder(new MeshBasicMaterial({ visible: false }))
  const fleuron = garder(new MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc860, emissiveIntensity: 3 }))

  const fondus: Fondu[] = []
  const animer = (duree: number, pas: (u: number) => void, fin?: () => void) => {
    if (calme) {
      pas(1)
      fin?.()
      return
    }
    fondus.push({ t: 0, duree, pas, fin })
  }

  const reveiller = (ile: IleDessinee, eveille: boolean, eclat: boolean) => {
    ile.gardien.material.color.set(eveille ? 0xffffff : 0x3b3450)
    ile.halo.visible = eveille
    if (eveille && eclat) animer(1.6, u => ile.halo.scale.setScalar(9 - 5.4 * (1 - (1 - u) ** 3)))
  }

  const construireIle = (d: IleDeLaTour, i: number): IleDessinee => {
    const groupe = new Group()
    groupe.position.copy(helice(i))
    groupe.rotation.y = -i * ANGLE + Math.PI / 2
    const roche = new Mesh(geoRoche(i * 1.7 + 1, d.teinte), garder(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05, envMapIntensity: 0.25 })))
    const sol = new Mesh(geoSol, garder(new MeshStandardMaterial({ color: new Color().setHSL(d.teinte / 360, 0.45, 0.42), roughness: 0.45, metalness: 0.15, envMapIntensity: 0.35 })))
    sol.position.y = 0.33
    const lisere = new Mesh(geoLisere, or)
    lisere.rotation.x = Math.PI / 2
    lisere.position.y = 0.45
    const socle = new Mesh(geoSocle, marbre)
    socle.position.y = 0.58
    groupe.add(roche, sol, lisere, socle)
    for (let k = 0; k < 8; k++) {
      const col = new Mesh(geoColonne, marbre)
      const a = (k / 8) * Math.PI * 2
      col.position.set(Math.cos(a) * 0.92, 1.33, Math.sin(a) * 0.92)
      groupe.add(col)
    }
    const entab = new Mesh(geoEntab, marbre)
    entab.position.y = 2.03
    const dome = new Mesh(geoDome, or)
    dome.position.y = 2.1
    const fleur = new Mesh(geoFleuron, fleuron)
    fleur.position.y = 3.17
    const teinte = new Color().setHSL(d.teinte / 360, 0.8, 0.6)
    const cristal = new Mesh(geoCristal, garder(new MeshStandardMaterial({ color: teinte, emissive: teinte, emissiveIntensity: 2.6, roughness: 0.2 })))
    cristal.position.y = 1.25
    const lueur = new PointLight(teinte, 2.2, 5, 1.8)
    lueur.position.y = 1.3
    groupe.add(entab, dome, fleur, cristal, lueur)

    const gardien = new Sprite(garder(new SpriteMaterial({ map: d.gardien ? medaille(d.gardien) : null, transparent: true })))
    gardien.scale.set(2.1, 2.1, 1)
    gardien.position.y = 4.35
    const halo = new Sprite(garder(new SpriteMaterial({ map: texPoint, color: new Color(1.3, 0.95, 0.45), blending: AdditiveBlending, transparent: true, depthWrite: false })))
    halo.scale.set(3.6, 3.6, 1)
    halo.position.y = 4.35
    groupe.add(halo, gardien)
    const nom = etiquette(d.nom)
    nom.position.y = 6.05
    groupe.add(nom)

    // Les œuvres de la salle tournent autour du pavillon, en cadres.
    const n = d.oeuvres.length
    const grand = n > 8
    const r = grand ? 3.95 : 3.55
    const k = grand ? 0.62 : 0.86
    const l = 1.2 * k
    const h = 0.9 * k
    const geoBord = garder(new BoxGeometry(l + 0.14 * k, h + 0.14 * k, 0.07))
    const geoToile = garder(new PlaneGeometry(l, h))
    const anneau = new Group()
    anneau.position.y = 1.65
    const cadres = d.oeuvres.map((o, j) => {
      const a = (j / n) * Math.PI * 2
      const g = new Group()
      const bord = new Mesh(geoBord, bords[o.rarete])
      const t = new Mesh(geoToile, matiereDeLaToile(o.image))
      t.position.z = 0.04
      g.add(bord, t)
      g.position.set(Math.cos(a) * r, Math.sin(j * 1.9) * 0.28, Math.sin(a) * r)
      g.rotation.y = Math.PI / 2 - a
      g.userData.phase = j
      anneau.add(g)
      return { groupe: g, toile: t, image: o.image }
    })
    groupe.add(anneau)
    const cible = new Mesh(geoCible, invisible)
    cible.position.y = 1
    cible.userData.etage = i
    groupe.add(cible)
    const nuages: Sprite[] = []
    for (let q = 0; q < 9; q++) {
      const nu = new Sprite(garder(new SpriteMaterial({ map: texNuage, color: 0xc9b8ee, transparent: true, opacity: d.brume ? 0.85 : 0, depthWrite: false })))
      const a = (q / 9) * Math.PI * 2
      const rr = 1.5 + ((q * 7) % 10) / 4
      nu.position.set(Math.cos(a) * rr, -1 + ((q * 5) % 10) / 2, Math.sin(a) * rr)
      const e = 5 + ((q * 3) % 4)
      nu.scale.set(e, e * 0.7, 1)
      nu.userData.phase = q
      nu.visible = d.brume
      groupe.add(nu)
      nuages.push(nu)
    }
    scene.add(groupe)
    const ile: IleDessinee = { groupe, anneau, cristal, gardien, halo, nom, nuages, cadres, cible, donnee: d }
    reveiller(ile, d.eveille, false)
    return ile
  }

  let etat = etatInitial
  const iles = etat.iles.map(construireIle)

  // ── Le chemin d'étoiles d'une île à l'autre ──
  const segments = iles.slice(0, -1).map((_, i) => {
    const a = helice(i).add(new Vector3(0, 0.5, 0))
    const b = helice(i + 1).add(new Vector3(0, 0.5, 0))
    const m = helice(i + 0.5).add(dehors(i + 0.5).multiplyScalar(2.2)).add(new Vector3(0, 1.2, 0))
    const courbe = new QuadraticBezierCurve3(a, m, b)
    const materiau = garder(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    const tube = new Mesh(garder(new TubeGeometry(courbe, 60, 0.05, 8)), materiau)
    scene.add(tube)
    const etoiles: Sprite[] = []
    for (let u = 0.12; u < 0.95; u += 0.11) {
      const e = new Sprite(garder(new SpriteMaterial({ map: texEtoile, color: new Color(2, 1.6, 0.9), transparent: true, depthWrite: false, blending: AdditiveBlending })))
      e.position.copy(courbe.getPoint(u))
      e.scale.setScalar(0.55)
      e.userData.phase = u * 20 + i
      scene.add(e)
      etoiles.push(e)
    }
    return { materiau, etoiles }
  })
  const allumer = (jusqua: number) =>
    segments.forEach((s, i) => {
      const allume = i + 1 < jusqua
      s.materiau.color.copy(allume ? new Color(2.4, 1.75, 0.8) : new Color(0.22, 0.18, 0.32))
      s.etoiles.forEach(e => (e.visible = allume))
    })
  allumer(etat.allume)

  // ── Toi, pendant une montée : une petite comète ──
  const orbe = new Group()
  orbe.add(
    new Mesh(garder(new SphereGeometry(0.2, 20, 14)), garder(new MeshBasicMaterial({ color: new Color(3, 2.6, 1.8), toneMapped: false }))),
    (() => {
      const aura = new Sprite(garder(new SpriteMaterial({ map: texPoint, color: new Color(2, 1.5, 0.7), blending: AdditiveBlending, transparent: true, depthWrite: false })))
      aura.scale.setScalar(2.2)
      return aura
    })(),
  )
  orbe.visible = etat.joueur !== null
  scene.add(orbe)

  // ── Le rendu ──
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.7, 0.5, 1.05))
  composer.addPass(new OutputPass())
  // La toile, en largeur sur hauteur : la caméra s'éloigne sur un écran en hauteur. Et ce que le titre en couvre, mesuré une fois
  // par taille de la scène, pas à chaque image.
  let largeSurHaut = 1
  let couvert = 0
  const redimensionner = () => {
    const l = Math.max(1, conteneur.clientWidth)
    const h = Math.max(1, conteneur.clientHeight)
    renderer.setSize(l, h, false)
    composer.setSize(l, h)
    largeSurHaut = l / h
    // Le regard descend au milieu de ce que le titre laisse voir, sans rapetisser l'île : le cadre de la caméra grandit d'autant
    // vers le bas, son champ avec lui, et la toile n'en montre que le haut. Centré sur la toile, l'étage passait sous le titre et
    // son rond, son nom compris — comme le compte des œuvres avant eux (le propriétaire, le 31 octobre 2026).
    couvert = Math.max(0, Math.round(rappels.couvert?.() ?? 0))
    const c = Math.min(Math.round(h * 0.45), couvert)
    camera.aspect = l / (h + c)
    camera.fov = (Math.atan(Math.tan((CHAMP * Math.PI) / 360) * ((h + c) / h)) * 360) / Math.PI
    if (c > 0) camera.setViewOffset(l, h + c, 0, 0, l, h)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  const observateur = new ResizeObserver(redimensionner)
  observateur.observe(conteneur)
  redimensionner()

  const cam = { t: calme ? etat.focus : etat.focus - 2.2, but: etat.focus, zoom: calme ? 1 : 2.4 }
  const derniere = () => iles.length - 1
  const placerCamera = () => {
    const c = helice(cam.t)
    const d = dehors(cam.t)
    const tangente = new Vector3(-d.z, 0, d.x)
    const D = (largeSurHaut < 1 ? 23 : 15) * cam.zoom
    camera.position.copy(c).addScaledVector(d, D).addScaledVector(tangente, -5).add(new Vector3(0, 5 * cam.zoom, 0))
    // Le regard un peu au-dessus du pavillon : l'île entière et son nom dans le cadre, l'étage d'au-dessus en vue.
    camera.lookAt(c.x, c.y + 1.2, c.z)
  }

  // Le nom d'un étage s'efface sous le titre de la page, au fil de la montée : « Étage 4 · Le Rempart » passait derrière
  // « ← Accueil », un texte sur un autre. Il s'éteint sur les vingt-quatre pixels d'au-dessous, et revient en descendant.
  const projete = new Vector3()
  const effacerSousLeTitre = () => {
    const h = Math.max(1, conteneur.clientHeight)
    for (const ile of iles) {
      ile.nom.getWorldPosition(projete).project(camera)
      const y = ((1 - projete.y) / 2) * h
      ile.nom.material.opacity = couvert > 0 ? borne((y - couvert) / 24, 0, 1) : 1
    }
  }

  let precedente = performance.now()
  let temps = 0
  const animation = (maintenant: number) => {
    const dt = Math.min((maintenant - precedente) / 1000, 0.05)
    precedente = maintenant
    temps += dt
    const lisse = (k: number) => (calme ? 1 : 1 - Math.exp(-dt * k))
    cam.t += (cam.but - cam.t) * lisse(2.6)
    cam.zoom += (1 - cam.zoom) * lisse(1.4)
    placerCamera()
    if (!calme) {
      galaxie.rotation.y += dt * 0.02
      iles.forEach((ile, i) => {
        ile.groupe.position.y = helice(i).y + Math.sin(temps * 0.8 + i * 1.3) * 0.18
        ile.anneau.rotation.y += dt * (ile.cadres.length > 8 ? 0.06 : 0.1)
        ile.anneau.children.forEach(c => (c.position.y = Math.sin(temps * 1.2 + (c.userData.phase as number) * 1.9) * 0.18))
        ile.cristal.rotation.y += dt * 1.2
        ile.nuages.forEach(n => (n.position.x += Math.sin(temps * 0.3 + (n.userData.phase as number)) * dt * 0.25))
        if (ile.halo.visible) ile.halo.material.opacity = 0.7 + Math.sin(temps * 2 + i) * 0.3
      })
      segments.forEach(s => s.etoiles.forEach(e => e.scale.setScalar(0.45 + Math.sin(temps * 3 + (e.userData.phase as number)) * 0.15)))
    }
    if (orbe.visible && etat.joueur !== null) {
      const c = helice(etat.joueur)
      orbe.position.copy(c).addScaledVector(dehors(etat.joueur), 2.9).add(new Vector3(0, 1.4 + (calme ? 0 : Math.sin(temps * 3) * 0.2), 0))
    }
    for (let k = fondus.length - 1; k >= 0; k--) {
      const f = fondus[k]
      f.t += dt
      const u = borne(f.t / f.duree, 0, 1)
      f.pas(u)
      if (u >= 1) {
        f.fin?.()
        fondus.splice(k, 1)
      }
    }
    effacerSousLeTitre()
    composer.render()
  }
  // Une page cachée ne dessine rien : la batterie d'un téléphone en poche.
  const suivreLaVisibilite = () => renderer.setAnimationLoop(document.visibilityState === 'visible' ? animation : null)
  document.addEventListener('visibilitychange', suivreLaVisibilite)
  suivreLaVisibilite()

  // ── Les gestes : glisser parcourt la tour, toucher une île la regarde ──
  const el = renderer.domElement
  const rayon = new Raycaster()
  const souris = new Vector2()
  let glisse: { y: number; x: number; but: number; bouge: boolean } | null = null
  const focaliser = (i: number) => {
    const j = Math.round(borne(i, 0, derniere()))
    cam.but = j
    rappels.surFocus?.(j)
  }
  const auDebut = (e: PointerEvent) => {
    glisse = { y: e.clientY, x: e.clientX, but: cam.but, bouge: false }
    el.setPointerCapture(e.pointerId)
  }
  const enRoute = (e: PointerEvent) => {
    if (!glisse) return
    const dy = e.clientY - glisse.y
    const dx = e.clientX - glisse.x
    if (Math.hypot(dx, dy) > 6) glisse.bouge = true
    if (glisse.bouge) cam.but = borne(glisse.but + dy * 0.011 - dx * 0.006, -0.3, derniere() + 0.3)
  }
  const aLaFin = (e: PointerEvent) => {
    if (!glisse) return
    if (glisse.bouge) focaliser(cam.but)
    else {
      const r = el.getBoundingClientRect()
      souris.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      rayon.setFromCamera(souris, camera)
      const touche = rayon.intersectObjects(iles.map(i => i.cible))[0]
      if (touche) {
        const i = touche.object.userData.etage as number
        focaliser(i)
        rappels.surIle?.(i)
      }
    }
    glisse = null
  }
  let attente: ReturnType<typeof setTimeout> | undefined
  const molette = (e: WheelEvent) => {
    e.preventDefault()
    cam.but = borne(cam.but - e.deltaY * 0.004, -0.3, derniere() + 0.3)
    clearTimeout(attente)
    attente = setTimeout(() => focaliser(cam.but), 220)
  }
  el.addEventListener('pointerdown', auDebut)
  el.addEventListener('pointermove', enRoute)
  el.addEventListener('pointerup', aLaFin)
  el.addEventListener('pointercancel', () => (glisse = null))
  el.addEventListener('wheel', molette, { passive: false })

  // Une gerbe d'étoiles, quand une porte s'ouvre ou qu'une œuvre s'accroche.
  const gerbe = (centre: Vector3) => {
    if (calme) return
    const n = 70
    const pos = new Float32Array(n * 3)
    const vitesses = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      pos.set([centre.x, centre.y, centre.z], k * 3)
      const a = k * 2.399963
      const z = 1 - (2 * (k + 0.5)) / n
      const r = Math.sqrt(1 - z * z)
      const v = 2 + (k % 5)
      vitesses.set([Math.cos(a) * r * v, z * v + 2.5, Math.sin(a) * r * v], k * 3)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    const materiau = new PointsMaterial({ size: 0.5, map: texEtoile, color: new Color(2.4, 2, 1.1), transparent: true, depthWrite: false, blending: AdditiveBlending })
    const points = new Points(geo, materiau)
    scene.add(points)
    let dernierU = 0
    animer(
      1.8,
      u => {
        const dt = (u - dernierU) * 1.8
        dernierU = u
        const p = geo.attributes.position
        for (let j = 0; j < n; j++) {
          vitesses[j * 3 + 1] -= dt * 2.5
          p.setXYZ(j, p.getX(j) + vitesses[j * 3] * dt, p.getY(j) + vitesses[j * 3 + 1] * dt, p.getZ(j) + vitesses[j * 3 + 2] * dt)
        }
        p.needsUpdate = true
        materiau.opacity = 1 - u
      },
      () => {
        scene.remove(points)
        geo.dispose()
        materiau.dispose()
      },
    )
  }

  return {
    maj(neuf) {
      const avant = etat
      etat = neuf
      if (neuf.focus !== avant.focus) cam.but = borne(neuf.focus, 0, derniere())
      if (neuf.allume !== avant.allume) allumer(neuf.allume)
      orbe.visible = neuf.joueur !== null
      neuf.iles.forEach((d, i) => {
        const ile = iles[i]
        if (!ile) return
        const vieille = ile.donnee
        ile.donnee = d
        if (d.eveille !== vieille.eveille) reveiller(ile, d.eveille, true)
        if (d.brume !== vieille.brume) {
          ile.nuages.forEach(n => {
            n.visible = true
            const de = n.material.opacity
            animer(1.4, u => (n.material.opacity = de + ((d.brume ? 0.85 : 0) - de) * u), () => (n.visible = d.brume))
          })
        }
        d.oeuvres.forEach((o, j) => {
          const cadre = ile.cadres[j]
          if (!cadre || cadre.image === o.image) return
          cadre.image = o.image
          cadre.toile.material = matiereDeLaToile(o.image)
          // L'œuvre gagnée s'accroche : son cadre grandit puis se pose, une gerbe autour.
          if (o.image) {
            animer(1.2, u => cadre.groupe.scale.setScalar(2.4 - 1.4 * (1 - (1 - u) ** 3)))
            const monde = new Vector3()
            cadre.groupe.getWorldPosition(monde)
            gerbe(monde)
          }
        })
      })
    },
    detruire() {
      renderer.setAnimationLoop(null)
      document.removeEventListener('visibilitychange', suivreLaVisibilite)
      observateur.disconnect()
      clearTimeout(attente)
      el.removeEventListener('pointerdown', auDebut)
      el.removeEventListener('pointermove', enRoute)
      el.removeEventListener('pointerup', aLaFin)
      el.removeEventListener('wheel', molette)
      // Chaque géométrie, matière et texture s'est rangée à sa naissance (`garder`) : la page quittée rend toute la mémoire.
      for (const j of jetables) j.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      el.remove()
    },
  }
}

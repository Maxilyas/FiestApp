// La carte de la traversée en trois dimensions : trois archipels qui montent
// dans la nuit, un par acte. Chaque étape est une île ; les chemins sont des
// fils de lumière ; la comète, c'est lui. La maquette que le propriétaire a
// jouée le 31 octobre 2026 (« Je trouve ça top »), le ciel et les îles de la
// tour d'avant.
//
// Chargée à la demande (`Traversee.tsx`, `aLaDemande`) : three.js ne descend
// qu'avec la carte, jamais avec le reste de l'application. Elle ne décide de
// rien : elle dessine ce que la vue du serveur dit (`maj`), et ne rend qu'un
// geste, l'étape touchée (`toucher`). Décorative (`aria-hidden`) : le panneau
// de la page dit tout en mots, et sans WebGL la page se passe d'elle.

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Raycaster,
  RepeatWrapping,
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
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Une étape telle que la carte la dessine : sa place, sa sorte, et ce que son étiquette écrit. */
export interface EtapeDessinee {
  id: string
  acte: number
  rangee: number
  colonne: number
  sorte: 'depart' | 'epreuve' | 'coffre' | 'marchand' | 'gardien'
  /** Le médaillon d'une épreuve ou du marchand. */
  emoji?: string
  /** Le portrait d'un gardien, le coffre peint. */
  image?: string
  /** Le coffre ouvert, sur la même pose. */
  imageOuverte?: string
  titre: string
  sous: string
  suivantes: readonly string[]
}

/** Ce que la carte montre : le titre (les trois archipels de loin), ou la carte de l'acte, sa comète, ce qui s'atteint. */
export interface EtatDeLaCarte {
  mode: 'titre' | 'carte'
  acte: number
  position: string
  visitees: readonly string[]
  atteignables: readonly string[]
  selection: string | null
  coffresOuverts: readonly string[]
}

export interface SceneDeLaTraversee {
  /** La carte d'une traversée, dessinée une fois : ses étapes, la teinte de chaque acte. */
  construire(etapes: readonly EtapeDessinee[], teintes: readonly number[]): void
  maj(etat: EtatDeLaCarte): void
  /** La comète d'une étape à la suivante, par son chemin. */
  voyager(de: string, vers: string): Promise<void>
  /** Le pont de lumière vers l'acte suivant. */
  volerVersLActe(acte: number): Promise<void>
  sauterA(id: string): void
  detruire(): void
}

/** La carte se dessine-t-elle ici ? Un navigateur sans WebGL garde le panneau seul. */
export function webglPossible(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

const ACTE_Z = 76
const RANG_Z = 12.5
const COL_X = 5.9
const MONTE = 15
const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Un nombre de [0, 1[ tiré d'un identifiant : chaque île garde sa pose d'une page à l'autre. */
const hache = (s: string) => {
  let h = 2166136261
  for (const c of s) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
const EMOJI_POLICE = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'

interface IleDessinee {
  e: EtapeDessinee
  groupe: Group
  medaille: Sprite
  halo: Sprite
  etiquette: Sprite
  cible: Mesh
  pos: Vector3
  h: number
  y: number
  echelle: Vector3
  echelleEtiquette: Vector3
  atteignable: boolean
  choisie: boolean
}

interface Chemin {
  de: string
  vers: string
  courbe: QuadraticBezierCurve3
  mat: MeshBasicMaterial
  tirets: Mesh
  etoiles: Sprite[]
  pont: boolean
}

export function creerLaTraversee(
  conteneur: HTMLElement,
  rappels: {
    toucher: (id: string) => void
    /** Les pixels que le panneau couvre au bas de la scène : le regard vit au-dessus de lui. */
    couvert?: () => number
  },
): SceneDeLaTraversee {
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches
  const titrePolice = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'Georgia, serif'
  const textePolice = getComputedStyle(conteneur).fontFamily || 'sans-serif'
  const jetables: { dispose(): void }[] = []
  const garder = <T extends { dispose(): void }>(x: T): T => {
    jetables.push(x)
    return x
  }

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.outputColorSpace = SRGBColorSpace
  renderer.domElement.className = 'cab-traversee-toile'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  conteneur.appendChild(renderer.domElement)
  const scene = new Scene()
  scene.background = new Color(0x07050e)
  scene.fog = new FogExp2(0x0b0718, 0.0062)
  const camera = new PerspectiveCamera(50, 1, 0.1, 900)
  const pmrem = new PMREMGenerator(renderer)
  const environnement = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environnement
  pmrem.dispose()
  jetables.push(environnement)
  scene.add(new HemisphereLight(0x9d8cff, 0x1a1020, 0.6))
  const soleil = new DirectionalLight(0xffe2b0, 1.4)
  soleil.position.set(14, 40, -10)
  const contre = new DirectionalLight(0x6fb8ff, 0.8)
  contre.position.set(-18, 12, 40)
  scene.add(soleil, contre)

  // ── Les textures dessinées à la main ──
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
  const nebuleuse = (couleur: string) =>
    toile(256, 256, g => {
      const d = g.createRadialGradient(128, 128, 0, 128, 128, 128)
      d.addColorStop(0, couleur)
      d.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = d
      g.fillRect(0, 0, 256, 256)
    })
  // Les tirets qui défilent sur un chemin ouvert : la marche à suivre, sans un mot.
  const tirets = () => {
    const t = toile(128, 16, g => {
      for (let x = 0; x < 128; x += 32) {
        g.fillStyle = '#fff'
        g.fillRect(x, 0, 18, 16)
      }
    })
    t.wrapS = RepeatWrapping
    t.colorSpace = NoColorSpace
    return t
  }

  const medailles = new Map<string, Texture>()
  const texMedaille = (emoji: string, teinte: number) => {
    const cle = `${emoji}:${teinte}`
    const deja = medailles.get(cle)
    if (deja) return deja
    const t = toile(256, 256, g => {
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
      g.fillText(emoji, 128, 138)
    })
    medailles.set(cle, t)
    return t
  }
  const chargeur = new TextureLoader()
  const images = new Map<string, Texture>()
  const texImage = (src: string) => {
    const deja = images.get(src)
    if (deja) return deja
    const t = garder(chargeur.load(src))
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    images.set(src, t)
    return t
  }
  /** Un portrait de gardien dans un médaillon cerclé d'or. */
  const texPortrait = (src: string) => {
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
      g.arc(128, 128, 116, 0, Math.PI * 2)
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
    img.src = src
    return t
  }
  /** Une étiquette : un titre et une ligne dessous, dans une pastille de verre. */
  const etiquette = (titre: string, sous: string, o: { bord?: string; couleur?: string } = {}) => {
    const T = 46
    const S = 30
    const m = document.createElement('canvas').getContext('2d')
    let lt = titre.length * 24
    let ls = sous.length * 15
    if (m) {
      m.font = `${T}px ${titrePolice}`
      lt = m.measureText(titre).width
      m.font = `700 ${S}px ${textePolice}`
      ls = sous ? m.measureText(sous).width : 0
    }
    const l = Math.ceil(Math.max(lt, ls) + 56)
    const h = sous ? 126 : 80
    const tex = toile(l, h, g => {
      g.fillStyle = 'rgba(14,9,24,.78)'
      g.strokeStyle = o.bord ?? 'rgba(247,220,154,.75)'
      g.lineWidth = 4
      g.beginPath()
      g.roundRect(2, 2, l - 4, h - 4, 30)
      g.fill()
      g.stroke()
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `${T}px ${titrePolice}`
      g.fillStyle = o.couleur ?? '#f7dc9a'
      g.fillText(titre, l / 2, sous ? 44 : h / 2 + 3)
      if (sous) {
        g.font = `700 ${S}px ${textePolice}`
        g.fillStyle = '#cfc3dd'
        g.fillText(sous, l / 2, 92)
      }
    })
    const sp = new Sprite(garder(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })))
    const k = 0.0096
    sp.scale.set(l * k, h * k, 1)
    sp.renderOrder = 10
    sp.center.set(0.5, 0)
    return sp
  }

  // ── Le ciel : des étoiles, des nébuleuses, une galaxie sous les îles ──
  {
    const n = 3000
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const c = new Color()
    const v = new Vector3()
    for (let k = 0; k < n; k++) {
      v.randomDirection().multiplyScalar(260 + Math.random() * 160)
      pos.set([v.x, v.y + 40, v.z + 110], k * 3)
      c.setHSL(Math.random() < 0.3 ? 0.12 : 0.62, 0.5, 0.75 + Math.random() * 0.25)
      col.set([c.r, c.g, c.b], k * 3)
    }
    const geo = garder(new BufferGeometry())
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('color', new BufferAttribute(col, 3))
    scene.add(new Points(geo, garder(new PointsMaterial({ size: 1.6, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }))))
  }
  let galaxie: Points
  {
    const n = 12000
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    // Plus sombre que celle de la tour : ses bras passaient derrière les étiquettes et brouillaient la lecture.
    const coeur = new Color(1.2, 0.85, 0.45)
    const violet = new Color(0.3, 0.2, 0.75)
    const bleu = new Color(0.15, 0.5, 0.7)
    const c = new Color()
    for (let k = 0; k < n; k++) {
      const bras = k % 4
      const r = Math.pow(Math.random(), 1.7) * 110 + 2
      const a = (bras / 4) * Math.PI * 2 + r * 0.06 + (Math.random() - 0.5) * 0.7 * (1.2 - r / 120)
      const ecart = (Math.random() - 0.5) * (2 + r * 0.08)
      pos.set([Math.cos(a) * r + ecart, (Math.random() - 0.5) * Math.max(0.4, 3 - r * 0.02), Math.sin(a) * r + ecart], k * 3)
      c.copy(coeur).lerp(k % 2 ? violet : bleu, Math.min(1, r / 60))
      col.set([c.r, c.g, c.b], k * 3)
    }
    const geo = garder(new BufferGeometry())
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('color', new BufferAttribute(col, 3))
    galaxie = new Points(geo, garder(new PointsMaterial({ size: 0.5, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending })))
    galaxie.position.set(0, -40, 110)
    galaxie.rotation.x = 0.1
    scene.add(galaxie)
  }

  // ── Les îles ──
  const geoRoche = (graine: number, teinte: number) => {
    const geo = garder(new IcosahedronGeometry(1, 3))
    const p = geo.attributes.position
    const v = new Vector3()
    const cols: number[] = []
    const haut = new Color().setHSL(teinte / 360, 0.34, 0.5)
    const bas = new Color().setHSL(teinte / 360, 0.36, 0.07)
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
      v.multiplyScalar(1.5)
      p.setXYZ(k, v.x, v.y, v.z)
      c.copy(bas).lerp(haut, borne((v.y + 3) / 3.2, 0, 1) ** 1.6)
      cols.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3))
    geo.computeVertexNormals()
    return geo
  }
  const OR = garder(new MeshStandardMaterial({ color: 0xe0b867, metalness: 1, roughness: 0.3, envMapIntensity: 0.7 }))
  const geoSol = garder(new CylinderGeometry(1.42, 1.5, 0.18, 48))
  const geoLisere = garder(new TorusGeometry(1.47, 0.045, 8, 64))
  const geoCible = garder(new SphereGeometry(2.6, 10, 8))
  const matCible = garder(new MeshBasicMaterial({ visible: false }))

  let monde = new Group()
  scene.add(monde)
  let iles = new Map<string, IleDessinee>()
  let chemins: Chemin[] = []
  let etoilesDuChemin: Sprite[] = []
  let duMonde: { dispose(): void }[] = []
  const auMonde = <T extends { dispose(): void }>(x: T): T => {
    duMonde.push(x)
    return x
  }
  let etat: EtatDeLaCarte = { mode: 'titre', acte: 0, position: 'a0r0c1', visitees: [], atteignables: [], selection: null, coffresOuverts: [] }

  const comete = new Group()
  {
    const c = new Mesh(garder(new SphereGeometry(0.24, 20, 14)), garder(new MeshBasicMaterial({ color: new Color(3, 2.6, 1.8), toneMapped: false })))
    const aura = new Sprite(garder(new SpriteMaterial({ map: texPoint, color: new Color(2, 1.5, 0.7), blending: AdditiveBlending, transparent: true, depthWrite: false })))
    aura.scale.setScalar(2.6)
    comete.add(c, aura)
    scene.add(comete)
  }
  const traine: { s: Sprite; pos: Vector3 }[] = []
  for (let k = 0; k < 14; k++) {
    const s = new Sprite(garder(new SpriteMaterial({ map: texPoint, color: new Color(1.8, 1.3, 0.6), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })))
    s.scale.setScalar(1.2 - k * 0.06)
    scene.add(s)
    traine.push({ s, pos: new Vector3() })
  }

  const posDe = (e: EtapeDessinee) => {
    const h = hache(e.id)
    const libre = e.sorte === 'epreuve' || e.sorte === 'coffre'
    return new Vector3(libre ? (e.colonne - 1) * COL_X + (h - 0.5) * 1.4 : 0, e.acte * MONTE + e.rangee * 0.55 + (h - 0.5) * 0.8, e.acte * ACTE_Z + e.rangee * RANG_Z + (h - 0.5) * 1.4)
  }
  const courbe = (a: Vector3, b: Vector3, pont: boolean) => {
    const A = a.clone().add(new Vector3(0, 0.35, 0))
    const B = b.clone().add(new Vector3(0, 0.35, 0))
    const M = A.clone().lerp(B, 0.5).add(new Vector3(0, pont ? 9 : 1.1, 0))
    return new QuadraticBezierCurve3(A, M, B)
  }

  const vider = () => {
    scene.remove(monde)
    for (const x of duMonde) x.dispose()
    duMonde = []
    monde = new Group()
    scene.add(monde)
    iles = new Map()
    chemins = []
    etoilesDuChemin = []
  }

  const ajouterChemin = (de: string, vers: string, pont: boolean) => {
    const A = iles.get(de)
    const B = iles.get(vers)
    if (!A || !B) return
    const c = courbe(A.pos, B.pos, pont)
    const mat = auMonde(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }))
    const tube = new Mesh(auMonde(new TubeGeometry(c, pont ? 90 : 40, pont ? 0.09 : 0.065, 8)), mat)
    const map = auMonde(tirets())
    map.repeat.set(Math.max(2, Math.round(c.getLength() / 1.6)), 1)
    const matTirets = auMonde(new MeshBasicMaterial({ map, color: new Color(2.6, 2.1, 1.2), toneMapped: false, transparent: true, depthWrite: false }))
    const lesTirets = new Mesh(auMonde(new TubeGeometry(c, pont ? 90 : 40, pont ? 0.12 : 0.1, 8)), matTirets)
    lesTirets.visible = false
    const etoiles: Sprite[] = []
    for (let u = 0.15; u < 0.9; u += pont ? 0.06 : 0.17) {
      const s = new Sprite(auMonde(new SpriteMaterial({ map: texEtoile, color: new Color(2, 1.6, 0.9), transparent: true, depthWrite: false, blending: AdditiveBlending })))
      s.position.copy(c.getPoint(u))
      s.scale.setScalar(0.5)
      s.userData.phase = u * 20 + hache(de + vers) * 9
      s.visible = false
      monde.add(s)
      etoiles.push(s)
      etoilesDuChemin.push(s)
    }
    monde.add(tube, lesTirets)
    chemins.push({ de, vers, courbe: c, mat, tirets: lesTirets, etoiles, pont })
  }

  const construire = (etapes: readonly EtapeDessinee[], teintes: readonly number[]) => {
    vider()
    const geos = teintes.map((t, a) => [0, 1, 2].map(k => auMonde(geoRoche(a * 5 + k * 1.7 + 1, t))))
    // Une nébuleuse par acte, à sa teinte : on sait de loin où commence le suivant.
    teintes.forEach((t, a) => {
      const sp = new Sprite(auMonde(new SpriteMaterial({ map: auMonde(nebuleuse(`hsla(${t},80%,55%,.85)`)), transparent: true, opacity: 0.32, depthWrite: false, blending: AdditiveBlending, fog: false })))
      sp.position.set(a % 2 ? 26 : -26, a * MONTE - 6, a * ACTE_Z + 34)
      sp.scale.set(110, 110, 1)
      monde.add(sp)
      const lueur = new PointLight(new Color().setHSL(t / 360, 0.7, 0.6), 60, 60, 1.6)
      lueur.position.set(0, a * MONTE + 8, a * ACTE_Z + 30)
      monde.add(lueur)
    })
    for (const e of etapes) {
      const t = teintes[e.acte] ?? 152
      const h = hache(e.id)
      const groupe = new Group()
      const pos = posDe(e)
      groupe.position.copy(pos)
      monde.add(groupe)
      const grand = e.sorte === 'gardien' ? 1.45 : e.sorte === 'depart' ? 0.85 : 1
      const roche = new Mesh(geos[e.acte]?.[Math.floor(h * 3)] ?? geos[0][0], auMonde(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05, envMapIntensity: 0.25 })))
      roche.scale.setScalar(grand)
      roche.rotation.y = h * 6.28
      const sol = new Mesh(geoSol, auMonde(new MeshStandardMaterial({ color: new Color().setHSL(t / 360, 0.42, 0.4), roughness: 0.45, metalness: 0.15, envMapIntensity: 0.35 })))
      sol.scale.setScalar(grand)
      sol.position.y = 0.2 * grand
      const lisere = new Mesh(geoLisere, OR)
      lisere.rotation.x = Math.PI / 2
      lisere.position.y = 0.3 * grand
      lisere.scale.setScalar(grand)
      groupe.add(roche, sol, lisere)
      let medaille: Sprite
      let haut = 1.9
      if ((e.sorte === 'epreuve' || e.sorte === 'marchand') && e.emoji) {
        medaille = new Sprite(auMonde(new SpriteMaterial({ map: texMedaille(e.emoji, t), transparent: true, depthWrite: false })))
        medaille.scale.setScalar(2.1)
        medaille.position.y = 1.65
      } else if (e.sorte === 'coffre' && e.image) {
        medaille = new Sprite(auMonde(new SpriteMaterial({ map: texImage(e.image), transparent: true, depthWrite: false })))
        medaille.scale.set(2.4, 2.5, 1)
        medaille.position.y = 1.45
      } else if (e.sorte === 'gardien' && e.image) {
        medaille = new Sprite(auMonde(new SpriteMaterial({ map: texPortrait(e.image), transparent: true, depthWrite: false })))
        medaille.scale.setScalar(4.2)
        medaille.position.y = 3.2
        haut = 5.4
        const feu = new PointLight(new Color().setHSL(t / 360, 0.8, 0.6), 30, 14, 1.8)
        feu.position.y = 2.5
        groupe.add(feu)
      } else {
        medaille = new Sprite(auMonde(new SpriteMaterial({ map: texPoint, color: new Color().setHSL(t / 360, 0.8, 0.75), transparent: true, depthWrite: false, blending: AdditiveBlending })))
        medaille.scale.setScalar(1.6)
        medaille.position.y = 0.9
        haut = 1.6
      }
      // Le halo passe derrière la médaille : devant, il délavait l'emoji et le portrait.
      medaille.renderOrder = 3
      groupe.add(medaille)
      const halo = new Sprite(auMonde(new SpriteMaterial({ map: texPoint, color: new Color(1.3, 1.0, 0.5), blending: AdditiveBlending, transparent: true, depthWrite: false })))
      halo.scale.setScalar(e.sorte === 'gardien' ? 6.2 : 3.6)
      halo.position.set(0, medaille.position.y, 0.4)
      halo.renderOrder = 2
      halo.visible = false
      groupe.add(halo)
      const lab = etiquette(e.titre, e.sous, e.sorte === 'gardien' ? { bord: 'rgba(255,150,130,.85)', couleur: '#ffd9c9' } : {})
      lab.position.y = haut + (e.sorte === 'gardien' ? 0 : 0.4)
      groupe.add(lab)
      const cible = new Mesh(geoCible, matCible)
      cible.position.y = 1.4
      cible.userData.id = e.id
      groupe.add(cible)
      iles.set(e.id, { e, groupe, medaille, halo, etiquette: lab, cible, pos, h, y: medaille.position.y, echelle: medaille.scale.clone(), echelleEtiquette: lab.scale.clone(), atteignable: false, choisie: false })
    }
    for (const e of etapes) for (const v of e.suivantes) ajouterChemin(e.id, v, false)
    // Le pont de lumière qui mène d'un gardien au départ de l'acte suivant.
    for (const e of etapes) if (e.sorte === 'gardien') ajouterChemin(e.id, `a${e.acte + 1}r0c1`, true)
    maj(etat)
  }

  // ── L'état : qui brille, qui dort, où regarde la caméra ──
  const cam = { cible: new Vector3(0, 10, 80), but: new Vector3(0, 10, 80), recul: 2.4, reculBut: 1, decalage: 0 }
  let voyage: { courbe: QuadraticBezierCurve3; debut: number; duree: number; fin: () => void; pont: boolean } | null = null
  const acteDe = (id: string) => Number(id[1]) || 0
  const rangeeDe = (id: string) => Number(id[3]) || 0

  const placerComete = (p: Vector3) => {
    comete.position.copy(p).add(new Vector3(0, 0.9, 0))
  }

  function maj(neuf: EtatDeLaCarte) {
    etat = neuf
    const visitees = new Set(neuf.visitees)
    const rangIci = rangeeDe(neuf.position)
    const ouverts = neuf.mode === 'carte' ? neuf.atteignables : []
    for (const [id, x] of iles) {
      const a = acteDe(id)
      const atteignable = ouverts.includes(id)
      const futur = a > neuf.acte
      const passe = a < neuf.acte || (a === neuf.acte && rangeeDe(id) <= rangIci && id !== neuf.position && !visitees.has(id))
      const vu = visitees.has(id) && id !== neuf.position
      x.atteignable = atteignable
      x.choisie = neuf.selection === id
      x.medaille.material.opacity = passe ? 0.28 : futur ? 0.55 : 1
      x.medaille.material.color.setScalar(vu ? 0.5 : passe ? 0.6 : 1)
      if (x.e.sorte === 'coffre' && x.e.imageOuverte && neuf.coffresOuverts.includes(id)) x.medaille.material.map = texImage(x.e.imageOuverte)
      x.halo.visible = atteignable || (x.e.sorte === 'gardien' && !futur && neuf.mode === 'carte') || (neuf.mode === 'titre' && x.e.sorte === 'gardien')
      x.etiquette.visible =
        neuf.mode === 'carte'
          ? atteignable || (x.e.sorte === 'gardien' && a === neuf.acte) || (x.e.sorte === 'depart' && id === neuf.position)
          : x.e.sorte === 'gardien'
      x.etiquette.material.opacity = x.choisie ? 1 : 0.94
    }
    for (const ch of chemins) {
      const iDe = neuf.visitees.indexOf(ch.de)
      const iVers = neuf.visitees.indexOf(ch.vers)
      const parcouru = iDe >= 0 && iVers === iDe + 1
      const ouvert = ch.de === neuf.position && ouverts.includes(ch.vers)
      const futur = acteDe(ch.de) > neuf.acte || (ch.pont && acteDe(ch.de) >= neuf.acte)
      const choisi = ouvert && ch.vers === neuf.selection
      ch.mat.color.copy(parcouru ? new Color(2.4, 1.75, 0.8) : ouvert ? new Color(1.2, 1.0, 0.7) : futur ? new Color(0.2, 0.17, 0.32) : new Color(0.28, 0.22, 0.42))
      ch.mat.opacity = parcouru || ouvert ? 1 : futur ? 0.5 : 0.75
      ch.tirets.visible = ouvert && (!neuf.selection || choisi)
      for (const e of ch.etoiles) e.visible = parcouru
    }
    const ici = iles.get(neuf.position)
    if (!voyage && ici) placerComete(ici.pos)
    cadrer()
    viser()
    if (enPause) rendreUneFois()
  }

  // La caméra regarde un peu devant la comète, vers l'étape choisie s'il y en a une.
  function viser() {
    if (etat.mode === 'titre') {
      cam.but.set(0, 4, 36)
      cam.reculBut = 1
      return
    }
    const ici = iles.get(etat.position)
    const p = voyage ? comete.position.clone() : (ici?.pos.clone() ?? new Vector3())
    const sel = etat.selection ? iles.get(etat.selection) : undefined
    // La comète reste au bas de la carte visible, les étapes suivantes au-dessus d'elle.
    if (sel) cam.but.set(p.x * 0.45 + sel.pos.x * 0.55, (p.y + sel.pos.y) / 2, p.z * 0.45 + sel.pos.z * 0.55 + 3)
    else cam.but.set(p.x * 0.6, p.y + 0.6, p.z + 5)
    cam.but.z += cam.decalage
    // Un téléphone tenu droit ne garde qu'une bande de carte entre la tête et le panneau : la caméra recule d'autant.
    const portrait = conteneur.clientWidth < conteneur.clientHeight
    cam.reculBut = (voyage?.pont ? 1.5 : 1) * (portrait ? 1.18 : 1)
  }

  function placerCamera(t: number) {
    const c = cam.cible
    if (etat.mode === 'titre') {
      // Le premier archipel au centre, les deux autres qui montent derrière lui dans la nuit.
      camera.position.set(c.x + Math.sin(t * 0.08) * 12, c.y + 50, c.z - 70)
      camera.lookAt(c.x, c.y, c.z)
      return
    }
    const r = cam.recul
    camera.position.set(c.x * 0.7, c.y + 19 * r, c.z - 21 * r)
    camera.lookAt(c.x * 0.85, c.y - 1, c.z + 3)
  }

  // ── La boucle ──
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.65, 0.5, 1.05)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  let enPause = false
  let avant = performance.now()
  const depart = performance.now()

  // Le panneau couvre le bas de l'écran : le cadre se décale pour que la carte vive au-dessus de lui — la comète et les étapes
  // atteignables au milieu de ce qui reste, jamais sous le panneau. Recadré à chaque état : le panneau change de hauteur avec lui.
  function cadrer() {
    const l = Math.max(1, conteneur.clientWidth)
    const h = Math.max(1, conteneur.clientHeight)
    const portrait = l / h < 1
    const bas = Math.min(h * 0.6, rappels.couvert?.() ?? Math.round(h * (portrait ? 0.3 : 0.16)))
    camera.setViewOffset(l, h, 0, Math.round(bas / 2), l, h)
    camera.updateProjectionMatrix()
  }
  function redimensionner() {
    const l = Math.max(1, conteneur.clientWidth)
    const h = Math.max(1, conteneur.clientHeight)
    renderer.setSize(l, h, false)
    composer.setSize(l, h)
    camera.aspect = l / h
    camera.fov = l / h < 1 ? 56 : 46
    cadrer()
    if (enPause) rendreUneFois()
  }

  function animer() {
    const maintenant = performance.now()
    const dt = Math.min((maintenant - avant) / 1000, 0.05)
    avant = maintenant
    const t = (maintenant - depart) / 1000
    const lisse = (k: number) => 1 - Math.exp(-dt * k)
    if (voyage) {
      // Le voyage suit l'horloge, pas les images : un téléphone lent arrive à l'heure, en sautant des images.
      const u = borne((maintenant - voyage.debut) / (voyage.duree * 1000), 0, 1)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      comete.position.copy(voyage.courbe.getPoint(e)).add(new Vector3(0, 0.55, 0))
      viser()
      if (u >= 1) {
        const fin = voyage.fin
        voyage = null
        viser()
        fin()
      }
    }
    cam.cible.lerp(cam.but, calme ? 1 : lisse(voyage ? 6 : 2.6))
    cam.recul += (cam.reculBut - cam.recul) * (calme ? 1 : lisse(1.6))
    placerCamera(t)
    galaxie.rotation.y += dt * 0.015
    for (const [, x] of iles) {
      const vise = x.choisie ? 1.22 : 1
      x.medaille.scale.lerp(x.echelle.clone().multiplyScalar(vise), lisse(8))
      if (!calme) x.medaille.position.y = x.y + Math.sin(t * 1.4 + x.h * 9) * 0.12
      if (x.halo.visible) x.halo.material.opacity = (x.choisie ? 0.7 : 0.38) + Math.sin(t * 3 + x.h * 7) * 0.16
      x.etiquette.scale.copy(x.echelleEtiquette).multiplyScalar(x.choisie ? 1.12 : 1)
    }
    for (const ch of chemins) {
      const map = (ch.tirets.material as MeshBasicMaterial).map
      if (ch.tirets.visible && map) map.offset.x -= dt * 0.9
    }
    for (const e of etoilesDuChemin) if (e.visible) e.scale.setScalar(0.42 + Math.sin(t * 3 + (e.userData.phase as number)) * 0.14)
    if (!calme) comete.children[1].scale.setScalar(2.4 + Math.sin(t * 4) * 0.3)
    // La traîne suit la comète avec un temps de retard.
    let prec = comete.position
    traine.forEach((q, k) => {
      q.pos.lerp(prec, lisse(18 - k))
      q.s.position.copy(q.pos)
      q.s.material.opacity = voyage ? 0.5 * (1 - k / traine.length) : Math.max(0, q.s.material.opacity - dt * 1.5)
      prec = q.pos
    })
    composer.render()
  }
  function rendreUneFois() {
    placerCamera((performance.now() - depart) / 1000)
    composer.render()
  }
  function pause(oui: boolean) {
    if (oui && !voyage) {
      if (!enPause) {
        enPause = true
        renderer.setAnimationLoop(null)
        rendreUneFois()
      }
    } else if (enPause) {
      enPause = false
      avant = performance.now()
      renderer.setAnimationLoop(animer)
    }
  }

  // ── Les voyages ──
  const partir = (c: QuadraticBezierCurve3, duree: number, pont: boolean) => {
    cam.decalage = 0
    return new Promise<void>(fin => {
      if (calme) {
        placerComete(c.getPoint(1).sub(new Vector3(0, 0.35, 0)))
        fin()
        return
      }
      voyage = { courbe: c, debut: performance.now(), duree, fin, pont }
      pause(false)
    })
  }
  const voyager = (de: string, vers: string) => {
    const ch = chemins.find(c => c.de === de && c.vers === vers)
    const A = iles.get(de)
    const B = iles.get(vers)
    if (!ch && (!A || !B)) return Promise.resolve()
    return partir(ch ? ch.courbe : courbe(A!.pos, B!.pos, false), 1.15, false)
  }
  const volerVersLActe = (a: number) => {
    const ch = chemins.find(p => p.pont && p.vers === `a${a}r0c1`)
    return ch ? partir(ch.courbe, 2.6, true) : Promise.resolve()
  }
  const sauterA = (id: string) => {
    voyage = null
    const x = iles.get(id)
    if (x) placerComete(x.pos)
  }

  // ── Les gestes : toucher une île, glisser pour regarder plus loin ──
  const el = renderer.domElement
  const rayon = new Raycaster()
  const souris = new Vector2()
  let geste: { x: number; y: number; decalage: number; bouge: boolean } | null = null
  const surBas = (e: PointerEvent) => {
    geste = { x: e.clientX, y: e.clientY, decalage: cam.decalage, bouge: false }
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Un pointeur déjà relâché : le geste suit quand même.
    }
  }
  const surMouvement = (e: PointerEvent) => {
    if (!geste) return
    const dy = e.clientY - geste.y
    const dx = e.clientX - geste.x
    if (Math.hypot(dx, dy) > 8) geste.bouge = true
    if (geste.bouge && etat.mode === 'carte' && !voyage) {
      cam.decalage = borne(geste.decalage + dy * 0.09, -8, 70)
      viser()
      pause(false)
    }
  }
  const surHaut = (e: PointerEvent) => {
    if (!geste) return
    if (!geste.bouge && etat.mode === 'carte') {
      const rect = el.getBoundingClientRect()
      souris.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      rayon.setFromCamera(souris, camera)
      const cibles = [...iles.values()].filter(x => x.atteignable).map(x => x.cible)
      const touche = rayon.intersectObjects(cibles)[0]
      if (touche) {
        cam.decalage = 0
        rappels.toucher(touche.object.userData.id as string)
      }
    }
    geste = null
  }
  const surRoulette = (e: WheelEvent) => {
    if (etat.mode !== 'carte' || voyage) return
    e.preventDefault()
    cam.decalage = borne(cam.decalage - e.deltaY * 0.03, -8, 70)
    viser()
    pause(false)
  }
  el.addEventListener('pointerdown', surBas)
  el.addEventListener('pointermove', surMouvement)
  el.addEventListener('pointerup', surHaut)
  el.addEventListener('wheel', surRoulette, { passive: false })
  const suivi = typeof ResizeObserver === 'function' ? new ResizeObserver(() => redimensionner()) : null
  suivi?.observe(conteneur)
  window.addEventListener('resize', redimensionner)
  // Une page cachée n'anime rien : le téléphone garde sa batterie.
  const auVoile = () => pause(document.visibilityState !== 'visible')
  document.addEventListener('visibilitychange', auVoile)
  redimensionner()
  renderer.setAnimationLoop(animer)

  return {
    construire,
    maj,
    voyager,
    volerVersLActe,
    sauterA,
    detruire() {
      renderer.setAnimationLoop(null)
      suivi?.disconnect()
      window.removeEventListener('resize', redimensionner)
      document.removeEventListener('visibilitychange', auVoile)
      el.removeEventListener('pointerdown', surBas)
      el.removeEventListener('pointermove', surMouvement)
      el.removeEventListener('pointerup', surHaut)
      el.removeEventListener('wheel', surRoulette)
      for (const x of duMonde) x.dispose()
      for (const x of jetables) x.dispose()
      bloom.dispose()
      composer.dispose()
      renderer.dispose()
      el.remove()
    },
  }
}

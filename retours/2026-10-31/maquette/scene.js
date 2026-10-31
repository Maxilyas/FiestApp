// La carte du Cabinet en 3D : trois archipels qui montent dans la nuit, un par acte.
// Chaque étape est une île ; les chemins sont des fils de lumière ; la comète, c'est toi.
// Reprend le ciel et les îles de la tour du 31 octobre (three.js 0.160, celui de l'application).
//
// La scène ne décide de rien : elle dessine la partie que jeu.js lui donne (`maj`), et ne
// rend qu'un geste, l'étape touchée (`toucher`). Sans WebGL, jeu.js se passe d'elle.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ACTE_Z = 76, RANG_Z = 12.5, COL_X = 5.9, MONTE = 15;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hache = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function creerScene(conteneur, opts) {
  await Promise.all([document.fonts.load('48px Marcellus'), document.fonts.load('700 30px "Nunito Sans"')]).catch(() => {});

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  conteneur.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07050e);
  scene.fog = new THREE.FogExp2(0x0b0718, 0.0062);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0x9d8cff, 0x1a1020, 0.6));
  const soleil = new THREE.DirectionalLight(0xffe2b0, 1.4); soleil.position.set(14, 40, -10); scene.add(soleil);
  const contre = new THREE.DirectionalLight(0x6fb8ff, 0.8); contre.position.set(-18, 12, 40); scene.add(contre);

  // ——— Les textures dessinées à la main ———
  function toile(l, h, dessin) {
    const c = document.createElement('canvas'); c.width = l; c.height = h;
    dessin(c.getContext('2d'), l, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const texPoint = toile(64, 64, (g, l) => { const d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.25, 'rgba(255,255,255,.7)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, l, l); });
  const texEtoile = toile(128, 128, g => {
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64); d.addColorStop(0, 'rgba(255,240,200,.9)'); d.addColorStop(0.3, 'rgba(255,210,120,.25)'); d.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = d; g.fillRect(0, 0, 128, 128);
    g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 36, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fillStyle = '#fff6d8'; g.fill();
  });
  const nebuleuse = couleur => toile(256, 256, g => { const d = g.createRadialGradient(128, 128, 0, 128, 128, 128); d.addColorStop(0, couleur); d.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = d; g.fillRect(0, 0, 256, 256); });
  // Les tirets qui défilent sur un chemin ouvert : la marche à suivre, sans un mot.
  const texTirets = toile(128, 16, g => { g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 128, 16); for (let x = 0; x < 128; x += 32) { g.fillStyle = '#fff'; g.fillRect(x, 0, 18, 16); } });
  texTirets.wrapS = THREE.RepeatWrapping; texTirets.colorSpace = THREE.NoColorSpace;

  const EMOJI_POLICE = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const cacheMedailles = new Map();
  function texMedaille(emoji, teinte) {
    const cle = emoji + teinte;
    if (cacheMedailles.has(cle)) return cacheMedailles.get(cle);
    const t = toile(256, 256, g => {
      const d = g.createRadialGradient(128, 110, 10, 128, 128, 120);
      d.addColorStop(0, `hsl(${teinte} 45% 30%)`); d.addColorStop(1, `hsl(${teinte} 55% 10%)`);
      g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.fillStyle = d; g.fill();
      const o = g.createLinearGradient(0, 0, 256, 256); o.addColorStop(0, '#fff1c4'); o.addColorStop(0.5, '#c8963f'); o.addColorStop(1, '#fbe3a0');
      g.lineWidth = 10; g.strokeStyle = o; g.stroke();
      g.font = `118px ${EMOJI_POLICE}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 128, 138);
    });
    cacheMedailles.set(cle, t); return t;
  }
  const chargeur = new THREE.TextureLoader();
  const cacheImages = new Map();
  function texImage(src) {
    if (!cacheImages.has(src)) { const t = chargeur.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cacheImages.set(src, t); }
    return cacheImages.get(src);
  }
  function texPortrait(src) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const g = c.getContext('2d');
      g.save(); g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.clip(); g.drawImage(img, 0, 0, 256, 256); g.restore();
      const d = g.createLinearGradient(0, 0, 256, 256); d.addColorStop(0, '#fff1c4'); d.addColorStop(0.5, '#c8963f'); d.addColorStop(1, '#fbe3a0');
      g.lineWidth = 12; g.strokeStyle = d; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.stroke();
      t.needsUpdate = true;
    };
    img.src = src;
    return t;
  }
  // Une étiquette : un titre (Marcellus) et une ligne dessous, dans une pastille de verre.
  function etiquette(titre, sous, { bord = 'rgba(247,220,154,.75)', couleur = '#f7dc9a' } = {}) {
    const T = 46, S = 30, m = document.createElement('canvas').getContext('2d');
    m.font = `${T}px Marcellus, serif`; const lt = m.measureText(titre).width;
    m.font = `700 ${S}px "Nunito Sans", sans-serif`; const ls = sous ? m.measureText(sous).width : 0;
    const l = Math.ceil(Math.max(lt, ls) + 56), h = sous ? 126 : 80;
    const tex = toile(l, h, g => {
      g.fillStyle = 'rgba(14,9,24,.78)'; g.strokeStyle = bord; g.lineWidth = 4;
      g.beginPath(); g.roundRect(2, 2, l - 4, h - 4, 30); g.fill(); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${T}px Marcellus, serif`; g.fillStyle = couleur; g.fillText(titre, l / 2, sous ? 44 : h / 2 + 3);
      if (sous) { g.font = `700 ${S}px "Nunito Sans", sans-serif`; g.fillStyle = '#cfc3dd'; g.fillText(sous, l / 2, 92); }
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    const k = 0.0096; sp.scale.set(l * k, h * k, 1); sp.renderOrder = 10; sp.center.set(0.5, 0);
    sp.userData.echelle = sp.scale.clone();
    return sp;
  }

  // ——— Le ciel : des étoiles, des nébuleuses, une galaxie sous les îles ———
  {
    const n = 3000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(260 + Math.random() * 160);
      pos.set([v.x, v.y + 40, v.z + 110], k * 3);
      c.setHSL(Math.random() < 0.3 ? 0.12 : 0.62, 0.5, 0.75 + Math.random() * 0.25); col.set([c.r, c.g, c.b], k * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  }
  let galaxie;
  {
    const n = 12000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    // Plus sombre que celle de la tour : ses bras passaient derrière les étiquettes et brouillaient la lecture.
    const coeur = new THREE.Color(1.2, 0.85, 0.45), violet = new THREE.Color(0.3, 0.2, 0.75), bleu = new THREE.Color(0.15, 0.5, 0.7), c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const bras = k % 4, r = Math.pow(Math.random(), 1.7) * 110 + 2;
      const a = bras / 4 * Math.PI * 2 + r * 0.06 + (Math.random() - 0.5) * 0.7 * (1.2 - r / 120);
      const ecart = (Math.random() - 0.5) * (2 + r * 0.08);
      pos.set([Math.cos(a) * r + ecart, (Math.random() - 0.5) * Math.max(0.4, 3 - r * 0.02), Math.sin(a) * r + ecart], k * 3);
      c.copy(coeur).lerp(k % 2 ? violet : bleu, Math.min(1, r / 60)); col.set([c.r, c.g, c.b], k * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    galaxie = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, map: texPoint, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    galaxie.position.set(0, -40, 110); galaxie.rotation.x = 0.1; scene.add(galaxie);
  }

  // ——— Les îles ———
  function geoRoche(graine, teinte) {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const p = geo.attributes.position, v = new THREE.Vector3(), cols = [];
    const haut = new THREE.Color().setHSL(teinte / 360, 0.34, 0.5), bas = new THREE.Color().setHSL(teinte / 360, 0.36, 0.07), c = new THREE.Color();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const n = Math.sin(v.x * 4.1 + graine) * Math.cos(v.z * 3.7 + graine * 1.3) * 0.13 + Math.sin(v.y * 5.3 + graine * 2.1) * 0.07;
      if (v.y < 0) { v.y *= 2.1 + n * 2.5; const serre = 1 + v.y * 0.2; v.x *= serre * (1 + n); v.z *= serre * (1 + n); }
      else { v.y = Math.min(v.y * 0.3, 0.1); v.x *= 1 + n * 0.4; v.z *= 1 + n * 0.4; }
      v.multiplyScalar(1.5);
      p.setXYZ(k, v.x, v.y, v.z);
      c.copy(bas).lerp(haut, clamp((v.y + 3) / 3.2, 0, 1) ** 1.6);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return geo;
  }
  const OR = new THREE.MeshStandardMaterial({ color: 0xe0b867, metalness: 1, roughness: 0.3, envMapIntensity: 0.7 });
  const geoSol = new THREE.CylinderGeometry(1.42, 1.5, 0.18, 48);
  const geoLisere = new THREE.TorusGeometry(1.47, 0.045, 8, 64);
  const geoCible = new THREE.SphereGeometry(2.6, 10, 8);
  const matCible = new THREE.MeshBasicMaterial({ visible: false });

  let monde = new THREE.Group(); scene.add(monde);
  let noeuds = new Map(), chemins = [], ponts = [], teintes = [152, 262, 32], etoilesDuChemin = [];
  let R = null, mode = 'titre', selection = null;
  const comete = new THREE.Group();
  {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.8), toneMapped: false }));
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoint, color: new THREE.Color(2, 1.5, 0.7), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    aura.scale.setScalar(2.6); comete.add(c, aura); scene.add(comete);
  }
  const traine = [];
  for (let k = 0; k < 14; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoint, color: new THREE.Color(1.8, 1.3, 0.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(1.2 - k * 0.06); scene.add(s); traine.push({ s, pos: new THREE.Vector3() });
  }

  const posDe = n => {
    const h = hache(n.id);
    const libre = n.type === 'epreuve' || n.type === 'tresor';
    return new THREE.Vector3(libre ? (n.col - 1) * COL_X + (h - 0.5) * 1.4 : 0, n.acte * MONTE + n.row * 0.55 + (h - 0.5) * 0.8, n.acte * ACTE_Z + n.row * RANG_Z + (h - 0.5) * 1.4);
  };
  const courbe = (a, b, pont) => {
    const A = a.clone().add(new THREE.Vector3(0, 0.35, 0)), B = b.clone().add(new THREE.Vector3(0, 0.35, 0));
    const M = A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, pont ? 9 : 1.1, 0));
    return new THREE.QuadraticBezierCurve3(A, M, B);
  };

  function vider() {
    scene.remove(monde);
    monde.traverse(o => { if (o.geometry && o.geometry !== geoSol && o.geometry !== geoLisere && o.geometry !== geoCible) o.geometry.dispose(); });
    monde = new THREE.Group(); scene.add(monde);
    noeuds = new Map(); chemins = []; ponts = []; etoilesDuChemin = [];
  }

  function construire(partie) {
    R = partie; vider();
    teintes = opts.teintes || teintes;
    const geos = teintes.map((t, a) => [0, 1, 2].map(k => geoRoche(a * 5 + k * 1.7 + 1, t)));
    // Une nébuleuse par acte, à sa teinte : on sait de loin où commence le suivant.
    teintes.forEach((t, a) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebuleuse(`hsla(${t},80%,55%,.85)`), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set(a % 2 ? 26 : -26, a * MONTE - 6, a * ACTE_Z + 34); sp.scale.set(110, 110, 1); monde.add(sp);
      const lueur = new THREE.PointLight(new THREE.Color().setHSL(t / 360, 0.7, 0.6), 60, 60, 1.6); lueur.position.set(0, a * MONTE + 8, a * ACTE_Z + 30); monde.add(lueur);
    });
    R.actes.forEach(acte => acte.noeuds.forEach(n => {
      const e = opts.etiquetteDe(n), t = teintes[n.acte], h = hache(n.id);
      const g = new THREE.Group(); g.position.copy(posDe(n)); monde.add(g);
      const grand = n.type === 'gardien' ? 1.45 : n.type === 'depart' ? 0.85 : 1;
      const roche = new THREE.Mesh(geos[n.acte][Math.floor(h * 3)], new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05, envMapIntensity: 0.25 }));
      roche.scale.setScalar(grand); roche.rotation.y = h * 6.28;
      const sol = new THREE.Mesh(geoSol, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(t / 360, 0.42, 0.4), roughness: 0.45, metalness: 0.15, envMapIntensity: 0.35 }));
      sol.scale.setScalar(grand); sol.position.y = 0.2 * grand;
      const lisere = new THREE.Mesh(geoLisere, OR); lisere.rotation.x = Math.PI / 2; lisere.position.y = 0.3 * grand; lisere.scale.setScalar(grand);
      g.add(roche, sol, lisere);
      let medaille = null, haut = 1.9;
      if (n.type === 'epreuve' || n.type === 'marchand') {
        medaille = new THREE.Sprite(new THREE.SpriteMaterial({ map: texMedaille(e.emoji, t), transparent: true, depthWrite: false }));
        medaille.scale.setScalar(2.1); medaille.position.y = 1.65;
      } else if (n.type === 'tresor') {
        medaille = new THREE.Sprite(new THREE.SpriteMaterial({ map: texImage('decors/coffre-ferme.webp'), transparent: true, depthWrite: false }));
        medaille.scale.set(2.4, 2.5, 1); medaille.position.y = 1.45;
      } else if (n.type === 'gardien') {
        medaille = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPortrait(e.img), transparent: true, depthWrite: false }));
        medaille.scale.setScalar(4.2); medaille.position.y = 3.2; haut = 5.4;
        const feu = new THREE.PointLight(new THREE.Color().setHSL(t / 360, 0.8, 0.6), 30, 14, 1.8); feu.position.y = 2.5; g.add(feu);
      } else {
        medaille = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoint, color: new THREE.Color().setHSL(t / 360, 0.8, 0.75), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        medaille.scale.setScalar(1.6); medaille.position.y = 0.9; haut = 1.6;
      }
      medaille.userData.y = medaille.position.y; medaille.userData.echelle = medaille.scale.clone();
      // Le halo passe derrière la médaille : devant, il délavait l'emoji et le portrait.
      medaille.renderOrder = 3;
      g.add(medaille);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoint, color: new THREE.Color(1.3, 1.0, 0.5), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      halo.scale.setScalar(n.type === 'gardien' ? 6.2 : 3.6); halo.position.set(0, medaille.position.y, 0.4); halo.renderOrder = 2; halo.visible = false; g.add(halo);
      const lab = etiquette(e.titre, e.sous, n.type === 'gardien' ? { bord: 'rgba(255,150,130,.85)', couleur: '#ffd9c9' } : {});
      lab.position.y = haut + (n.type === 'gardien' ? 0 : 0.4); g.add(lab);
      const cible = new THREE.Mesh(geoCible, matCible); cible.position.y = 1.4; cible.userData.id = n.id; g.add(cible);
      noeuds.set(n.id, { n, g, medaille, halo, lab, cible, pos: g.position.clone(), h });
    }));
    // Les chemins d'un acte, puis le pont de lumière qui mène à l'acte suivant.
    R.actes.forEach(acte => acte.noeuds.forEach(n => n.liens.forEach(v => ajouterChemin(n.id, v, false))));
    for (let a = 0; a < 2; a++) ajouterChemin(`a${a}r5c1`, `a${a + 1}r0c1`, true);
  }
  function ajouterChemin(de, vers, pont) {
    const A = noeuds.get(de), B = noeuds.get(vers);
    const c = courbe(A.pos, B.pos, pont);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, pont ? 90 : 40, pont ? 0.09 : 0.065, 8), mat);
    const matTirets = new THREE.MeshBasicMaterial({ map: texTirets.clone(), color: new THREE.Color(2.6, 2.1, 1.2), toneMapped: false, transparent: true, depthWrite: false });
    matTirets.map.wrapS = THREE.RepeatWrapping; matTirets.map.repeat.set(Math.max(2, Math.round(c.getLength() / 1.6)), 1); matTirets.map.needsUpdate = true;
    const tirets = new THREE.Mesh(new THREE.TubeGeometry(c, pont ? 90 : 40, pont ? 0.12 : 0.1, 8), matTirets);
    tirets.visible = false;
    const etoiles = [];
    for (let u = 0.15; u < 0.9; u += pont ? 0.06 : 0.17) {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEtoile, color: new THREE.Color(2, 1.6, 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      e.position.copy(c.getPoint(u)); e.scale.setScalar(0.5); e.userData.phase = u * 20 + hache(de + vers) * 9; e.visible = false; monde.add(e); etoiles.push(e); etoilesDuChemin.push(e);
    }
    monde.add(mesh, tirets);
    const ch = { de, vers, courbe: c, mesh, mat, tirets, etoiles, pont };
    (pont ? ponts : chemins).push(ch);
  }

  // ——— L'état : qui brille, qui dort, où regarde la caméra ———
  const cam = { cible: new THREE.Vector3(0, 10, 80), but: new THREE.Vector3(0, 10, 80), recul: 2.4, reculBut: 1, decalage: 0 };
  let voyage = null;   // { courbe, t, duree, fin }
  const noeudDe = id => R.actes[+id[1]].noeuds.find(n => n.id === id);
  const ici = () => (R.enRoute || R.position);

  function maj(partie, o) {
    R = partie; mode = o.mode; selection = o.selection;
    const visites = new Set(R.visites), pos = ici(), rangIci = noeudDe(pos).row;
    const ouverts = !R.enRoute && R.etape === 'carte' && mode === 'carte' ? noeudDe(R.position).liens : [];
    for (const [id, x] of noeuds) {
      const n = x.n, atteignable = ouverts.includes(id), choisi = selection === id;
      const futur = n.acte > R.acte, passe = n.acte < R.acte || (n.acte === R.acte && n.row <= rangIci && id !== pos && !visites.has(id));
      const vu = visites.has(id) && id !== pos;
      x.etat = { atteignable, choisi };
      x.medaille.material.opacity = passe ? 0.28 : futur ? 0.55 : 1;
      x.medaille.material.color.setScalar(vu ? 0.5 : passe ? 0.6 : 1);
      if (n.type === 'tresor' && R.tresors && R.tresors[id] && R.tresors[id].ouvert) x.medaille.material.map = texImage('decors/coffre-ouvert.webp');
      x.halo.visible = atteignable || (n.type === 'gardien' && !futur && mode === 'carte') || (mode === 'titre' && n.type === 'gardien');
      x.lab.visible = mode === 'carte' ? (atteignable || (n.type === 'gardien' && n.acte === R.acte) || (n.type === 'depart' && id === pos && n.acte === R.acte && !R.enRoute)) : n.type === 'gardien';
      x.lab.material.opacity = choisi ? 1 : 0.94;
    }
    for (const ch of chemins.concat(ponts)) {
      const iDe = R.visites.indexOf(ch.de), iVers = R.visites.indexOf(ch.vers);
      const parcouru = iDe >= 0 && iVers === iDe + 1;
      const ouvert = ch.de === R.position && ouverts.includes(ch.vers);
      const nDe = noeudDe(ch.de), futur = nDe.acte > R.acte || (ch.pont && nDe.acte >= R.acte);
      const choisi = ouvert && ch.vers === selection;
      ch.mat.color.copy(parcouru ? new THREE.Color(2.4, 1.75, 0.8) : ouvert ? new THREE.Color(1.2, 1.0, 0.7) : futur ? new THREE.Color(0.2, 0.17, 0.32) : new THREE.Color(0.28, 0.22, 0.42));
      ch.mat.opacity = parcouru || ouvert ? 1 : futur ? 0.5 : 0.75;
      ch.tirets.visible = ouvert && (!selection || choisi);
      ch.etoiles.forEach(e => { e.visible = parcouru; });
    }
    if (!voyage) placerComete(noeuds.get(pos).pos);
    viser();
    pause(o.pause);
  }
  function placerComete(p) { comete.position.copy(p).add(new THREE.Vector3(0, 0.9, 0)); }

  // La caméra regarde un peu devant la comète, vers l'étape choisie s'il y en a une.
  function viser() {
    if (mode === 'titre') { cam.but.set(0, 4, 36); cam.reculBut = 1; return; }
    const p = voyage ? comete.position.clone() : noeuds.get(ici()).pos.clone();
    const sel = selection && noeuds.get(selection);
    // La comète reste au bas de la carte visible, les étapes suivantes au-dessus d'elle.
    if (sel) cam.but.set(p.x * 0.45 + sel.pos.x * 0.55, (p.y + sel.pos.y) / 2, p.z * 0.45 + sel.pos.z * 0.55 + 3);
    else cam.but.set(p.x * 0.6, p.y + 0.6, p.z + 7.5);
    cam.but.z += cam.decalage;
    cam.reculBut = voyage && voyage.pont ? 1.5 : 1;
  }

  function placerCamera(t) {
    if (mode === 'titre') {
      const c = cam.cible;
      // Le premier archipel au centre, les deux autres qui montent derrière lui dans la nuit.
      camera.position.set(c.x + Math.sin(t * 0.08) * 12, c.y + 50, c.z - 70);
      camera.lookAt(c.x, c.y, c.z);
      return;
    }
    const c = cam.cible, r = cam.recul;
    camera.position.set(c.x * 0.7, c.y + 19 * r, c.z - 21 * r);
    camera.lookAt(c.x * 0.85, c.y - 1, c.z + 3);
  }

  // Le panneau couvre le bas de l'écran : on décale le cadre pour que la carte vive au-dessus.
  function redimensionner() {
    const l = innerWidth, h = innerHeight;
    renderer.setSize(l, h); composer.setSize(l, h);
    camera.aspect = l / h;
    const portrait = l / h < 1;
    camera.fov = portrait ? 56 : 46;
    camera.setViewOffset(l, h, 0, Math.round(h * (portrait ? 0.15 : 0.08)), l, h);
    camera.updateProjectionMatrix();
    if (enPause) rendreUneFois();
  }

  // ——— Les voyages ———
  function voyager(de, vers) {
    const ch = chemins.find(c => c.de === de && c.vers === vers);
    return partir(ch ? ch.courbe : courbe(noeuds.get(de).pos, noeuds.get(vers).pos, false), 1.15, false);
  }
  function volerVersActe(a) {
    const ch = ponts.find(p => p.vers === `a${a}r0c1`);
    return partir(ch.courbe, 2.6, true);
  }
  function partir(c, duree, pont) {
    cam.decalage = 0;
    return new Promise(fin => {
      if (calme) { placerComete(c.getPoint(1).sub(new THREE.Vector3(0, 0.35, 0))); fin(); return; }
      voyage = { courbe: c, debut: performance.now(), duree, fin, pont };
      pause(false);
    });
  }
  function sauterA(id) { voyage = null; placerComete(noeuds.get(id).pos); }
  function ouvrirCoffre(id) { const x = noeuds.get(id); if (x) x.medaille.material.map = texImage('decors/coffre-ouvert.webp'); }

  // ——— La boucle ———
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.65, 0.5, 1.05));
  composer.addPass(new OutputPass());
  const horloge = new THREE.Clock();
  let enPause = false;
  function animer() {
    const dt = Math.min(horloge.getDelta(), 0.05), t = horloge.elapsedTime;
    const lisse = k => 1 - Math.exp(-dt * k);
    if (voyage) {
      // Le voyage suit l'horloge, pas les images : un téléphone lent arrive à l'heure, en sautant des images.
      const u = clamp((performance.now() - voyage.debut) / (voyage.duree * 1000), 0, 1), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      comete.position.copy(voyage.courbe.getPoint(e)).add(new THREE.Vector3(0, 0.55, 0));
      viser();
      if (u >= 1) { const f = voyage.fin; voyage = null; viser(); f(); }
    }
    cam.cible.lerp(cam.but, calme ? 1 : lisse(voyage ? 6 : 2.6));
    cam.recul += (cam.reculBut - cam.recul) * (calme ? 1 : lisse(1.6));
    placerCamera(t);
    galaxie.rotation.y += dt * 0.015;
    for (const [, x] of noeuds) {
      const vise = x.etat && x.etat.choisi ? 1.22 : 1;
      x.medaille.scale.lerp(x.medaille.userData.echelle.clone().multiplyScalar(vise), lisse(8));
      if (!calme) x.medaille.position.y = x.medaille.userData.y + Math.sin(t * 1.4 + x.h * 9) * 0.12;
      if (x.halo.visible) x.halo.material.opacity = (x.etat && x.etat.choisi ? 0.7 : 0.38) + Math.sin(t * 3 + x.h * 7) * 0.16;
      x.lab.scale.copy(x.lab.userData.echelle).multiplyScalar(x.etat && x.etat.choisi ? 1.12 : 1);
    }
    for (const ch of chemins.concat(ponts)) if (ch.tirets.visible) ch.tirets.material.map.offset.x -= dt * 0.9;
    etoilesDuChemin.forEach(e => { if (e.visible) e.scale.setScalar(0.42 + Math.sin(t * 3 + e.userData.phase) * 0.14); });
    if (!calme) comete.children[1].scale.setScalar(2.4 + Math.sin(t * 4) * 0.3);
    // La traîne suit la comète avec un temps de retard.
    let prec = comete.position;
    traine.forEach((q, k) => { q.pos.lerp(prec, lisse(18 - k)); q.s.position.copy(q.pos); q.s.material.opacity = voyage ? 0.5 * (1 - k / traine.length) : Math.max(0, q.s.material.opacity - dt * 1.5); prec = q.pos; });
    composer.render();
  }
  function rendreUneFois() { placerCamera(horloge.elapsedTime); composer.render(); }
  function pause(oui) {
    if (oui && !voyage) { if (!enPause) { enPause = true; renderer.setAnimationLoop(null); rendreUneFois(); } }
    else if (enPause) { enPause = false; horloge.getDelta(); renderer.setAnimationLoop(animer); }
  }

  // ——— Les gestes : toucher une île, glisser pour regarder plus loin ———
  {
    const el = renderer.domElement, ray = new THREE.Raycaster(), souris = new THREE.Vector2();
    let g = null;
    el.addEventListener('pointerdown', e => { g = { y: e.clientY, x: e.clientX, decalage: cam.decalage, bouge: false }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!g) return;
      const dy = e.clientY - g.y, dx = e.clientX - g.x;
      if (Math.hypot(dx, dy) > 8) g.bouge = true;
      if (g.bouge && mode === 'carte' && !voyage) { cam.decalage = clamp(g.decalage + dy * 0.09, -8, 70); viser(); }
    });
    el.addEventListener('pointerup', e => {
      if (!g) return;
      if (!g.bouge && mode === 'carte') {
        const rect = el.getBoundingClientRect();
        souris.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        ray.setFromCamera(souris, camera);
        const cibles = [...noeuds.values()].filter(x => x.etat && x.etat.atteignable).map(x => x.cible);
        const touche = ray.intersectObjects(cibles)[0];
        if (touche) { cam.decalage = 0; opts.toucher(touche.object.userData.id); }
      }
      g = null;
    });
    el.addEventListener('wheel', e => { if (mode !== 'carte' || voyage) return; e.preventDefault(); cam.decalage = clamp(cam.decalage - e.deltaY * 0.03, -8, 70); viser(); }, { passive: false });
  }

  addEventListener('resize', redimensionner);
  redimensionner();
  renderer.setAnimationLoop(animer);

  return { construire, maj, voyager, volerVersActe, sauterA, ouvrirCoffre };
}

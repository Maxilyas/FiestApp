// Maquette — le médaillon qui suit : le compagnon reste l'avatar qu'on porte,
// peint comme l'appli le peint (son décor, son anneau, la tête qui sort du
// cercle), et c'est ce médaillon-là qui suit le joueur en haut à droite des
// écrans du quiz et qui vit : ses humeurs peintes, posées au pixel près sur le
// dessin livré, le souffle retenu, nourri, dépité, la sortie. Le SVG est celui
// que l'appli a dessiné dans l'en-tête, recopié. Chargé après niche.js (sa
// réserve de place). Rien de ceci n'existe dans le code.
;(() => {
  const q = s => document.querySelector(s)
  const pause = ms => new Promise(r => setTimeout(r, ms))
  const TAILLE = 58
  const HAUT = 22
  const DROITE = 16

  const COEUR = '<svg viewBox="0 0 24 24"><path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill="#e8739a"/></svg>'
  const ETINCELLE = '<svg viewBox="0 0 24 24"><path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="#ffe7a3"/></svg>'
  const PLUIE = '<svg viewBox="0 0 40 30"><path d="M10 20h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 3 7.5 7.5 0 0 0 10 20Z" fill="#8a93a3"/><g stroke="#9cc8f5" stroke-width="2" stroke-linecap="round"><path class="md-goutte" d="M14 22l-1 4"/><path class="md-goutte" style="animation-delay:.3s" d="M21 22l-1 4"/><path class="md-goutte" style="animation-delay:.6s" d="M28 22l-1 4"/></g></svg>'

  const CSS = `
.md{position:fixed;top:${HAUT}px;right:${DROITE}px;width:${TAILLE}px;height:${TAILLE}px;z-index:50;pointer-events:none;transform-origin:100% 0;transition:transform .35s cubic-bezier(.3,.7,.3,1)}
/* À la révélation, il grandit le temps de sa réaction : à 58 px, son visage peint est trop petit pour qu'on lise son humeur. */
.md.md-grand{transform:scale(1.32)}
.md > svg.pt{position:absolute;inset:0;width:${TAILLE}px!important;height:${TAILLE}px!important;overflow:visible;display:block;font-size:${TAILLE}px}
.md image.md-perso{transform-box:fill-box;transform-origin:50% 92%;transition:transform .45s cubic-bezier(.3,.7,.3,1),opacity .15s ease}
.md image.md-disque{transition:filter .45s ease}
/* Il retient son souffle : penché vers la page, son ciel s'assombrit. */
.md.md-retient image.md-perso{transform:translate(-2px,1px) scale(1.05)}
.md.md-retient image.md-disque{filter:brightness(.55) saturate(.8)}
/* Ses humeurs : la lueur de l'anneau, la nuit qui tombe sur son ciel. */
.md::before{content:'';position:absolute;inset:-3px;border-radius:50%;box-shadow:0 0 0 rgba(244,213,141,0);transition:box-shadow .5s ease}
.md.ravi::before{box-shadow:0 0 14px 2px rgba(244,213,141,.6)}
.md.triomphe::before{box-shadow:0 0 20px 4px rgba(255,226,150,.75)}
.md.depite image.md-disque{filter:brightness(.5) saturate(.5)}
.md-pluie{position:absolute;left:8px;top:8px;width:22px;opacity:0;transition:opacity .4s ease;z-index:2}
.md.depite .md-pluie{opacity:1}
.md-goutte{animation:md-goutte .9s linear infinite}
@keyframes md-goutte{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(8px);opacity:0}}
.md.md-saute image.md-perso{animation:md-saute .8s cubic-bezier(.3,.6,.35,1)}
@keyframes md-saute{0%{transform:translateY(0) scale(1,1)}18%{transform:translateY(2px) scale(1.05,.94)}45%{transform:translateY(-10px) scale(.97,1.05)}70%{transform:translateY(0) scale(1.04,.96)}100%{transform:translateY(0) scale(1,1)}}
.md.md-abat image.md-perso{animation:md-abat .9s ease-out forwards}
@keyframes md-abat{0%{transform:translateY(0)}40%{transform:translateY(4px) scale(1.02,.96)}100%{transform:translateY(3px) scale(1.01,.97)}}
.md.md-vide image.md-perso{opacity:0}
/* L'anneau qui se remplit : le chemin vers sa forme suivante, le temps d'un repas. */
.md-jauge{position:absolute;inset:-5px;width:calc(100% + 10px);height:calc(100% + 10px);overflow:visible;opacity:0;transition:opacity .35s ease;transform:rotate(-90deg)}
.md.md-jauge-vue .md-jauge{opacity:1}
.md-jauge circle{fill:none;stroke-width:2.6;stroke-linecap:round}
.md-jauge .fond{stroke:rgba(255,246,220,.16)}
.md-jauge .plein{stroke:#ffd86a;filter:drop-shadow(0 0 2px rgba(255,236,190,.9));transition:stroke-dashoffset .8s cubic-bezier(.3,.7,.3,1)}
.md-fx{position:absolute;inset:0;overflow:visible;z-index:3}
.md-fx span,.md-dehors-fx span{position:absolute;display:block}
.md-fx svg,.md-dehors-fx svg{display:block;width:100%;height:100%}
.md-coeur{animation:md-coeur 1.6s ease-out forwards}
@keyframes md-coeur{0%{opacity:0;transform:translate(0,0) scale(.4)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.1) rotate(var(--r))}}
.md-plus{position:absolute;right:100%;margin-right:8px;top:20px;font:700 14px/1 Figtree,system-ui,sans-serif;color:#ffe08a;text-shadow:0 1px 3px rgba(0,0,0,.7);white-space:nowrap;animation:md-plus 1.4s ease-out forwards}
@keyframes md-plus{0%{opacity:0;transform:translateY(8px)}18%{opacity:1;transform:translateY(0)}75%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
.md-etincelle{position:fixed;left:0;top:0;z-index:58;pointer-events:none;filter:drop-shadow(0 0 6px rgba(255,226,150,.95))}
.md-etincelle svg{display:block;width:100%;height:100%}
.md-bulle{position:fixed;z-index:56;display:flex;align-items:center;justify-content:center;gap:3px;height:42px;min-width:48px;box-sizing:border-box;padding:0 11px;border-radius:15px;background:#f6efe3;border:1.5px solid #d9b56a;box-shadow:0 8px 18px rgba(0,0,0,.5);transform-origin:100% 50%;animation:md-bulle .4s cubic-bezier(.3,1.6,.5,1) both}
.md-bulle::after{content:'';position:absolute;right:-7px;top:50%;width:11px;height:11px;margin-top:-6px;background:#f6efe3;border-right:1.5px solid #d9b56a;border-top:1.5px solid #d9b56a;transform:rotate(45deg)}
.md-bulle span{display:block;width:22px;height:22px}
.md-bulle span.petit{width:16px;height:16px;margin-top:-10px}
.md-bulle svg{display:block;width:100%;height:100%}
.md-bulle.md-sort{animation:md-bulle-sort .3s ease-in forwards}
@keyframes md-bulle{0%{opacity:0;transform:scale(.2) translateX(14px)}100%{opacity:1;transform:scale(1)}}
@keyframes md-bulle-sort{to{opacity:0;transform:scale(.6) translateX(12px)}}
/* Dehors : il sort en grand ; le médaillon garde son ciel. */
.md-dehors{position:fixed;left:0;top:0;z-index:57;pointer-events:none;transform-origin:0 0}
.md-dehors img{position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1);transform-origin:50% 100%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.md-dehors .md-ombre{position:absolute;left:14%;right:14%;bottom:-5%;height:12%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),rgba(0,0,0,0));opacity:0;transition:opacity .3s ease}
.md-dehors .md-rayons{position:absolute;left:50%;top:50%;width:210%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(244,213,141,.32) 0deg 5deg,rgba(244,213,141,0) 5deg 15deg);-webkit-mask:radial-gradient(closest-side,#000 18%,transparent 70%);mask:radial-gradient(closest-side,#000 18%,transparent 70%);opacity:0;transition:opacity .4s ease;animation:md-tourne 10s linear infinite}
.md-dehors.md-pose .md-rayons,.md-dehors.md-pose .md-ombre{opacity:1}
.md-dehors.md-pose img{animation:md-atterrit .5s cubic-bezier(.3,.6,.35,1)}
.md-dehors img.md-hop{animation:md-hop .8s cubic-bezier(.3,.6,.35,1)!important}
.md-dehors-fx{position:absolute;inset:0;overflow:visible}
@keyframes md-atterrit{0%{transform:scaleX(-1) scale(1.08,.88)}55%{transform:scaleX(-1) scale(.97,1.05)}100%{transform:scaleX(-1) scale(1,1)}}
@keyframes md-hop{0%{transform:scaleX(-1) translateY(0) scale(1,1)}18%{transform:scaleX(-1) translateY(3px) scale(1.05,.94)}45%{transform:scaleX(-1) translateY(-22px) scale(.97,1.05)}70%{transform:scaleX(-1) translateY(0) scale(1.04,.96)}100%{transform:scaleX(-1) translateY(0) scale(1,1)}}
@keyframes md-tourne{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
.md-doigt{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(255,255,255,.9);background:rgba(255,255,255,.25);z-index:90;pointer-events:none;animation:md-doigt .7s ease-out forwards}
@keyframes md-doigt{0%{transform:scale(.6);opacity:0}25%{opacity:1}100%{transform:scale(1.25);opacity:0}}
`
  function styles() {
    if (document.getElementById('md-styles')) return
    const s = document.createElement('style')
    s.id = 'md-styles'
    s.textContent = CSS
    document.head.appendChild(s)
  }
  const md = () => q('.md')
  let etat = null

  /**
   * Le médaillon : o = { svg (le SVG de l'avatar, tel que l'appli l'a dessiné),
   * humeurs: { ravi, depite, triomphe } (posées dans le carré du dessin livré),
   * grandes: { ravi, triomphe } (détourées, pour la sortie), part (sa jauge) }.
   */
  function poser(o) {
    styles()
    md()?.remove()
    // Ses identifiants, renommés : l'original reste dans la page, et le premier d'un nom gagne.
    const tmp = document.createElement('div')
    tmp.innerHTML = o.svg
    const svg = tmp.querySelector('svg')
    const prefixe = svg.querySelector('clipPath').id.replace(/_clip$/, '')
    tmp.innerHTML = o.svg.split(prefixe).join('mdq-')
    const el = document.createElement('div')
    el.className = 'md neutre'
    el.setAttribute('aria-hidden', 'true')
    const r = 49
    const tour = 2 * Math.PI * r
    el.innerHTML = `<svg class="md-jauge" viewBox="0 0 100 100"><circle class="fond" cx="50" cy="50" r="${r}"/><circle class="plein" cx="50" cy="50" r="${r}" stroke-dasharray="${tour}" stroke-dashoffset="${tour * (1 - (o.part ?? 0) / 100)}"/></svg><span class="md-pluie">${PLUIE}</span><span class="md-fx"></span>`
    el.prepend(tmp.querySelector('svg'))
    document.body.appendChild(el)
    const images = [...el.querySelectorAll('svg.pt image')]
    let perso = null
    for (const i of images) {
      const href = i.getAttribute('href') || ''
      if (href.includes('-perso-')) {
        i.classList.add('md-perso')
        perso = href
      } else if (href.includes('-disque-')) i.classList.add('md-disque')
    }
    etat = { perso, humeurs: { neutre: perso, ...o.humeurs }, grandes: o.grandes, tour, part: o.part ?? 0 }
    return el
  }

  /** Une humeur peinte : ses images, sa lueur, et parfois un geste. */
  function humeur(h, { geste } = {}) {
    const el = md()
    if (!el || !etat) return
    el.classList.remove('neutre', 'ravi', 'depite', 'triomphe', 'md-saute', 'md-abat')
    // Revenu au calme, il reprend sa taille.
    if (h === 'neutre') el.classList.remove('md-grand')
    void el.offsetWidth
    el.classList.add(h)
    for (const i of el.querySelectorAll('image.md-perso')) i.setAttribute('href', etat.humeurs[h] || etat.perso)
    if (geste) el.classList.add(`md-${geste}`)
    if (h === 'ravi') coeurs(el.querySelector('.md-fx'), [-4, 10], 1)
  }
  function coeurs(fx, [x0, y0], echelle) {
    ;[
      [-4, 10, -46, 26, -16],
      [2, 22, -62, 6, 14],
      [-8, 30, -40, 44, -8],
      [6, 4, -70, 30, 18],
    ].forEach(([x, y, dx, dy, r], k) => {
      const s = document.createElement('span')
      s.className = 'md-coeur'
      const t = (12 + (k % 2) * 3) * echelle
      s.style.cssText = `left:${x0 + x * echelle}px;top:${y0 + y * echelle}px;width:${t}px;height:${t}px;--dx:${dx * echelle}px;--dy:${dy * echelle}px;--r:${r}deg;animation-delay:${k * 0.14}s`
      s.innerHTML = COEUR
      fx.appendChild(s)
      setTimeout(() => s.remove(), 2200 + k * 140)
    })
  }

  function grandir() {
    md()?.classList.add('md-grand')
  }
  function retenir() {
    md()?.classList.add('md-retient')
  }
  function relacher() {
    md()?.classList.remove('md-retient')
  }

  /** Une bonne réponse le nourrit : des étincelles volent de la carte jusqu'à lui, et son anneau se remplit. */
  async function nourrir({ de, part, plus = '+1', vue = 1600 }) {
    const el = md()
    const source = q(de)
    if (!el || !source || !etat) return
    const a = source.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    const depart = { x: a.left + a.width / 2, y: a.top + a.height / 2 }
    const arrivee = { x: b.left + b.width / 2, y: b.top + b.height * 0.6 }
    const vols = [0, 1, 2].map(k => {
      const s = document.createElement('span')
      const taille = k === 0 ? 18 : 11
      s.className = 'md-etincelle'
      s.style.cssText = `width:${taille}px;height:${taille}px`
      s.innerHTML = ETINCELLE
      document.body.appendChild(s)
      const images = []
      for (let i = 0; i <= 24; i++) {
        const t = i / 24
        const x = depart.x + (arrivee.x - depart.x) * t - Math.sin(t * Math.PI) * (60 - k * 22)
        const y = depart.y + (arrivee.y - depart.y) * t - Math.sin(t * Math.PI) * (40 + k * 18)
        images.push({ transform: `translate(${x - taille / 2}px,${y - taille / 2}px) rotate(${t * 220}deg) scale(${1 - t * 0.35})`, opacity: i === 24 ? 0.3 : 1 })
      }
      return s.animate(images, { duration: 820, delay: k * 120, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' }).finished.then(() => s.remove())
    })
    clearTimeout(nourrir.minuteur)
    el.classList.add('md-jauge-vue')
    await pause(860)
    if (part !== undefined) {
      etat.part = part
      el.querySelector('.md-jauge .plein').style.strokeDashoffset = `${etat.tour * (1 - part / 100)}`
    }
    const p = document.createElement('span')
    p.className = 'md-plus'
    p.textContent = plus
    el.appendChild(p)
    setTimeout(() => p.remove(), 1500)
    humeur('ravi', { geste: 'saute' })
    await Promise.all(vols)
    nourrir.minuteur = setTimeout(() => el.classList.remove('md-jauge-vue'), vue)
  }

  /** Une bulle d'émote, à gauche du médaillon. */
  function bulle(sorte, duree = 1700) {
    const el = md()
    if (!el) return
    const r = el.getBoundingClientRect()
    const b = document.createElement('div')
    b.className = 'md-bulle'
    b.style.top = `${r.top + 8}px`
    b.style.right = `${innerWidth - r.left + 10}px`
    b.innerHTML = sorte === 'ravi' ? `<span>${COEUR}</span><span class="petit">${COEUR}</span>` : `<span>${COEUR}</span>`
    document.body.appendChild(b)
    setTimeout(() => b.classList.add('md-sort'), duree)
    setTimeout(() => b.remove(), duree + 350)
  }

  /** Le grand moment : il sort du médaillon, en grand, se pose (x, y = ses pattes) ; le médaillon garde son ciel. */
  let dehorsEtat = null
  async function dehors({ x, y, h = 132, humeur: hm = 'triomphe' }) {
    const el = md()
    if (!el || !etat) return
    const src = etat.grandes[hm]
    const img = new Image()
    img.src = src
    await img.decode()
    const w = Math.round(h * (img.naturalWidth / img.naturalHeight))
    const perso = el.querySelector('image.md-perso').getBoundingClientRect()
    const sortie = document.createElement('div')
    sortie.className = 'md-dehors'
    sortie.style.cssText = `width:${w}px;height:${h}px`
    sortie.innerHTML = `<span class="md-rayons"></span><span class="md-ombre"></span><img alt="" src="${src}"><span class="md-dehors-fx"></span>`
    document.body.appendChild(sortie)
    // Il part de là où il se tient dans son médaillon : son dessin y fait 85 % du carré peint.
    const depart = { x: perso.left + perso.width / 2, y: perso.top + perso.height * 0.92, s: (perso.height * 0.85) / h }
    const images = []
    for (let i = 0; i <= 28; i++) {
      const t = i / 28
      const s = depart.s + (1 - depart.s) * t
      const px = depart.x + (x - depart.x) * t
      const py = depart.y + (y - depart.y) * t - Math.sin(t * Math.PI) * 70
      images.push({ transform: `translate(${px - (w * s) / 2}px,${py - h * s}px) scale(${s})` })
    }
    humeur('neutre')
    el.classList.add('md-vide')
    await sortie.animate(images, { duration: 640, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' }).finished
    sortie.classList.add('md-pose')
    dehorsEtat = { sortie, images, w, h }
  }
  function caresserDehors() {
    if (!dehorsEtat) return
    const { sortie, w, h } = dehorsEtat
    const img = sortie.querySelector('img')
    img.src = etat.grandes.ravi
    img.classList.remove('md-hop')
    void img.offsetWidth
    img.classList.add('md-hop')
    coeurs(sortie.querySelector('.md-dehors-fx'), [w * 0.3, h * 0.12], 1.6)
  }
  async function rentrer() {
    if (!dehorsEtat) return
    const { sortie, images } = dehorsEtat
    dehorsEtat = null
    sortie.classList.remove('md-pose')
    await sortie.animate(images.slice().reverse(), { duration: 580, easing: 'cubic-bezier(.6,0,.6,1)', fill: 'forwards' }).finished
    sortie.remove()
    md()?.classList.remove('md-vide')
    humeur('ravi', { geste: 'saute' })
  }

  function doigt(x, y) {
    styles()
    const d = document.createElement('span')
    d.className = 'md-doigt'
    d.style.left = `${x}px`
    d.style.top = `${y}px`
    document.body.appendChild(d)
    setTimeout(() => d.remove(), 800)
  }

  window.__medaillon = { poser, humeur, grandir, retenir, relacher, nourrir, bulle, dehors, caresserDehors, rentrer, doigt }
})()

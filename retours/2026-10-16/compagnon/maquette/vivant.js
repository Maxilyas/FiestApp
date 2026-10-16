// Maquette — le compagnon vivant : posé dans les vraies pages au moment du
// film, il respire, sourit, saute de joie, baisse les oreilles, hurle au
// podium et grandit, avec ses humeurs peintes (`/mq-humeurs/…`, servies par la
// maquette). Rien de ceci n'existe dans le code de l'application.
;(() => {
  const CSS = `
.mqv{position:absolute;pointer-events:none;z-index:70;transition:left .75s cubic-bezier(.34,.72,.3,1),top .75s cubic-bezier(.34,.72,.3,1),width .5s ease,height .5s ease,opacity .45s ease}
.mqv.mqv-fixe{position:fixed}
.mqv-ombre{position:absolute;left:12%;right:12%;bottom:-4%;height:12%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.62),rgba(0,0,0,0))}
.mqv-corps{position:absolute;inset:0;transform-origin:50% 100%;animation:mqv-respire 3.6s ease-in-out infinite}
.mqv-geste{position:absolute;inset:0;transform-origin:50% 100%}
.mqv-geste img{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .22s ease;filter:drop-shadow(0 3px 7px rgba(0,0,0,.42))}
.mqv-geste img.on{opacity:1}
.mqv-miroir .mqv-geste img{transform:scaleX(-1)}
@keyframes mqv-respire{0%,100%{transform:scale(1,1)}50%{transform:scale(1.013,1.032)}}
.mqv-saute .mqv-geste{animation:mqv-saute .95s cubic-bezier(.3,.6,.35,1)}
.mqv-saute .mqv-ombre{animation:mqv-ombre .95s cubic-bezier(.3,.6,.35,1)}
@keyframes mqv-saute{0%{transform:translateY(0) scale(1,1)}14%{transform:translateY(1%) scale(1.06,.92)}38%{transform:translateY(-24%) scale(.96,1.06)}62%{transform:translateY(0) scale(1.06,.93)}78%{transform:translateY(-6%) scale(.99,1.02)}100%{transform:translateY(0) scale(1,1)}}
@keyframes mqv-ombre{0%,100%{transform:scale(1);opacity:1}38%{transform:scale(.55);opacity:.45}62%{transform:scale(1.05)}}
.mqv-abat .mqv-geste{animation:mqv-abat 1.1s ease-out forwards}
@keyframes mqv-abat{0%{transform:translateY(0) scale(1,1)}35%{transform:translateY(2%) scale(1.03,.95)}100%{transform:translateY(1.5%) scale(1.01,.965)}}
.mqv-hurle .mqv-geste{animation:mqv-hurle 1.8s cubic-bezier(.3,.6,.35,1) forwards}
@keyframes mqv-hurle{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-6%) scale(1.06)}100%{transform:translateY(-2%) scale(1.04)}}
.mqv-trotte .mqv-geste{animation:mqv-trot .32s ease-in-out infinite}
.mqv-trotte .mqv-ombre{animation:mqv-ombre-trot .32s ease-in-out infinite}
@keyframes mqv-trot{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-9%) rotate(-2deg)}}
@keyframes mqv-ombre-trot{0%,100%{transform:scale(1)}50%{transform:scale(.8)}}
.mqv-arrive .mqv-geste{animation:mqv-arrive .55s cubic-bezier(.3,1.4,.5,1)}
@keyframes mqv-arrive{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}
.mqv-effets{position:absolute;left:-45%;right:-45%;top:-55%;bottom:0;pointer-events:none}
.mqv-effets svg{width:100%;height:100%;display:block;overflow:visible}
.mqv-coeur{position:absolute;width:11%;aspect-ratio:1;animation:mqv-coeur 1.8s ease-out forwards}
@keyframes mqv-coeur{0%{opacity:0;transform:translate(0,0) scale(.4) rotate(0)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-170%) scale(1.15) rotate(var(--r))}}
.mqv-nuage{position:absolute;width:26%;aspect-ratio:40/30;animation:mqv-nuage 2.8s ease-out forwards}
@keyframes mqv-nuage{0%{opacity:0;transform:translateY(-12%)}18%{opacity:.95;transform:translateY(0)}80%{opacity:.95}100%{opacity:0;transform:translateX(8%)}}
.mqv-goutte{animation:mqv-goutte .9s linear infinite}
@keyframes mqv-goutte{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(9px);opacity:0}}
.mqv-rayons{position:absolute;left:50%;top:52%;width:190%;aspect-ratio:1;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(244,213,141,.30) 0 5deg,transparent 5deg 15deg);-webkit-mask:radial-gradient(closest-side,#000 18%,transparent 70%);mask:radial-gradient(closest-side,#000 18%,transparent 70%);animation:mqv-tourne 10s linear infinite,mqv-fondu .7s ease-out;transform:translate(-50%,-50%)}
@keyframes mqv-tourne{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes mqv-fondu{from{opacity:0}to{opacity:1}}
.mqv-etincelle{position:absolute;width:9%;aspect-ratio:1;animation:mqv-scintille 1.5s ease-in-out infinite}
@keyframes mqv-scintille{0%,100%{opacity:.15;transform:scale(.5) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(30deg)}}
.mqv-halo{position:absolute;left:50%;top:50%;width:160%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,240,200,.95),rgba(244,213,141,.55) 35%,rgba(244,213,141,0) 70%);opacity:0}
.mqv-vivant{position:absolute;left:50%;top:50%;width:175%;aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;animation:mqv-tourne 24s linear infinite,mqv-fondu 1.2s ease-out}
.mqv-doigt{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:2px solid rgba(255,255,255,.9);background:rgba(255,255,255,.25);box-shadow:0 0 0 6px rgba(255,255,255,.12);z-index:200;pointer-events:none;animation:mqv-doigt .7s ease-out forwards}
@keyframes mqv-doigt{0%{transform:scale(.6);opacity:0}25%{opacity:1}100%{transform:scale(1.25);opacity:0}}
.mqv-nom{position:absolute;left:50%;top:100%;margin-top:6px;transform:translateX(-50%);font:600 12px/1.35 Figtree,system-ui,sans-serif;color:#f3ece2;background:rgba(26,20,18,.82);border:1px solid rgba(217,181,106,.55);padding:1px 9px;border-radius:999px;white-space:nowrap}
`
  const COEUR = `<svg viewBox="0 0 24 24"><path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill="#f08bb0"/></svg>`
  const ETINCELLE = `<svg viewBox="0 0 24 24"><path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="#f4d58d"/></svg>`
  const NUAGE = `<svg viewBox="0 0 40 30"><path d="M10 20h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 3 7.5 7.5 0 0 0 10 20Z" fill="#7d8796"/><g stroke="#9cc8f5" stroke-width="1.8" stroke-linecap="round"><path class="mqv-goutte" d="M14 22l-1 3"/><path class="mqv-goutte" style="animation-delay:.3s" d="M21 22l-1 3"/><path class="mqv-goutte" style="animation-delay:.6s" d="M28 22l-1 3"/></g></svg>`

  function styles() {
    if (document.getElementById('mqv-styles')) return
    const s = document.createElement('style')
    s.id = 'mqv-styles'
    s.textContent = CSS
    document.head.appendChild(s)
  }
  const pause = ms => new Promise(r => setTimeout(r, ms))
  const HUMEURS = ['neutre', 'ravi', 'depite', 'triomphe']

  class Compagnon {
    /** o = { base: '/mq-humeurs/loup-adulte', ratio, h, miroir, fixe, z, nom } */
    constructor(o) {
      styles()
      this.o = o
      this.h = o.h
      this.w = Math.round(o.h * o.ratio)
      const el = document.createElement('div')
      el.className = `mqv${o.miroir ? ' mqv-miroir' : ''}${o.fixe ? ' mqv-fixe' : ''}`
      el.style.cssText = `width:${this.w}px;height:${this.h}px;z-index:${o.z ?? 70};left:-9999px;top:-9999px`
      el.innerHTML =
        '<span class="mqv-fond"></span><span class="mqv-ombre"></span><span class="mqv-corps"><span class="mqv-geste">' +
        HUMEURS.map(h => `<img alt="" data-humeur="${h}" src="${o.base}-${h}.webp"${h === 'neutre' ? ' class="on"' : ''}>`).join('') +
        '</span></span><span class="mqv-effets"></span>' +
        (o.nom ? `<span class="mqv-nom">${o.nom}</span>` : '')
      ;(o.dans ? document.querySelector(o.dans) : document.body).appendChild(el)
      this.el = el
      this.humeurActuelle = 'neutre'
    }
    async pret() {
      await Promise.all([...this.el.querySelectorAll('img')].map(i => (i.complete ? null : new Promise(r => (i.onload = i.onerror = r)))))
    }
    /** Ses pattes en (x, y), en pixels de la page (ou de l'écran s'il est fixe). */
    aller(x, y, { instant = false } = {}) {
      if (instant) this.el.style.transition = 'none'
      this.el.style.left = `${Math.round(x - this.w / 2)}px`
      this.el.style.top = `${Math.round(y - this.h)}px`
      if (instant) {
        void this.el.offsetWidth
        this.el.style.transition = ''
      }
    }
    cacher(oui = true) {
      this.el.style.opacity = oui ? '0' : '1'
    }
    /** Il arrive en trottinant, à petits bonds, jusqu'à (x, y). */
    async trotter(x, y, duree = 1600) {
      this.el.style.transition = `left ${duree}ms linear, top ${duree}ms linear, opacity .3s ease`
      this.el.classList.add('mqv-trotte')
      this.aller(x, y)
      await pause(duree)
      this.el.classList.remove('mqv-trotte')
      this.el.style.transition = ''
    }
    humeur(h) {
      this.humeurActuelle = h
      for (const i of this.el.querySelectorAll('.mqv-geste img')) i.classList.toggle('on', i.dataset.humeur === h)
    }
    geste(nom) {
      this.el.classList.remove('mqv-saute', 'mqv-abat', 'mqv-hurle', 'mqv-arrive')
      void this.el.offsetWidth
      if (nom) this.el.classList.add(`mqv-${nom}`)
    }
    /** Où est sa tête, en pour cent de sa boîte : en haut à droite des bêtes peintes, à gauche en miroir. */
    tete() {
      return this.o.miroir ? 30 : 70
    }
    coeurs(n = 4) {
      const fx = this.el.querySelector('.mqv-effets')
      for (let k = 0; k < n; k++) {
        const c = document.createElement('span')
        c.className = 'mqv-coeur'
        // Les effets couvrent une boîte élargie de 45 % de chaque côté : la tête y est recentrée.
        const x = (this.tete() * 1 + 45) / 1.9 - 5 + (k - n / 2) * 6
        c.style.cssText = `left:${x}%;top:${32 + (k % 2) * 6}%;--dx:${(k - n / 2) * 18}%;--r:${(k % 2 ? 1 : -1) * 18}deg;animation-delay:${k * 0.16}s`
        c.innerHTML = COEUR
        fx.appendChild(c)
        setTimeout(() => c.remove(), 2400 + k * 160)
      }
    }
    nuage() {
      const fx = this.el.querySelector('.mqv-effets')
      const n = document.createElement('span')
      n.className = 'mqv-nuage'
      n.style.cssText = `left:${(this.tete() + 45) / 1.9 - 13}%;top:16%`
      n.innerHTML = NUAGE
      fx.appendChild(n)
      setTimeout(() => n.remove(), 3000)
    }
    gloire(oui = true) {
      const fx = this.el.querySelector('.mqv-effets')
      fx.querySelectorAll('.mqv-gloire').forEach(e => e.remove())
      if (!oui) return
      const g = document.createElement('span')
      g.className = 'mqv-gloire'
      g.style.cssText = 'position:absolute;inset:0'
      g.innerHTML =
        '<span class="mqv-rayons"></span>' +
        [
          [18, 40, 0],
          [78, 34, 0.4],
          [50, 18, 0.8],
          [30, 22, 1.1],
          [68, 52, 0.6],
        ]
          .map(([x, y, d]) => `<span class="mqv-etincelle" style="left:${x}%;top:${y}%;animation-delay:${d}s">${ETINCELLE}</span>`)
          .join('')
      fx.insertBefore(g, fx.firstChild)
    }
    /** Un toucher : le rond du doigt, puis il bondit et des cœurs s'envolent — le geste de la boutique. */
    async caresse() {
      const r = this.el.getBoundingClientRect()
      const d = document.createElement('span')
      d.className = 'mqv-doigt'
      d.style.cssText = `position:fixed;left:${r.left + r.width * 0.5}px;top:${r.top + r.height * 0.45}px`
      document.body.appendChild(d)
      setTimeout(() => d.remove(), 800)
      await pause(160)
      this.reagir('ravi', { geste: 'saute', coeurs: 5, puis: 1500 })
    }
    /** Une réaction : son humeur, un geste, un effet, puis — s'il le faut — le retour au calme. */
    reagir(h, { geste, coeurs, nuage, gloire, puis } = {}) {
      clearTimeout(this.retour)
      this.humeur(h)
      this.geste(geste)
      if (coeurs) this.coeurs(coeurs)
      if (nuage) this.nuage()
      this.gloire(!!gloire)
      if (puis) this.retour = setTimeout(() => this.calme(), puis)
    }
    calme() {
      this.gloire(false)
      this.geste(null)
      this.humeur('neutre')
    }
    /** De temps en temps, quand rien ne se passe, il te sourit. */
    vivre(periode = 6500) {
      clearInterval(this.boucle)
      this.boucle = setInterval(() => {
        if (this.humeurActuelle !== 'neutre') return
        this.humeur('ravi')
        setTimeout(() => this.humeurActuelle === 'ravi' && !this.el.classList.contains('mqv-saute') && this.humeur('neutre'), 1300)
      }, periode)
    }
    arreter() {
      clearInterval(this.boucle)
    }
    /** Il grandit : il s'illumine, un éclair, et la forme suivante — plus grande — est là. */
    async grandir(o) {
      const halo = document.createElement('span')
      halo.className = 'mqv-halo'
      this.el.insertBefore(halo, this.el.firstChild)
      const imgs = () => [...this.el.querySelectorAll('.mqv-geste img')]
      // Il s'illumine.
      for (const i of imgs()) i.style.transition = 'opacity .22s ease, filter 1.1s ease'
      for (const i of imgs()) i.style.filter = 'brightness(2.4) saturate(.4) drop-shadow(0 0 18px rgba(255,236,190,.95))'
      halo.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)' }], { duration: 1100, fill: 'forwards', easing: 'ease-in' })
      await pause(1100)
      // L'éclair : la nouvelle forme prend sa place, à sa taille.
      this.o = { ...this.o, ...o }
      this.h = o.h
      this.w = Math.round(o.h * o.ratio)
      const pieds = this.pieds()
      this.el.style.transition = 'none'
      this.el.style.width = `${this.w}px`
      this.el.style.height = `${this.h}px`
      this.el.style.left = `${Math.round(pieds.x - this.w / 2)}px`
      this.el.style.top = `${Math.round(pieds.y - this.h)}px`
      for (const i of imgs()) i.src = `${o.base}-${i.dataset.humeur}.webp`
      await Promise.all(imgs().map(i => (i.complete ? null : new Promise(r => (i.onload = i.onerror = r)))))
      void this.el.offsetWidth
      this.el.style.transition = ''
      if (o.vivant) {
        const v = document.createElement('img')
        v.className = 'mqv-vivant'
        v.alt = ''
        v.src = o.vivant
        this.el.querySelector('.mqv-corps').insertBefore(v, this.el.querySelector('.mqv-geste'))
      }
      halo.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2)' }], { duration: 900, fill: 'forwards', easing: 'ease-out' })
      for (const i of imgs()) i.style.filter = ''
      this.geste('arrive')
      await pause(700)
      halo.remove()
      for (const i of imgs()) i.style.transition = ''
    }
    pieds() {
      return { x: parseFloat(this.el.style.left) + this.w / 2, y: parseFloat(this.el.style.top) + this.h }
    }
    retirer() {
      this.arreter()
      this.el.remove()
    }
  }

  /** Le bond du loup des étoiles : une image qui traverse l'écran en arc, d'un point à un autre. */
  async function bondir(o) {
    styles()
    const im = document.createElement('img')
    im.src = o.src
    im.alt = ''
    const w = Math.round(o.h * o.ratio)
    im.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${o.h}px;z-index:90;pointer-events:none;filter:drop-shadow(0 0 16px rgba(170,200,255,.6))${o.miroir ? ';transform:scaleX(-1)' : ''}`
    document.body.appendChild(im)
    await new Promise(r => (im.complete ? r() : (im.onload = r)))
    const n = 24
    const images = []
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const x = o.de.x + (o.vers.x - o.de.x) * t - w / 2
      const y = o.de.y + (o.vers.y - o.de.y) * t - o.hauteur * 4 * t * (1 - t) - o.h
      const rot = (o.miroir ? -1 : 1) * (-14 + 28 * t)
      images.push({ transform: `translate(${x}px,${y}px) rotate(${rot}deg)${o.miroir ? ' scaleX(-1)' : ''}`, opacity: k === n ? 0 : 1 })
    }
    await im.animate(images, { duration: o.duree ?? 1300, easing: 'cubic-bezier(.35,.1,.35,1)', fill: 'forwards' }).finished
    im.remove()
  }

  /** Le rond du doigt, là où l'on touche : le film montre ce que la joueuse fait. */
  function doigt(x, y) {
    styles()
    const d = document.createElement('span')
    d.className = 'mqv-doigt'
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px`
    document.body.appendChild(d)
    setTimeout(() => d.remove(), 800)
  }

  function rectDe(sel) {
    const [css, texte] = sel.split('@@')
    const els = [...document.querySelectorAll(css)]
    const el = texte ? els.find(e => (e.textContent || '').includes(texte)) : els[0]
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, vx: r.left, vy: r.top }
  }

  window.__mqv = {
    Compagnon,
    bondir,
    doigt,
    rectDe,
    pause,
    actifs: {},
    creer(nom, o) {
      this.actifs[nom]?.retirer()
      this.actifs[nom] = new Compagnon(o)
      return this.actifs[nom].pret()
    },
    lui(nom) {
      return this.actifs[nom]
    },
  }
})()

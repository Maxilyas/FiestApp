// Maquette — des expériences pour que la niche ne devienne pas un décor :
// le réveil (volets), le nourrir (une étincelle par bonne réponse, sa jauge),
// la bulle d'émote, la sortie aux grands moments, le repli au défilement et
// sa fiche. Chargé après niche.js. Rien de ceci n'existe dans le code.
;(() => {
  const q = s => document.querySelector(s)
  const pause = ms => new Promise(r => setTimeout(r, ms))
  const N = () => window.__niche

  const COEUR = '<svg viewBox="0 0 24 24"><path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill="#e8739a"/></svg>'
  const ETINCELLE = '<svg viewBox="0 0 24 24"><path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="#ffe7a3"/></svg>'
  const NUAGE = '<svg viewBox="0 0 40 30"><path d="M10 20h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 3 7.5 7.5 0 0 0 10 20Z" fill="#7d8796"/><g stroke="#5b9bd8" stroke-width="2.4" stroke-linecap="round"><path d="M14 23l-1.2 4.5"/><path d="M21 23l-1.2 4.5"/><path d="M28 23l-1.2 4.5"/></g></svg>'
  const COURONNE = '<svg viewBox="0 0 24 24"><path d="M3 18 4.5 7.5l5 4.5L12 5l2.5 7 5-4.5L21 18Z" fill="#e2b04a" stroke="#a87a22" stroke-width="1.2" stroke-linejoin="round"/><rect x="3" y="18.5" width="18" height="2.6" rx="1" fill="#c9952f"/></svg>'

  const CSS = `
/* Le nourrir : la jauge sur le rebord, l'étincelle qui vole jusqu'à lui. */
.npl-jauge .nc-rebord{height:9px}
.nc-jauge{position:absolute;left:6px;right:6px;top:2.5px;height:4px;border-radius:3px;background:rgba(58,38,18,.6);overflow:hidden}
.nc-jauge-plein{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#fff6d8,#ffd86a);box-shadow:0 0 5px rgba(255,236,190,.95);transition:width .8s cubic-bezier(.3,.7,.3,1)}
.npl-etincelle{position:fixed;left:0;top:0;z-index:58;pointer-events:none;filter:drop-shadow(0 0 6px rgba(255,226,150,.95))}
.npl-etincelle svg{display:block;width:100%;height:100%}
.nc.npl-nourri .nc-rebord{animation:npl-rebord 1s ease-out}
@keyframes npl-rebord{0%{box-shadow:0 0 0 rgba(255,236,190,0)}25%{box-shadow:0 0 16px 5px rgba(255,236,190,.95)}100%{box-shadow:0 -1px 2px rgba(0,0,0,.4)}}
.npl-plus{position:absolute;right:100%;margin-right:6px;top:18px;font:700 14px/1 Figtree,system-ui,sans-serif;color:#ffe08a;text-shadow:0 1px 3px rgba(0,0,0,.7);white-space:nowrap;animation:npl-plus 1.4s ease-out forwards}
@keyframes npl-plus{0%{opacity:0;transform:translateY(8px)}18%{opacity:1;transform:translateY(0)}75%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
/* La bulle d'émote, qui sort de la niche vers la page. */
.npl-bulle{position:fixed;z-index:56;display:flex;align-items:center;justify-content:center;gap:3px;height:42px;min-width:48px;box-sizing:border-box;padding:0 11px;border-radius:15px;background:#f6efe3;border:1.5px solid #d9b56a;box-shadow:0 8px 18px rgba(0,0,0,.5);transform-origin:100% 50%;animation:npl-bulle .4s cubic-bezier(.3,1.6,.5,1) both}
.npl-bulle::after{content:'';position:absolute;right:-7px;top:50%;width:11px;height:11px;margin-top:-6px;background:#f6efe3;border-right:1.5px solid #d9b56a;border-top:1.5px solid #d9b56a;transform:rotate(45deg)}
.npl-bulle span{display:block;width:22px;height:22px}
.npl-bulle span.petit{width:16px;height:16px;margin-top:-10px}
.npl-bulle svg{display:block;width:100%;height:100%}
.npl-bulle.npl-sort{animation:npl-bulle-sort .3s ease-in forwards}
@keyframes npl-bulle{0%{opacity:0;transform:scale(.2) translateX(14px)}100%{opacity:1;transform:scale(1)}}
@keyframes npl-bulle-sort{to{opacity:0;transform:scale(.6) translateX(12px)}}
/* La sortie : la niche vide pendant qu'il est dehors. */
.nc.npl-vide .nc-bete{opacity:0;transition:opacity .15s ease}
.npl-sortie{position:fixed;left:0;top:0;z-index:57;pointer-events:none;transform-origin:0 0}
.npl-sortie img{position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1);filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.npl-sortie .npl-ombre{position:absolute;left:14%;right:14%;bottom:-5%;height:12%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),rgba(0,0,0,0));opacity:0;transition:opacity .3s ease}
.npl-sortie .npl-rayons{position:absolute;left:50%;top:50%;width:210%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(244,213,141,.32) 0deg 5deg,rgba(244,213,141,0) 5deg 15deg);-webkit-mask:radial-gradient(closest-side,#000 18%,transparent 70%);mask:radial-gradient(closest-side,#000 18%,transparent 70%);opacity:0;transition:opacity .4s ease;animation:npl-tourne 10s linear infinite}
.npl-sortie.npl-pose .npl-rayons,.npl-sortie.npl-pose .npl-ombre{opacity:1}
.npl-sortie.npl-pose img{animation:npl-atterrit .5s cubic-bezier(.3,.6,.35,1)}
@keyframes npl-atterrit{0%{transform:scaleX(-1) scale(1.08,.88)}55%{transform:scaleX(-1) scale(.97,1.05)}100%{transform:scaleX(-1) scale(1,1)}}
@keyframes npl-tourne{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
/* Le réveil : ses volets fermés, il dort ; il t'ouvre sa fenêtre. */
.nc-cadre{perspective:140px}
.npl-volet{position:absolute;top:0;bottom:7px;width:50%;z-index:3;box-sizing:border-box;background:linear-gradient(90deg,#3b2a20,#5b4130 55%,#4a3326);border:1px solid rgba(217,181,106,.45);transition:transform .8s cubic-bezier(.3,.7,.2,1)}
.npl-volet::before{content:'';position:absolute;left:18%;right:18%;top:30%;bottom:16%;border:1px solid rgba(217,181,106,.25);border-radius:2px}
.npl-volet::after{content:'';position:absolute;top:52%;width:3px;height:3px;border-radius:50%;background:#e2c27a}
.npl-volet.g{left:0;transform-origin:0 50%}
.npl-volet.g::after{right:3px}
.npl-volet.d{right:0;transform-origin:100% 50%}
.npl-volet.d::after{left:3px}
.nc.npl-ouverte .npl-volet.g{transform:rotateY(-112deg)}
.nc.npl-ouverte .npl-volet.d{transform:rotateY(112deg)}
.npl-zzz{position:absolute;right:100%;top:10px;margin-right:4px;font:600 17px/1 'Cormorant Garamond',Georgia,serif;font-style:italic;color:#e8dccb;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap}
.npl-zzz span{display:inline-block;animation:npl-z 2.4s ease-in-out infinite}
.npl-zzz span:nth-child(2){font-size:13px;animation-delay:.4s;transform:translateY(-8px)}
.npl-zzz span:nth-child(3){font-size:10px;animation-delay:.8s;transform:translateY(-15px)}
@keyframes npl-z{0%,100%{opacity:.25}50%{opacity:1}}
.nc.npl-ouverte .npl-zzz{opacity:0;transition:opacity .3s ease}
/* Le repli au défilement. */
.nc{transition:transform .32s cubic-bezier(.3,.7,.3,1),opacity .3s ease;transform-origin:100% 0}
.nc.npl-replie{transform:scale(.62) translateY(-10px)}
/* Le toucher : le rond du doigt. */
.npl-doigt{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(255,255,255,.9);background:rgba(255,255,255,.25);z-index:90;pointer-events:none;animation:npl-doigt .7s ease-out forwards}
@keyframes npl-doigt{0%{transform:scale(.6);opacity:0}25%{opacity:1}100%{transform:scale(1.25);opacity:0}}
/* Sa fiche. */
.npl-fiche-niche{width:108px;height:124px;flex:none}
.npl-fiche-niche > .nc{position:relative!important;top:auto!important;right:auto!important;transform:scale(2);transform-origin:0 0}
/* Calme par défaut : plus de respiration au coin de l'œil ; seuls les événements le font bouger. */
.nc.npl-calme .nc-bete{animation:none}
/* Il retient son souffle : penché vers la page, la tête un peu plus près, et plus rien ne bouge ; son décor s'assombrit. */
.nc .nc-bete img{transition:opacity .22s ease,transform .45s cubic-bezier(.3,.7,.3,1);transform-origin:50% 28%}
.nc.npl-retient .nc-bete img{transform:scaleX(-1) translate(3px,2px) scale(1.1)}
.nc.npl-retient .nc-bete.droit img{transform:translate(-3px,2px) scale(1.1)}
.nc .nc-decor{transition:filter .45s ease}
.nc.npl-retient .nc-decor{filter:brightness(.58) saturate(.8)}
.nc.npl-retient .nc-cadre{border-color:rgba(244,213,141,.95)}
/* La jauge discrète : elle ne paraît que le temps d'un repas. */
.nc.npl-discrete .nc-jauge{opacity:0;transition:opacity .35s ease}
.nc.npl-discrete.npl-jauge-vue .nc-jauge{opacity:1}
/* Dehors : on peut le toucher ; il sautille, des cœurs montent. */
.npl-sortie img{transform-origin:50% 100%}
.npl-sortie img.npl-hop{animation:npl-hop .8s cubic-bezier(.3,.6,.35,1)!important}
@keyframes npl-hop{0%{transform:scaleX(-1) translateY(0) scale(1,1)}18%{transform:scaleX(-1) translateY(3px) scale(1.05,.94)}45%{transform:scaleX(-1) translateY(-22px) scale(.97,1.05)}70%{transform:scaleX(-1) translateY(0) scale(1.04,.96)}100%{transform:scaleX(-1) translateY(0) scale(1,1)}}
.npl-sortie .npl-fx{position:absolute;inset:0;overflow:visible}
.npl-sortie .npl-fx span{position:absolute;display:block}
.npl-sortie .npl-fx svg{display:block;width:100%;height:100%}
`
  function styles() {
    if (document.getElementById('npl-styles')) return
    const s = document.createElement('style')
    s.id = 'npl-styles'
    s.textContent = CSS
    document.head.appendChild(s)
  }
  const niche = () => q('.nc')

  /** La jauge vers sa forme suivante, sur le rebord de la niche. */
  function jauge(part) {
    styles()
    const nc = niche()
    if (!nc) return
    nc.classList.add('npl-jauge')
    const rebord = nc.querySelector('.nc-rebord')
    if (!rebord.querySelector('.nc-jauge')) rebord.innerHTML = `<span class="nc-jauge"><span class="nc-jauge-plein" style="width:${part}%"></span></span>`
    else rebord.querySelector('.nc-jauge-plein').style.width = `${part}%`
  }

  /** Une bonne réponse le nourrit : des étincelles volent de la carte jusqu'à sa niche. */
  async function nourrir({ de, part, plus = '+1' }) {
    styles()
    const nc = niche()
    const source = q(de)
    if (!nc || !source) return
    const a = source.getBoundingClientRect()
    const b = nc.getBoundingClientRect()
    const depart = { x: a.left + a.width / 2, y: a.top + a.height / 2 }
    const arrivee = { x: b.left + b.width / 2, y: b.bottom - 6 }
    const vols = [0, 1, 2].map(k => {
      const s = document.createElement('span')
      const taille = k === 0 ? 18 : 11
      s.className = 'npl-etincelle'
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
    await pause(860)
    if (part !== undefined) jauge(part)
    nc.classList.remove('npl-nourri')
    void nc.offsetWidth
    nc.classList.add('npl-nourri')
    const p = document.createElement('span')
    p.className = 'npl-plus'
    p.textContent = plus
    nc.appendChild(p)
    setTimeout(() => p.remove(), 1500)
    N().humeur('ravi', { geste: 'saute' })
    await Promise.all(vols)
  }

  /** Une bulle d'émote, à gauche de la niche. */
  function bulle(sorte, duree = 1700) {
    styles()
    const nc = niche()
    if (!nc) return
    const r = nc.getBoundingClientRect()
    const b = document.createElement('div')
    b.className = 'npl-bulle'
    b.style.top = `${r.top + 10}px`
    b.style.right = `${innerWidth - r.left + 9}px`
    b.innerHTML =
      sorte === 'ravi'
        ? `<span>${COEUR}</span><span class="petit">${COEUR}</span>`
        : sorte === 'depite'
          ? `<span style="width:28px;height:22px">${NUAGE}</span>`
          : `<span>${COURONNE}</span>`
    document.body.appendChild(b)
    setTimeout(() => b.classList.add('npl-sort'), duree)
    setTimeout(() => b.remove(), duree + 350)
  }

  /** Les grands moments : il sort de sa niche, en grand, se pose (x, y = ses pattes), puis y retourne. */
  async function sortir({ x, y, h = 124, humeur = 'triomphe', tenue = 1900 }) {
    styles()
    const nc = niche()
    if (!nc) return
    const img = nc.querySelector(`.nc-bete img[data-humeur="${humeur}"]`)
    const ratio = img.naturalWidth / img.naturalHeight
    const w = Math.round(h * ratio)
    const bete = nc.querySelector('.nc-bete').getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'npl-sortie'
    el.style.cssText = `width:${w}px;height:${h}px`
    el.innerHTML = `<span class="npl-rayons"></span><span class="npl-ombre"></span><img alt="" src="${img.src}">`
    document.body.appendChild(el)
    const depart = { x: bete.left + bete.width / 2, y: bete.top + bete.height * 0.62, s: (bete.height * 0.62) / h }
    const images = []
    for (let i = 0; i <= 28; i++) {
      const t = i / 28
      const s = depart.s + (1 - depart.s) * t
      const px = depart.x + (x - depart.x) * t
      const py = depart.y + (y - depart.y) * t - Math.sin(t * Math.PI) * 70
      images.push({ transform: `translate(${px - (w * s) / 2}px,${py - h * s}px) scale(${s})` })
    }
    N().humeur(humeur)
    nc.classList.add('npl-vide')
    await el.animate(images, { duration: 620, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' }).finished
    el.classList.add('npl-pose')
    await pause(tenue)
    el.classList.remove('npl-pose')
    await el.animate(images.slice().reverse(), { duration: 520, easing: 'cubic-bezier(.6,0,.6,1)', fill: 'forwards' }).finished
    el.remove()
    nc.classList.remove('npl-vide')
    N().humeur('neutre')
  }

  /** Le réveil : volets fermés et « z z z » ; `ouvrir()` les ouvre. */
  function volets() {
    styles()
    const nc = niche()
    if (!nc) return
    const cadre = nc.querySelector('.nc-cadre')
    cadre.insertAdjacentHTML('beforeend', '<span class="npl-volet g"></span><span class="npl-volet d"></span>')
    nc.insertAdjacentHTML('beforeend', '<span class="npl-zzz"><span>z</span><span>z</span><span>z</span></span>')
  }
  async function ouvrir() {
    const nc = niche()
    nc.classList.add('npl-ouverte')
    await pause(380)
    N().humeur('ravi', { geste: 'saute' })
    await pause(1500)
    N().humeur('neutre')
  }

  /** Il se fait petit quand la page défile, et revient en haut de page. */
  function suivreLeDefilement() {
    styles()
    const maj = () => niche()?.classList.toggle('npl-replie', scrollY > 40)
    addEventListener('scroll', maj, { passive: true })
    maj()
  }

  function doigt(x, y) {
    styles()
    const d = document.createElement('span')
    d.className = 'npl-doigt'
    d.style.left = `${x}px`
    d.style.top = `${y}px`
    document.body.appendChild(d)
    setTimeout(() => d.remove(), 800)
  }

  /** Sa fiche, au toucher de la niche : la feuille de l'appli, lui en grand, sa jauge, « Le caresser ». */
  function fiche(o) {
    styles()
    const nc = niche()
    const voile = document.createElement('div')
    voile.className = 'carte-voile nc-bloc npl-voile'
    voile.innerHTML = `<div class="carte-feuille" role="dialog" aria-label="${o.nom}">
  <div class="carte-barre"><span class="feuille-titre">${o.nom}</span><button type="button" class="carte-fermer">Fermer</button></div>
  <div class="carte-corps" style="gap:16px;padding-bottom:28px">
    <div style="display:flex;gap:18px;align-items:center">
      <span class="npl-fiche-niche"></span>
      <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
        <span class="label">Ton compagnon</span>
        <b style="font-family:var(--serif);font-weight:600;font-size:1.6rem;line-height:1.1">${o.nom} · ${o.forme}</b>
        <span class="muted small">${o.depuis}</span>
      </div>
    </div>
    <div class="gains-niveau">
      <div class="xp-bar" role="progressbar" aria-label="${o.jauge}"><div class="xp-fill" style="width:${o.part}%"></div></div>
      <p class="muted small" style="margin:6px 0 0">${o.jauge}</p>
    </div>
    <p class="muted small" style="margin:0">${o.ensemble}</p>
    <div style="display:flex;gap:10px">
      <button type="button" class="btn btn-primary npl-caresser" style="flex:1;justify-content:center;min-height:48px">Le caresser</button>
      <button type="button" class="btn" style="min-height:48px">Sa loge</button>
    </div>
  </div>
</div>`
    document.body.appendChild(voile)
    const copie = nc.cloneNode(true)
    copie.classList.remove('npl-replie')
    copie.querySelectorAll('.nc-fx > *').forEach(e => e.remove())
    voile.querySelector('.npl-fiche-niche').appendChild(copie)
    return voile
  }
  /** Une caresse dans la fiche : il sautille, des cœurs s'envolent. */
  function caresserDansLaFiche() {
    const copie = q('.npl-fiche-niche .nc')
    if (!copie) return
    copie.classList.remove('neutre', 'ravi', 'nc-saute')
    void copie.offsetWidth
    copie.classList.add('ravi', 'nc-saute')
    for (const i of copie.querySelectorAll('.nc-bete img')) i.classList.toggle('on', i.dataset.humeur === 'ravi')
    const fx = copie.querySelector('.nc-fx')
    ;[
      [-4, 10, -46, 26, -16],
      [2, 22, -62, 6, 14],
      [-8, 30, -40, 44, -8],
      [6, 4, -70, 30, 18],
    ].forEach(([x, y, dx, dy, r], k) => {
      const s = document.createElement('span')
      s.className = 'nc-coeur-vol'
      s.style.cssText = `left:${x}px;top:${y}px;width:${12 + (k % 2) * 3}px;height:${12 + (k % 2) * 3}px;--dx:${dx}px;--dy:${dy}px;--r:${r}deg;animation-delay:${k * 0.14}s`
      s.innerHTML = COEUR
      fx.appendChild(s)
      setTimeout(() => s.remove(), 2200 + k * 140)
    })
  }
  function fermerFiche() {
    document.querySelectorAll('.npl-voile').forEach(e => e.remove())
  }

  /** Calme par défaut : il ne bouge plus que pour un événement. */
  function calme() {
    styles()
    niche()?.classList.add('npl-calme')
  }

  /** Une réponse touchée : il retient son souffle — le téléphone ne sait pas encore si elle est juste. */
  function retenir() {
    styles()
    niche()?.classList.add('npl-retient')
  }
  function relacher() {
    niche()?.classList.remove('npl-retient')
  }

  /** La jauge posée sur le rebord, mais cachée : elle ne paraît que quand on le nourrit. */
  function jaugeDiscrete(part) {
    jauge(part)
    niche()?.classList.add('npl-discrete')
  }
  /** Nourri à la révélation, la jauge visible le temps du repas. */
  async function nourrirDiscret(o) {
    const nc = niche()
    if (!nc) return
    clearTimeout(nourrirDiscret.minuteur)
    nc.classList.add('npl-jauge-vue')
    await nourrir(o)
    nourrirDiscret.minuteur = setTimeout(() => nc.classList.remove('npl-jauge-vue'), o.vue ?? 1600)
  }

  /** Le grand moment : il sort, se pose (x, y = ses pattes) et reste dehors, où l'on peut le toucher ; `rentrer()` le ramène. */
  let dehorsEtat = null
  async function dehors({ x, y, h = 132, humeur = 'triomphe' }) {
    styles()
    const nc = niche()
    if (!nc) return
    const img = nc.querySelector(`.nc-bete img[data-humeur="${humeur}"]`)
    const w = Math.round(h * (img.naturalWidth / img.naturalHeight))
    const bete = nc.querySelector('.nc-bete').getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'npl-sortie'
    el.style.cssText = `width:${w}px;height:${h}px`
    el.innerHTML = `<span class="npl-rayons"></span><span class="npl-ombre"></span><img alt="" src="${img.src}"><span class="npl-fx"></span>`
    document.body.appendChild(el)
    const depart = { x: bete.left + bete.width / 2, y: bete.top + bete.height * 0.62, s: (bete.height * 0.62) / h }
    const images = []
    for (let i = 0; i <= 28; i++) {
      const t = i / 28
      const s = depart.s + (1 - depart.s) * t
      const px = depart.x + (x - depart.x) * t
      const py = depart.y + (y - depart.y) * t - Math.sin(t * Math.PI) * 70
      images.push({ transform: `translate(${px - (w * s) / 2}px,${py - h * s}px) scale(${s})` })
    }
    // La niche vide reste calme : la fête est dehors, avec lui.
    N().humeur('neutre')
    nc.classList.add('npl-vide')
    await el.animate(images, { duration: 620, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' }).finished
    el.classList.add('npl-pose')
    dehorsEtat = { el, images, nc, w, h }
    return { x, y, w, h }
  }
  function caresserDehors() {
    if (!dehorsEtat) return
    const { el, nc, w, h } = dehorsEtat
    const img = el.querySelector('img')
    img.src = nc.querySelector('.nc-bete img[data-humeur="ravi"]').src
    img.classList.remove('npl-hop')
    void img.offsetWidth
    img.classList.add('npl-hop')
    const fx = el.querySelector('.npl-fx')
    ;[
      [0.22, 0.12, -70, -60, -16, 22],
      [0.32, 0.18, 40, -90, 14, 26],
      [0.16, 0.26, -40, -110, -8, 18],
      [0.4, 0.1, 80, -50, 18, 20],
      [0.26, 0.2, -10, -130, 6, 16],
    ].forEach(([fx0, fy0, dx, dy, r, taille], k) => {
      const s = document.createElement('span')
      s.className = 'nc-coeur-vol'
      s.style.cssText = `left:${w * fx0}px;top:${h * fy0}px;width:${taille}px;height:${taille}px;--dx:${dx}px;--dy:${dy}px;--r:${r}deg;animation-delay:${k * 0.12}s`
      s.innerHTML = COEUR
      fx.appendChild(s)
      setTimeout(() => s.remove(), 2300 + k * 120)
    })
  }
  async function rentrer() {
    if (!dehorsEtat) return
    const { el, images, nc } = dehorsEtat
    dehorsEtat = null
    el.classList.remove('npl-pose')
    await el.animate(images.slice().reverse(), { duration: 560, easing: 'cubic-bezier(.6,0,.6,1)', fill: 'forwards' }).finished
    el.remove()
    nc.classList.remove('npl-vide')
    N().humeur('ravi')
  }

  window.__nicheplus = {
    jauge, nourrir, bulle, sortir, volets, ouvrir, suivreLeDefilement, doigt, fiche, caresserDansLaFiche, fermerFiche,
    calme, retenir, relacher, jaugeDiscrete, nourrirDiscret, dehors, caresserDehors, rentrer,
  }
})()

// Maquette — la niche du compagnon : une petite fenêtre en arche, toujours
// au même endroit (en haut à droite), sur toutes les pages. Il y est en
// buste, dans son décor, et ses humeurs s'y lisent ; la page lui laisse son
// coin. Chargé avant la page (`addInitScript`). Rien de ceci n'existe dans le code.
;(() => {
  const L = 54
  const H = 62
  const HAUT = 20
  const DROITE = 16
  const RESERVE = L + DROITE + 2

  // Le cadrage en buste de chaque forme, peinte de face, la tête en haut à
  // droite (on la retourne : il regarde la page) — hauteur de l'image dans la
  // niche, et où la poser.
  const CADRAGE = {
    'loup-louveteau': { h: 70, x: -6, y: 6 },
    'loup-jeune': { h: 92, x: -4, y: 4 },
    'loup-adulte': { h: 96, x: -2, y: 4 },
    'loup-ultime': { h: 96, x: -6, y: 3 },
    'chat-chaton': { h: 74, x: -6, y: 6 },
    'chat-jeune': { h: 96, x: -2, y: 3 },
    'chat-adulte': { h: 92, x: -10, y: 2 },
    'chat-esprit': { h: 88, x: -14, y: 6 },
    // La tortue regarde déjà la page (sa tête est à gauche) : on ne la retourne
    // pas, et on la montre entière — sa tête est en bas, son île au-dessus.
    'tortue-bebe': { h: 52, x: 2, y: 5, droit: true },
    'tortue-jeune': { h: 50, x: -1, y: 7, droit: true },
    'tortue-adulte': { h: 66, x: -2, y: -3, droit: true },
    'tortue-ile': { h: 66, x: -4, y: -4, droit: true },
  }
  const RATIOS = {
    'loup-louveteau': 1.1016, 'loup-jeune': 0.8799, 'loup-adulte': 0.8312, 'loup-ultime': 0.8911,
    'chat-chaton': 0.9076, 'chat-jeune': 0.7354, 'chat-adulte': 0.9624, 'chat-esprit': 1.0,
    'tortue-bebe': 0.9622, 'tortue-jeune': 1.1448, 'tortue-adulte': 0.9149, 'tortue-ile': 0.9711,
  }
  // Son décor, par compagnon : la nuit et la lune du loup, le soir des
  // lanternes du chat, le lagon de la tortue.
  const ETOILES = '#fff 0 .6px,rgba(255,255,255,0) 1.2px'
  const DECORS = {
    loup: `radial-gradient(circle at 76% 22%,#fff4d6 0 3.4px,rgba(255,244,214,.35) 4.6px,rgba(255,244,214,0) 12px),
      radial-gradient(circle at 18% 16%,${ETOILES}),radial-gradient(circle at 40% 9%,${ETOILES}),radial-gradient(circle at 58% 30%,${ETOILES}),radial-gradient(circle at 12% 40%,${ETOILES}),radial-gradient(circle at 88% 46%,${ETOILES}),
      radial-gradient(140% 55% at 50% 118%,#241d2c 0 46%,rgba(36,29,44,0) 47%),
      linear-gradient(#18234a 0%,#272448 52%,#3a2b3c 100%)`,
    chat: `radial-gradient(circle at 20% 24%,rgba(255,176,92,.85) 0 2.6px,rgba(255,176,92,.28) 4px,rgba(255,176,92,0) 10px),
      radial-gradient(circle at 80% 16%,rgba(255,196,110,.9) 0 2.2px,rgba(255,196,110,.25) 3.6px,rgba(255,196,110,0) 9px),
      radial-gradient(circle at 62% 36%,rgba(255,150,90,.6) 0 1.8px,rgba(255,150,90,0) 6px),
      radial-gradient(140% 55% at 50% 118%,#2a1a20 0 46%,rgba(42,26,32,0) 47%),
      linear-gradient(#2c1838 0%,#4a2234 55%,#5a2c28 100%)`,
    tortue: `radial-gradient(circle at 72% 20%,rgba(255,240,200,.85) 0 3px,rgba(255,240,200,.25) 4.4px,rgba(255,240,200,0) 11px),
      radial-gradient(120% 40% at 50% 104%,rgba(120,220,210,.35),rgba(120,220,210,0) 70%),
      linear-gradient(#173a52 0%,#1d5560 58%,#1f6a63 100%)`,
  }
  const VIVANTS = {
    'loup-ultime': ['/compagnons/rubans.webp'],
  }

  const CSS = `
.nc{position:fixed;top:${HAUT}px;right:${DROITE}px;width:${L}px;height:${H}px;z-index:50;pointer-events:none}
.nc-cadre{position:absolute;inset:0;border-radius:${L / 2}px ${L / 2}px 12px 12px;overflow:hidden;border:1px solid rgba(217,181,106,.62);
  box-shadow:0 8px 18px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.25);transition:box-shadow .5s ease,border-color .5s ease}
.nc-decor{position:absolute;inset:0;transition:filter .6s ease}
.nc-rayons{position:absolute;left:50%;top:52%;width:180%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(244,213,141,.42) 0deg 6deg,rgba(244,213,141,0) 6deg 18deg);
  -webkit-mask:radial-gradient(closest-side,#000 10%,transparent 72%);mask:radial-gradient(closest-side,#000 10%,transparent 72%);opacity:0;transition:opacity .5s ease}
.nc-bete{position:absolute;transform-origin:50% 100%}
.nc-bete img{position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1);opacity:0;transition:opacity .22s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.nc-bete img.on{opacity:1}
.nc-bete.droit img{transform:none}
.nc-rebord{position:absolute;left:0;right:0;bottom:0;height:7px;background:linear-gradient(rgba(240,214,150,.95),rgba(150,112,58,.95));box-shadow:0 -1px 2px rgba(0,0,0,.4)}
.nc-pluie{position:absolute;left:50%;top:3px;width:26px;transform:translateX(-50%);opacity:0;transition:opacity .4s ease}
.nc-pluie svg{display:block;width:100%;overflow:visible}
.nc-fx{position:absolute;inset:0;overflow:visible}
.nc-fx span{position:absolute;display:block}
.nc-fx svg{display:block;width:100%;height:100%;overflow:visible}
/* Ses humeurs. */
.nc.ravi .nc-cadre{border-color:rgba(244,213,141,.95);box-shadow:0 0 0 1px rgba(244,213,141,.35),0 0 16px rgba(244,213,141,.55),0 8px 18px rgba(0,0,0,.45)}
.nc.triomphe .nc-cadre{border-color:rgba(255,226,150,1);box-shadow:0 0 0 1px rgba(255,226,150,.5),0 0 22px rgba(244,213,141,.75),0 8px 18px rgba(0,0,0,.45)}
.nc.triomphe .nc-rayons{opacity:1}
.nc.depite .nc-decor{filter:brightness(.62) saturate(.55)}
.nc.depite .nc-pluie{opacity:1}
.nc-plaque{position:absolute;left:50%;top:100%;margin-top:5px;transform:translateX(-50%);font:600 11px/1.3 Figtree,system-ui,sans-serif;letter-spacing:.04em;color:#e8cb8a;white-space:nowrap}
/* Vivante : il respire, la pluie tombe, les cœurs montent. */
.nc.vit .nc-bete{animation:nc-respire 3.6s ease-in-out infinite}
@keyframes nc-respire{0%,100%{transform:scale(1,1)}50%{transform:scale(1.015,1.035)}}
.nc.vit .nc-goutte{animation:nc-goutte .9s linear infinite}
@keyframes nc-goutte{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(8px);opacity:0}}
.nc.vit .nc-rayons{animation:nc-tourne 9s linear infinite}
@keyframes nc-tourne{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
.nc-saute .nc-bete{animation:nc-saute .8s cubic-bezier(.3,.6,.35,1)!important}
@keyframes nc-saute{0%{transform:translateY(0) scale(1,1)}18%{transform:translateY(2px) scale(1.05,.94)}45%{transform:translateY(-9px) scale(.97,1.05)}70%{transform:translateY(0) scale(1.04,.96)}100%{transform:translateY(0) scale(1,1)}}
.nc-abat .nc-bete{animation:nc-abat .9s ease-out forwards!important}
@keyframes nc-abat{0%{transform:translateY(0)}40%{transform:translateY(3px) scale(1.02,.96)}100%{transform:translateY(2px) scale(1.01,.97)}}
.nc-coeur-vol{animation:nc-coeur 1.6s ease-out forwards}
@keyframes nc-coeur{0%{opacity:0;transform:translate(0,0) scale(.4)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.1) rotate(var(--r))}}
`
  const COEUR = '<svg viewBox="0 0 24 24"><path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill="#f08bb0"/></svg>'
  const ETINCELLE = '<svg viewBox="0 0 24 24"><path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="#f4d58d"/></svg>'
  const PLUIE = '<svg viewBox="0 0 40 30"><path d="M10 20h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 3 7.5 7.5 0 0 0 10 20Z" fill="#8a93a3"/><g stroke="#9cc8f5" stroke-width="2" stroke-linecap="round"><path class="nc-goutte" d="M14 22l-1 4"/><path class="nc-goutte" style="animation-delay:.3s" d="M21 22l-1 4"/><path class="nc-goutte" style="animation-delay:.6s" d="M28 22l-1 4"/></g></svg>'

  function styles() {
    if (document.getElementById('nc-styles')) return
    const s = document.createElement('style')
    s.id = 'nc-styles'
    s.textContent = CSS
    document.head.appendChild(s)
  }

  const touches = []
  function style(el, css) {
    if (!el) return
    touches.push([el, el.getAttribute('style')])
    el.style.cssText += ';' + css
  }
  const q = s => document.querySelector(s)

  /** Chaque page laisse son coin à la niche : sa première ligne s'arrête avant elle. */
  function reserver(ecran) {
    const garde = `padding-right:${RESERVE}px;box-sizing:border-box`
    const ligne = `min-height:${H + HAUT - 22}px;${garde}`
    switch (ecran) {
      case 'accueil':
        style(q('.accueil-tete'), garde)
        break
      case 'profil':
        style(q('.player-shell > .identite-ligne'), garde)
        break
      case 'boutique':
        style(q('.boutique-tete'), garde)
        break
      case 'jour':
        style(q('.jour-barre'), garde)
        break
      case 'jour-question':
      case 'jour-revelation': {
        // Sur deux lignes, le jour puis les points : sur une seule, « 200 pts »
        // se cassait contre la niche.
        const b = q('.jour-bandeau')
        style(b, ligne + ';flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:4px;padding-top:4px')
        style(b && b.querySelector('.num'), 'white-space:nowrap')
        break
      }
      case 'jour-fin':
        break
      case 'soiree-attente':
        style(q('.me-header'), garde)
        break
      case 'soiree-question':
        style(q('.quiz-topbar'), ligne + ';align-items:flex-start;padding-top:6px')
        break
      case 'soiree-revelation': {
        const b = document.createElement('div')
        b.className = 'quiz-topbar nc-bloc'
        b.style.cssText = ligne + ';align-items:flex-start;padding-top:6px'
        b.innerHTML = '<span class="label">Question 3 / 5</span>'
        q('.player-shell').prepend(b)
        break
      }
      case 'soiree-podium': {
        // La pastille va à la ligne plutôt que de couper « Quiz terminé ».
        const p = q('.fin-quiz-ligne')
        style(p, `margin-right:${RESERVE}px;flex-wrap:wrap;row-gap:2px;border-radius:20px`)
        // « Quiz terminé » garde sa largeur : la place passe dessous, au lieu de l'écraser.
        style(p && p.querySelector('.fin-quiz-quoi'), 'flex:1 0 auto;overflow:visible;text-overflow:clip')
        break
      }
    }
  }

  /** La niche : o = { cle: 'loup-adulte', humeur, vit, plaque, ecran, humeurs: chemin des images } */
  function poser(o) {
    styles()
    if (!o.garder) retirer()
    const cle = o.cle || 'loup-adulte'
    const compagnon = cle.split('-')[0]
    const c = CADRAGE[cle]
    const w = Math.round(c.h * RATIOS[cle])
    const base = o.base || '/mq-humeurs/'
    const el = document.createElement('div')
    el.className = `nc ${o.humeur || 'neutre'}${o.vit ? ' vit' : ''}`
    el.setAttribute('aria-hidden', 'true')
    const imgs = ['neutre', 'ravi', 'depite', 'triomphe']
      .map(h => `<img alt="" data-humeur="${h}" src="${base}${cle}-${h}.webp"${h === (o.humeur || 'neutre') ? ' class="on"' : ''}>`)
      .join('')
    el.innerHTML = `<div class="nc-cadre">
  <span class="nc-decor" style="background:${DECORS[compagnon]}"></span>
  <span class="nc-rayons"></span>
  <span class="nc-bete${c.droit ? ' droit' : ''}" style="left:${c.x}px;top:${c.y}px;width:${w}px;height:${c.h}px">${imgs}</span>
  <span class="nc-pluie">${PLUIE}</span>
  <span class="nc-rebord"></span>
</div>
<span class="nc-fx"></span>${o.plaque ? `<span class="nc-plaque">${o.plaque}</span>` : ''}`
    if (o.dans) {
      // Pour la fiche du composant : posée dans la page, pas en haut à droite.
      el.style.cssText = 'position:relative;top:auto;right:auto;display:inline-block;vertical-align:top'
      o.dans.appendChild(el)
    } else document.body.appendChild(el)
    if (o.ecran) reserver(o.ecran)
    decorer(el, o.humeur || 'neutre', !!o.vit)
    return el
  }

  /** Ce qui sort de la niche : les cœurs (ravi), les étincelles (triomphe) — posés pour la photo. */
  function decorer(el, humeur, vit) {
    const fx = el.querySelector('.nc-fx')
    fx.innerHTML = ''
    if (vit) return
    if (humeur === 'ravi')
      fx.innerHTML =
        `<span style="left:-16px;top:6px;width:14px;height:14px;transform:rotate(-14deg)">${COEUR}</span>` +
        `<span style="left:-26px;top:24px;width:10px;height:10px;transform:rotate(10deg);opacity:.85">${COEUR}</span>` +
        `<span style="left:-10px;top:-6px;width:9px;height:9px;opacity:.75">${COEUR}</span>`
    if (humeur === 'triomphe')
      fx.innerHTML =
        `<span style="left:-14px;top:4px;width:13px;height:13px">${ETINCELLE}</span>` +
        `<span style="left:-22px;top:30px;width:9px;height:9px;opacity:.8">${ETINCELLE}</span>` +
        `<span style="left:-6px;top:-8px;width:8px;height:8px;opacity:.8">${ETINCELLE}</span>`
  }

  /** En mouvement (le film) : il change d'humeur, sautille, et les cœurs s'envolent vers la page. */
  function humeur(h, { geste } = {}) {
    const el = document.querySelector('.nc')
    if (!el) return
    el.classList.remove('neutre', 'ravi', 'depite', 'triomphe', 'nc-saute', 'nc-abat')
    void el.offsetWidth
    el.classList.add(h)
    for (const i of el.querySelectorAll('.nc-bete img')) i.classList.toggle('on', i.dataset.humeur === h)
    if (geste) el.classList.add(`nc-${geste}`)
    if (h === 'ravi') coeurs(el)
    if (h === 'triomphe') decorer(el, 'triomphe', false)
    else if (el.classList.contains('vit')) el.querySelector('.nc-fx').innerHTML = ''
  }
  function coeurs(el) {
    const fx = el.querySelector('.nc-fx')
    const vols = [
      [-4, 10, -46, 26, -16],
      [2, 22, -62, 6, 14],
      [-8, 30, -40, 44, -8],
      [6, 4, -70, 30, 18],
    ]
    vols.forEach(([x, y, dx, dy, r], k) => {
      const s = document.createElement('span')
      s.className = 'nc-coeur-vol'
      s.style.cssText = `left:${x}px;top:${y}px;width:${12 + (k % 2) * 3}px;height:${12 + (k % 2) * 3}px;--dx:${dx}px;--dy:${dy}px;--r:${r}deg;animation-delay:${k * 0.14}s`
      s.innerHTML = COEUR
      fx.appendChild(s)
      setTimeout(() => s.remove(), 2200 + k * 140)
    })
  }

  /** D'un écran à l'autre de la même page, la niche reste : seule sa place se refait. */
  function reposer(ecran) {
    for (const [el, avant] of touches.splice(0).reverse()) {
      if (avant === null) el.removeAttribute('style')
      else el.setAttribute('style', avant)
    }
    document.querySelectorAll('.nc-bloc').forEach(e => e.remove())
    reserver(ecran)
  }

  function retirer() {
    document.querySelectorAll('.nc,.nc-bloc').forEach(e => e.remove())
    for (const [el, avant] of touches.splice(0).reverse()) {
      if (avant === null) el.removeAttribute('style')
      else el.setAttribute('style', avant)
    }
  }

  window.__niche = { poser, retirer, reposer, humeur, reserver, CADRAGE, RATIOS, DECORS, VIVANTS, L, H }
})()

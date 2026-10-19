// Maquette — quatre places réservées au compagnon, creusées dans la mise en
// page des vrais écrans (pas posées par-dessus) : la page leur fait de la
// place, et sans compagnon la place n'existe pas. Chargé après page.js.
;(() => {
  const CLE = 'loup-adulte'
  const src = humeur => `/mq-humeurs/${CLE}-${humeur}.webp`
  const touches = []

  /** Une retouche de style sur un élément de la page, défaite au nettoyage. */
  function style(el, css) {
    touches.push([el, el.getAttribute('style')])
    el.style.cssText += ';' + css
  }
  function bloc(html) {
    const t = document.createElement('template')
    t.innerHTML = html.trim()
    const el = t.content.firstElementChild
    el.classList.add('mq-bloc')
    return el
  }
  function nettoyer() {
    window.__mq.nettoyer()
    for (const [el, avant] of touches.splice(0).reverse()) {
      if (avant === null) el.removeAttribute('style')
      else el.setAttribute('style', avant)
    }
  }
  const q = s => {
    const el = document.querySelector(s)
    if (!el) throw new Error('introuvable : ' + s)
    return el
  }

  /** Le compagnon dans une place : centré, les pattes au bas de la place (moins `pieds`). */
  async function dans(place, h, humeur, o = {}) {
    const { ratio } = await window.__mq.rogner(src(humeur))
    const w = Math.round(h * ratio)
    const r = place.getBoundingClientRect()
    const cx = r.left + r.width * (o.cx ?? 0.5) + (o.dx ?? 0)
    const bas = r.top + r.height - (o.pieds ?? 0)
    return window.__mq.poser({
      ancre: { x: cx - w / 2 + scrollX, y: bas - h + scrollY, w: 0, h, vx: cx - w / 2, vy: bas - h },
      place: 'libre',
      src: src(humeur),
      h,
      humeur,
      miroir: o.miroir ?? true,
      fixe: !!o.fixe,
      z: o.z ?? 60,
    })
  }

  // Ce qui se répète : le sol, la scène, la case.
  const SOL = h =>
    `<div style="position:relative;flex:none;height:${h}px;pointer-events:none">
  <span style="position:absolute;left:0;right:0;bottom:14px;height:1px;background:linear-gradient(90deg,rgba(217,181,106,0),rgba(217,181,106,.45) 22%,rgba(217,181,106,.45) 78%,rgba(217,181,106,0))"></span>
  <span style="position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(to bottom,rgba(217,181,106,.07),rgba(217,181,106,0))"></span>
  <span class="pl-lumiere" style="position:absolute;left:calc(68% - 75px);bottom:4px;width:150px;height:26px;border-radius:50%;background:radial-gradient(closest-side,rgba(217,181,106,.22),rgba(217,181,106,0))"></span>
</div>`
  const SCENE = h =>
    `<div style="position:relative;flex:none;height:${h}px;margin:0 -20px;pointer-events:none;overflow:hidden">
  <span style="position:absolute;left:50%;top:-40%;width:320px;height:140%;transform:translateX(-50%);background:radial-gradient(50% 60% at 50% 30%,rgba(255,236,200,.10),rgba(255,236,200,0))"></span>
  <span style="position:absolute;left:50%;bottom:6px;width:230px;height:38px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(217,181,106,.24),rgba(217,181,106,0))"></span>
  <span style="position:absolute;left:12%;right:12%;bottom:24px;height:1px;background:linear-gradient(90deg,rgba(217,181,106,0),rgba(217,181,106,.35),rgba(217,181,106,0))"></span>
</div>`

  /** La ligne de tête des écrans de jeu, avec sa place au bout (le perchoir). */
  function perchoirAuBandeau(bandeau, l) {
    const place = bloc(`<span style="display:block;flex:none;width:${l}px;height:62px"></span>`)
    bandeau.appendChild(place)
    style(bandeau, 'gap:10px')
    // Les points restent collés à lui, au bout de la ligne : sinon l'espace se partage en trois.
    const points = bandeau.querySelector('.num')
    if (points) style(points, 'margin-left:auto;white-space:nowrap')
    return place
  }
  /** La soirée n'a pas de ligne de tête pendant le quiz : on lui donne celle du quiz du jour. */
  function bandeauDeSoiree() {
    const b = bloc(`<p class="jour-bandeau"><span class="label">Soirée · question 3 / 5</span><span class="muted small num" style="margin-left:auto;white-space:nowrap">400 pts</span></p>`)
    q('.player-shell').prepend(b)
    return b
  }
  const shell = () => q('.player-shell')

  const CONCEPTS = {
    // 1 · Le perchoir : au bout de la ligne de tête, toujours la même place, en haut à droite.
    perchoir: {
      async accueil() {
        const tete = q('.accueil-tete')
        const place = bloc('<span style="display:block;flex:none;align-self:stretch;width:50px"></span>')
        tete.querySelector('.bouton-des-amis').before(place)
        await dans(place, 58, 'neutre', { pieds: -2 })
      },
      async question() {
        await dans(perchoirAuBandeau(q('.jour-bandeau'), 50), 58, 'neutre')
      },
      async revelation() {
        await dans(perchoirAuBandeau(q('.jour-bandeau'), 50), 58, 'ravi')
      },
      async soiree() {
        await dans(perchoirAuBandeau(bandeauDeSoiree(), 50), 58, 'depite')
      },
    },
    // 2 · Le sol : une bande à lui au pied de l'écran, au-dessus du menu ou du bouton.
    sol: {
      async accueil() {
        const sol = bloc(SOL(92).replace('position:relative;flex:none', 'position:fixed;left:0;right:0;bottom:calc(72px + env(safe-area-inset-bottom));z-index:39;background:linear-gradient(to bottom,rgba(26,20,18,.55),var(--bg,#1a1412) 22%);box-shadow:0 -14px 18px -6px var(--bg,#1a1412)'))
        document.body.appendChild(sol)
        style(document.body, 'padding-bottom:calc(164px + env(safe-area-inset-bottom))')
        await dans(sol, 74, 'neutre', { cx: 0.68, pieds: 12, fixe: true, z: 41 })
      },
      async question() {
        const sol = bloc(SOL(92))
        shell().appendChild(sol)
        style(shell(), 'padding-bottom:20px')
        await dans(sol, 74, 'neutre', { cx: 0.68, pieds: 12 })
      },
      async revelation() {
        const sol = bloc(SOL(92))
        q('.player-shell > .btn-primary.btn-big').before(sol)
        await dans(sol, 74, 'ravi', { cx: 0.68, pieds: 12 })
      },
      async soiree() {
        const sol = bloc(SOL(92).replace('position:relative;flex:none', 'position:fixed;left:0;right:0;bottom:0;z-index:39;background:linear-gradient(to bottom,rgba(26,20,18,.55),var(--bg,#1a1412) 22%);box-shadow:0 -14px 18px -6px var(--bg,#1a1412)'))
        document.body.appendChild(sol)
        style(shell(), 'padding-bottom:112px')
        await dans(sol, 74, 'depite', { cx: 0.68, pieds: 12, fixe: true, z: 41 })
      },
    },
    // 3 · La loge : sa case dans les cartes qui parlent de toi — jamais pendant la question.
    loge: {
      async accueil() {
        const carte = bloc(`<section class="card" style="display:flex;align-items:stretch;gap:0;padding:0;overflow:hidden">
  <span class="pl-case" style="display:block;flex:none;width:104px;min-height:96px;background:rgba(217,181,106,.06);border-right:1px solid var(--edge,rgba(217,181,106,.22))"></span>
  <span style="display:flex;flex-direction:column;justify-content:center;gap:4px;padding:12px 16px;min-width:0;flex:1">
    <span class="label">Ton compagnon</span>
    <b style="font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.35rem;line-height:1.1">Nox · loup adulte</b>
    <span class="xp-bar" style="margin-top:4px"><span class="xp-fill" style="width:56%"></span></span>
    <span class="muted small">412 / 500 vers le loup des étoiles</span>
  </span>
</section>`)
        q('.accueil-tete').after(carte)
        await dans(carte.querySelector('.pl-case'), 80, 'neutre', { pieds: 8, miroir: false })
      },
      async question() {},
      async revelation() {
        const carte = q('.result-banner')
        style(carte, 'position:relative;padding-left:136px;min-height:168px;justify-content:center')
        const loge = bloc('<span style="position:absolute;left:0;top:0;bottom:0;width:120px;background:rgba(217,181,106,.06);border-right:1px solid var(--edge,rgba(217,181,106,.22));border-radius:inherit;border-top-right-radius:0;border-bottom-right-radius:0;pointer-events:none"></span>')
        carte.prepend(loge)
        await dans(loge, 92, 'ravi', { pieds: 14, miroir: false })
      },
      async soiree() {
        const carte = q('.result-banner')
        style(carte, 'position:relative;padding-left:136px;min-height:168px;justify-content:center')
        const loge = bloc('<span style="position:absolute;left:0;top:0;bottom:0;width:120px;background:rgba(217,181,106,.06);border-right:1px solid var(--edge,rgba(217,181,106,.22));border-radius:inherit;border-top-right-radius:0;border-bottom-right-radius:0;pointer-events:none"></span>')
        carte.prepend(loge)
        await dans(loge, 86, 'depite', { pieds: 12, miroir: false })
      },
    },
    // 4 · La scène : en grand, au-dessus de ce qu'on joue.
    scene: {
      async accueil() {
        const scene = bloc(SCENE(176))
        q('.accueil-tete').after(scene)
        const pied = bloc('<span style="position:absolute;left:0;right:0;bottom:2px;display:flex;justify-content:center"><span style="padding:1px 10px;border-radius:999px;border:1px solid rgba(217,181,106,.45);background:rgba(26,20,18,.85);font:600 12px/1.4 Figtree,system-ui,sans-serif;color:#f3ece2">Nox · loup adulte</span></span>')
        scene.appendChild(pied)
        await dans(scene, 132, 'neutre', { pieds: 26 })
      },
      async question() {
        const scene = bloc(SCENE(128))
        q('.jour-bandeau').after(scene)
        await dans(scene, 104, 'neutre', { pieds: 22 })
      },
      async revelation() {
        const scene = bloc(SCENE(176))
        q('.jour-bandeau').after(scene)
        await dans(scene, 138, 'ravi', { pieds: 24 })
      },
      async soiree() {
        const scene = bloc(SCENE(176))
        shell().prepend(scene)
        await dans(scene, 132, 'depite', { pieds: 24 })
      },
    },
  }

  window.__pl = {
    async appliquer(concept, ecran) {
      nettoyer()
      const c = CONCEPTS[concept]
      // Au petit téléphone, la question : la même règle que sur le grand.
      await c[ecran === 'petit' ? 'question' : ecran]()
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    },
    nettoyer,
    CONCEPTS: Object.keys(CONCEPTS),
  }
})()

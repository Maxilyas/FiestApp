// Maquette du compagnon qui suit : posé par-dessus les vrais écrans de
// l'application, au moment de la photo. Rien de ceci n'existe dans le code.
// Chargé avant la page (`addInitScript`), donc hors de la politique de contenu.
;(() => {
  const OR = '#d9b56a'
  const CSS = `
.mq-cp{position:absolute;pointer-events:none;z-index:60}
.mq-cp.mq-fixe{position:fixed}
.mq-ombre{position:absolute;left:14%;right:14%;bottom:-5%;height:13%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),rgba(0,0,0,0))}
.mq-corps{position:absolute;inset:0;transform-origin:50% 100%}
.mq-corps img{width:100%;height:100%;display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}
.mq-miroir .mq-corps img{transform:scaleX(-1)}
.mq-ravi .mq-corps{transform:translateY(-13%) rotate(-5deg)}
.mq-miroir.mq-ravi .mq-corps{transform:translateY(-13%) rotate(5deg)}
.mq-ravi .mq-ombre{transform:scale(.62);opacity:.55}
.mq-depite .mq-corps{transform:rotate(3deg) scaleY(.93)}
.mq-miroir.mq-depite .mq-corps{transform:rotate(-3deg) scaleY(.93)}
.mq-depite .mq-corps img{filter:saturate(.35) brightness(.72) drop-shadow(0 3px 6px rgba(0,0,0,.4))}
.mq-peint.mq-ravi .mq-corps,.mq-peint.mq-miroir.mq-ravi .mq-corps{transform:translateY(-7%)}
.mq-peint.mq-depite .mq-corps,.mq-peint.mq-miroir.mq-depite .mq-corps{transform:none}
.mq-peint.mq-depite .mq-corps img{filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}
.mq-triomphe .mq-corps{transform:scale(1.04)}
.mq-triomphe .mq-corps img{filter:drop-shadow(0 0 8px rgba(244,213,141,.9)) drop-shadow(0 0 22px rgba(217,181,106,.55))}
.mq-rayons{position:absolute;left:50%;top:48%;width:175%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:repeating-conic-gradient(from 8deg,rgba(244,213,141,.32) 0 5deg,transparent 5deg 15deg);
  -webkit-mask:radial-gradient(closest-side,#000 22%,transparent 70%);mask:radial-gradient(closest-side,#000 22%,transparent 70%)}
.mq-deco{position:absolute;display:block}
.mq-deco svg{width:100%;height:100%;display:block;overflow:visible}
.mq-nom{position:absolute;left:50%;top:100%;margin-top:6px;transform:translateX(-50%);font:600 12px/1.35 Figtree,system-ui,sans-serif;letter-spacing:.02em;
  color:#f3ece2;background:rgba(26,20,18,.82);border:1px solid rgba(217,181,106,.55);padding:1px 9px;border-radius:999px;white-space:nowrap}
.mq-bloc{font-family:Figtree,system-ui,sans-serif}
`
  function styles() {
    if (document.getElementById('mq-styles')) return
    const s = document.createElement('style')
    s.id = 'mq-styles'
    s.textContent = CSS
    document.head.appendChild(s)
  }

  // Un perso peint a des marges transparentes, et le louveteau quelques flocons
  // autour de lui : on rogne aux colonnes et aux rangées vraiment pleines.
  const rognes = new Map()
  function rogner(src) {
    if (rognes.has(src)) return rognes.get(src)
    // Les humeurs peintes arrivent déjà rognées, toutes au même cadre : on les prend telles quelles.
    if (src.includes('/mq-humeurs/')) {
      const p = new Promise((ok, ko) => {
        const img = new Image()
        img.onload = () => ok({ url: src, ratio: img.naturalWidth / img.naturalHeight })
        img.onerror = () => ko(new Error('image introuvable : ' + src))
        img.src = src
      })
      rognes.set(src, p)
      return p
    }
    const p = new Promise((ok, ko) => {
      const img = new Image()
      img.onload = () => {
        const W = img.naturalWidth
        const H = img.naturalHeight
        const c = document.createElement('canvas')
        c.width = W
        c.height = H
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, W, H).data
        const cols = new Uint32Array(W)
        const rows = new Uint32Array(H)
        for (let y = 0; y < H; y++)
          for (let i = 0; i < W; i++)
            if (d[(y * W + i) * 4 + 3] > 110) {
              cols[i]++
              rows[y]++
            }
        const seuil = Math.max(3, Math.round(W / 64))
        let x0 = 0
        let x1 = W - 1
        let y0 = 0
        let y1 = H - 1
        while (x0 < W - 1 && cols[x0] < seuil) x0++
        while (x1 > x0 && cols[x1] < seuil) x1--
        while (y0 < H - 1 && rows[y0] < seuil) y0++
        while (y1 > y0 && rows[y1] < seuil) y1--
        const m = Math.round(W * 0.012)
        x0 = Math.max(0, x0 - m)
        y0 = Math.max(0, y0 - m)
        x1 = Math.min(W - 1, x1 + m)
        y1 = Math.min(H - 1, y1 + m)
        const w = x1 - x0 + 1
        const h = y1 - y0 + 1
        const o = document.createElement('canvas')
        o.width = w
        o.height = h
        o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h)
        ok({ url: o.toDataURL('image/png'), ratio: w / h })
      }
      img.onerror = () => ko(new Error('image introuvable : ' + src))
      img.src = src
    })
    rognes.set(src, p)
    return p
  }

  // `css`, `css@@texte` — le premier élément qui contient ce texte —, et
  // `…>>css` pour descendre ensuite dans celui-là.
  function trouver(sel) {
    const [avant, dedans] = sel.split('>>')
    const [css, texte] = avant.split('@@')
    const els = [...document.querySelectorAll(css)]
    let el = texte ? els.find(e => (e.textContent || '').includes(texte)) : els[0]
    if (el && dedans) el = el.querySelector(dedans)
    if (!el) throw new Error('introuvable : ' + sel)
    return el
  }
  function rect(sel) {
    const r = trouver(sel).getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, vx: r.left, vy: r.top }
  }

  const ETINCELLE = `<svg viewBox="0 0 24 24"><path d="M12 0C12.8 7.6 16.4 11.2 24 12C16.4 12.8 12.8 16.4 12 24C11.2 16.4 7.6 12.8 0 12C7.6 11.2 11.2 7.6 12 0Z" fill="#f4d58d"/></svg>`
  const COEUR = `<svg viewBox="0 0 24 24"><path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill="#f08bb0"/></svg>`
  const GOUTTE = `<svg viewBox="0 0 24 24"><path d="M12 1.5C12 1.5 4.5 10.5 4.5 15.2a7.5 7.5 0 0 0 15 0C19.5 10.5 12 1.5 12 1.5Z" fill="#9cc8f5"/><path d="M8.6 15.4a3.4 3.4 0 0 0 3.4 3.4" stroke="#e8f3ff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`
  const NUAGE = `<svg viewBox="0 0 40 24"><path d="M10 22h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 5 7.5 7.5 0 0 0 10 22Z" fill="#7d8796"/><path d="M14 22l-2 5M21 22l-2 5M28 22l-2 5" stroke="#9cc8f5" stroke-width="2" stroke-linecap="round"/></svg>`

  function deco(svg, gauche, haut, taille, rot = 0, op = 1) {
    return `<span class="mq-deco" style="left:${gauche}%;top:${haut}%;width:${taille}%;aspect-ratio:1;transform:rotate(${rot}deg);opacity:${op}">${svg}</span>`
  }

  /**
   * Pose le compagnon près d'une ancre.
   * o = { ancre, src, h, place: 'droite'|'gauche'|'libre', dx, dy, humeur, nom, miroir, z, fixe, dans }
   * La hauteur `h` est celle de la bête rognée, en pixels CSS.
   */
  async function poser(o) {
    styles()
    const { url, ratio } = await rogner(o.src)
    const h = o.h
    const w = Math.round(h * ratio)
    const a = typeof o.ancre === 'string' ? rect(o.ancre) : o.ancre
    const fixe = !!o.fixe
    const ax = fixe ? a.vx ?? a.x : a.x
    const ay = fixe ? a.vy ?? a.y : a.y
    let left
    let top
    const dx = o.dx || 0
    const dy = o.dy || 0
    if (o.place === 'gauche') {
      left = ax - w + dx
      top = ay + a.h - h + dy
    } else if (o.place === 'libre') {
      left = ax + dx
      top = ay + dy
    } else if (o.place === 'centre') {
      left = ax + a.w / 2 - w / 2 + dx
      top = ay + a.h - h + dy
    } else if (o.place === 'dedansDroite') {
      // Dans l'ancre, calé à droite, les pattes sur son bas.
      left = ax + a.w - w + dx
      top = ay + a.h - h + dy
    } else if (o.place === 'sous') {
      // Sous l'ancre, calé à droite.
      left = ax + a.w - w + dx
      top = ay + a.h + dy
    } else if (o.place === 'perche') {
      // Assis sur le bord du haut de l'ancre, calé à droite.
      left = ax + a.w - w + dx
      top = ay - h + dy
    } else {
      left = ax + a.w + dx
      top = ay + a.h - h + dy
    }
    const el = document.createElement('div')
    const humeur = o.humeur || 'neutre'
    el.className = `mq-cp mq-${humeur}${o.miroir ? ' mq-miroir' : ''}${fixe ? ' mq-fixe' : ''}${o.src.includes('/mq-humeurs/') ? ' mq-peint' : ''}`
    el.style.cssText = `left:${Math.round(left)}px;top:${Math.round(top)}px;width:${w}px;height:${h}px;z-index:${o.z ?? 60}`
    // La tête est en haut à droite des bêtes peintes ; à gauche, en miroir.
    const tete = o.miroir ? 18 : 70
    let decor = ''
    if (humeur === 'ravi')
      decor =
        deco(COEUR, tete - 4, -16, 20, -12) +
        deco(COEUR, tete + 16, -2, 13, 14, 0.9) +
        deco(ETINCELLE, tete - 26, -6, 15, 0) +
        deco(ETINCELLE, tete + 22, -24, 11, 0, 0.85)
    if (humeur === 'depite') decor = deco(NUAGE, tete - 16, -30, 34, 0, 0.92) + deco(GOUTTE, tete + 14, 4, 11, 0, 0.95)
    if (humeur === 'triomphe')
      decor =
        deco(ETINCELLE, -8, 6, 16, 0) +
        deco(ETINCELLE, 92, 12, 13, 0) +
        deco(ETINCELLE, tete - 6, -22, 17, 0) +
        deco(ETINCELLE, 20, -10, 10, 0, 0.8) +
        deco(ETINCELLE, 84, -12, 10, 0, 0.8)
    el.innerHTML =
      (humeur === 'triomphe' ? '<span class="mq-rayons"></span>' : '') +
      '<span class="mq-ombre"></span>' +
      `<span class="mq-corps"><img alt="" src="${url}"></span>` +
      decor +
      (o.nom ? `<span class="mq-nom">${o.nom}</span>` : '')
    const parent = o.dans ? trouver(o.dans) : document.body
    if (o.dans) {
      const r = parent.getBoundingClientRect()
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
      el.style.left = `${Math.round(left - (r.left + scrollX))}px`
      el.style.top = `${Math.round(top - (r.top + scrollY))}px`
    }
    parent.appendChild(el)
    return { left, top, w, h }
  }

  /** Un bloc écrit à la main, posé avant, après ou dans un élément de la page. */
  function inserer(sel, ou, html) {
    styles()
    trouver(sel).insertAdjacentHTML(ou, html)
  }
  function retoucher(sel, css) {
    const els = [...document.querySelectorAll(sel.split('@@')[0])].filter(e => !sel.includes('@@') || (e.textContent || '').includes(sel.split('@@')[1]))
    for (const e of els) e.style.cssText += ';' + css
    return els.length
  }
  function textes(sel) {
    return [...document.querySelectorAll(sel)].map(e => {
      const r = e.getBoundingClientRect()
      return { cls: e.className && e.className.baseVal === undefined ? e.className : '', t: (e.textContent || '').trim().slice(0, 60), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }
    })
  }
  async function image(src, h, style = '') {
    const { url, ratio } = await rogner(src)
    return `<img alt="" src="${url}" style="height:${h}px;width:${Math.round(h * ratio)}px;display:block;${style}">`
  }
  async function largeur(src, h) {
    const { ratio } = await rogner(src)
    return Math.round(h * ratio)
  }

  // Ce qu'on a décalé pour lui faire de la place : remis à l'identique avant la photo suivante.
  // Par `translate`, pas `transform` : l'animation d'entrée du médaillon du
  // podium (`pop`, gardée par `both`) l'emportait sur un `transform` posé à la main.
  const decales = []
  function decaler(el, dx) {
    decales.push([el, el.style.translate])
    el.style.translate = `${dx}px 0`
  }
  function nettoyer() {
    document.querySelectorAll('.mq-cp,.mq-bloc').forEach(e => e.remove())
    for (const [el, t] of decales.splice(0)) el.style.translate = t
  }

  /**
   * Sur une marche : la tête de la colonne (avatar, nom) se pousse, le
   * compagnon se pose à côté, ses pattes sur la marche.
   * o = { col, src, h, humeur, gap, nom }
   */
  async function surLaMarche(o) {
    const col = trouver(o.col)
    const av = col.querySelector(o.avatar || '.podium-avatar')
    const nom = col.querySelector(o.nomSel || '.podium-name')
    const sol = col.querySelector(o.sol || '.podium-step')
    const w = await largeur(o.src, o.h)
    const ra = av.getBoundingClientRect()
    const rn = nom ? nom.getBoundingClientRect() : ra
    const rs = sol.getBoundingClientRect()
    const tete = Math.max(ra.width, rn.width)
    const gap = o.gap ?? 10
    const total = tete + gap + w
    const centre = rs.left + rs.width / 2
    const debut = centre - total / 2
    const dx = Math.round(debut + tete / 2 - (ra.left + ra.width / 2))
    decaler(av, dx)
    if (nom) decaler(nom, dx)
    return poser({
      ancre: { x: debut + tete + gap + scrollX, y: rs.top + scrollY - o.h + (o.enfonce ?? 6), w: 0, h: o.h },
      place: 'libre',
      src: o.src,
      h: o.h,
      humeur: o.humeur,
      miroir: o.miroir,
      z: o.z,
    })
  }

  /** L'entrée en scène d'un compagnon à l'écran commun, faite comme celle du champion du mois. */
  async function banniere(o) {
    styles()
    // L'avatar de qui arrive : celui de sa puce, dans la liste des invités.
    const sien = o.avatarDe
      ? [...document.querySelectorAll(`${o.avatarDe[0]} .av`)].find(av => {
          // Le plus proche parent qui ne tient que cet avatar-là : sa puce.
          for (let p = av.parentElement; p; p = p.parentElement) {
            if (p.querySelectorAll('.av').length > 1) return false
            if ((p.textContent || '').includes(o.avatarDe[1])) return true
          }
          return false
        })
      : null
    const avatar = sien ? sien.cloneNode(true) : null
    const div = document.createElement('div')
    div.className = 'entree-en-scene mq-bloc'
    div.setAttribute('role', 'status')
    div.style.cssText = 'animation:none;padding-left:1rem;padding-right:2.2rem'
    div.innerHTML = `<span class="entree-rayons" aria-hidden="true" style="animation:none"></span><span class="mq-av"></span><span class="entree-texte"><span class="label">${o.label}</span><b>${o.titre}</b><span>${o.sous}</span></span><span class="mq-place" style="display:block;flex:none;width:${o.place}px"></span>`
    if (avatar) {
      avatar.classList.remove('lb-avatar')
      avatar.classList.add('entree-avatar')
      avatar.style.cssText = ''
      div.querySelector('.mq-av').replaceWith(avatar)
    } else div.querySelector('.mq-av').remove()
    document.body.appendChild(div)
    const r = div.querySelector('.mq-place').getBoundingClientRect()
    return poser({ ancre: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, vx: r.left, vy: r.top }, place: 'libre', dx: o.dx ?? 0, dy: o.dy ?? 0, src: o.src, h: o.h, humeur: o.humeur, miroir: o.miroir, fixe: true, z: 70 })
  }

  /** La carte « Il a grandi » d'une fin de partie, faite comme « Ce que tu gagnes ». */
  async function carteCroissance(o) {
    styles()
    const de = await image(o.de, o.petit ?? 58, 'filter:saturate(.75) brightness(.8);opacity:.9')
    const vers = await image(o.vers, o.grand ?? 104, 'filter:drop-shadow(0 0 14px rgba(244,213,141,.5))')
    const pct = Math.round((o.jauge.fait / o.jauge.total) * 100)
    const html = `<section class="card gains mq-bloc" aria-label="${o.label}">
  <span class="label">${o.label}</span>
  <div style="display:flex;align-items:flex-end;gap:14px;margin:10px 0 6px">
    ${de}
    <svg viewBox="0 0 24 24" style="width:22px;height:22px;flex:none;margin-bottom:22px;color:var(--accent,#d9b56a)" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    ${vers}
  </div>
  <b style="display:block;font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.75rem;line-height:1.15">${o.titre}</b>
  <p class="muted small" style="margin:4px 0 0">${o.texte}</p>
  <div class="gains-niveau">
    <div class="xp-bar" role="progressbar" aria-label="${o.jauge.texte}"><div class="xp-fill" style="width:${pct}%"></div></div>
    <p class="muted small">${o.jauge.texte}</p>
  </div>
</section>`
    trouver(o.ou).insertAdjacentHTML(o.position || 'afterend', html)
  }

  /** « Ce soir, ils ont grandi », à la clôture de l'écran commun : un bloc posé à une place libre. */
  async function grandisCeSoir(o) {
    styles()
    const lignes = []
    for (const l of o.lignes) {
      const de = await image(l.de, 54, 'filter:saturate(.75) brightness(.8)')
      const vers = await image(l.vers, 96, 'filter:drop-shadow(0 0 14px rgba(244,213,141,.5))')
      lignes.push(`<div style="display:flex;align-items:flex-end;gap:14px">
  ${de}
  <svg viewBox="0 0 24 24" style="width:22px;height:22px;flex:none;margin-bottom:18px;color:var(--accent,#d9b56a)" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  ${vers}
  <div style="display:flex;flex-direction:column;gap:2px;margin-left:6px;margin-bottom:8px;min-width:0">
    <b style="font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.9rem;line-height:1.05">${l.titre}</b>
    <span style="color:var(--muted,#a89b8a);font-size:1.05rem">${l.texte}</span>
  </div>
</div>`)
    }
    const div = document.createElement('div')
    div.className = 'mq-bloc'
    div.style.cssText = `position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;box-sizing:border-box;padding:18px 22px;border:1px solid var(--edge,rgba(217,181,106,.22));border-radius:18px;background:var(--surface,rgba(255,255,255,.035));z-index:55;display:flex;flex-direction:column;gap:14px`
    div.innerHTML = `<span style="font-family:var(--serif,'Cormorant Garamond',serif);font-size:1.6rem;color:var(--ink,#f3ece2)">${o.titre}</span>` + lignes.join('')
    document.body.appendChild(div)
  }

  /**
   * Une place faite dans une rangée (la ligne de l'accueil) : un espace posé
   * après un élément, le compagnon dedans, ses pattes au bas de `sol`.
   */
  async function poserApres(o) {
    const el = trouver(o.apres)
    const place = document.createElement('span')
    place.className = 'mq-bloc'
    place.style.cssText = `display:block;flex:none;align-self:stretch;width:${o.largeur}px;margin-left:${o.marge ?? 0}px`
    el.insertAdjacentElement('afterend', place)
    const w = await largeur(o.src, o.h)
    const rp = place.getBoundingClientRect()
    const rs = (o.sol ? trouver(o.sol) : place).getBoundingClientRect()
    return poser({
      ancre: { x: rp.left + scrollX + rp.width / 2 - w / 2, y: rs.bottom + scrollY - o.h, w: 0, h: o.h },
      place: 'libre',
      dx: o.dx ?? 0,
      dy: o.dy ?? 0,
      src: o.src,
      h: o.h,
      humeur: o.humeur,
      miroir: o.miroir,
    })
  }

  function changerTexte(sel, html) {
    const el = trouver(sel)
    decales.push([el, el.style.translate])
    el.dataset.mqAvant = el.innerHTML
    el.innerHTML = html
    el.classList.add('mq-texte')
  }
  function rendreLesTextes() {
    document.querySelectorAll('.mq-texte').forEach(el => {
      el.innerHTML = el.dataset.mqAvant
      el.classList.remove('mq-texte')
    })
  }

  /** La carte de fin d'une partie : ce qu'il a fait avec toi, sa jauge — sans changer de forme. */
  async function carteJauge(o) {
    styles()
    const lui = await image(o.src, o.h ?? 78, 'filter:drop-shadow(0 0 10px rgba(244,213,141,.35))')
    const pct = Math.round((o.jauge.fait / o.jauge.total) * 100)
    const html = `<section class="card gains mq-bloc" aria-label="${o.label}">
  <span class="label">${o.label}</span>
  <div style="display:flex;align-items:flex-end;gap:16px;margin-top:8px">
    <span style="flex:none;transform:scaleX(-1)">${lui}</span>
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;margin-bottom:6px">
      <b style="font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.6rem;line-height:1.1">${o.titre}</b>
      <span class="muted small">${o.texte}</span>
    </div>
  </div>
  <div class="gains-niveau">
    <div class="xp-bar" role="progressbar" aria-label="${o.jauge.texte}"><div class="xp-fill" style="width:${pct}%"></div></div>
    <p class="muted small">${o.jauge.texte}</p>
  </div>
</section>`
    trouver(o.ou).insertAdjacentHTML(o.position || 'afterend', html)
  }

  const CASE = 'display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 6px 10px;border-radius:16px;border:1px solid var(--edge,rgba(217,181,106,.22));background:var(--surface,rgba(255,255,255,.035));color:var(--ink,#f3ece2);font:inherit;text-align:center;min-width:0'
  const CASE_ON = 'border-color:var(--edge-strong,rgba(217,181,106,.6));background:var(--accent-soft,rgba(217,181,106,.12));box-shadow:0 0 0 1px var(--edge-strong,rgba(217,181,106,.6)) inset'
  const PASTILLE = 'display:inline-block;margin-top:4px;font-size:.7rem;font-weight:700;letter-spacing:.04em;padding:2px 8px;border-radius:999px'

  /** La loge, sur une pièce de plus : « Compagnon » — qui te suit, sa forme, son nom. */
  async function logeCompagnon(o) {
    styles()
    // La pièce, faite comme les autres, juste après l'avatar.
    const titre = trouver('#loge-titre')
    const piece = titre.cloneNode(true)
    piece.id = 'loge-compagnon'
    piece.classList.add('mq-bloc')
    for (const n of piece.childNodes) if (n.nodeType === 3) n.textContent = ''
    const rond = piece.querySelector('.loge-rond')
    if (rond) rond.innerHTML = `<span style="display:grid;place-items:center;width:100%;height:100%;overflow:hidden;border-radius:50%;transform:scaleX(-1)">${await image(o.icone, 34)}</span>`
    // Sept pièces sur la rangée, cinq que la salle voit : la grille et ses groupes suivent.
    const css = document.createElement('style')
    css.className = 'mq-bloc'
    css.textContent = `.loge-rangee{grid-template-columns:repeat(7,minmax(0,1fr))!important}
.loge-groupes{grid-template-columns:5fr 2fr!important}
.loge-piece{font-size:.7rem!important;letter-spacing:-.01em}
.loge-rangee>.loge-pour-moi:nth-child(5)::before{display:none}
.loge-rangee>.loge-pour-moi:nth-child(6)::before{content:'';position:absolute;left:-3px;top:6px;width:1px;height:36px;background:var(--edge)}`
    document.head.appendChild(css)
    piece.insertAdjacentHTML('beforeend', '<span class="mq-etiquette">Compagnon</span>')
    // L'étiquette de la pièce est son texte : on garde la forme de celle du titre.
    const etiquette = [...titre.querySelectorAll('span')].find(s => !s.classList.contains('loge-rond') && !s.closest('.loge-rond') && (s.textContent || '').trim())
    if (etiquette) piece.querySelector('.mq-etiquette').className = etiquette.className + ' mq-etiquette'
    trouver('#loge-avatar').insertAdjacentElement('afterend', piece)
    for (const t of document.querySelectorAll('.loge-rangee [role="tab"]')) {
      t.dataset.mqSel = t.getAttribute('aria-selected')
      t.setAttribute('aria-selected', t === piece ? 'true' : 'false')
      t.classList.add('mq-tab')
    }
    // Qui le voit, sous la rangée.
    const qui = document.querySelector('.loge-qui')
    if (qui) changerTexte('.loge-qui', (qui.querySelector('svg')?.outerHTML ?? '') + o.qui)
    // Le panneau de la pièce.
    const panneau = trouver('.loge-panneau')
    panneau.dataset.mqAvant = '1'
    for (const c of panneau.children) {
      c.dataset.mqCache = c.style.display || ' '
      c.style.display = 'none'
    }
    const cases = []
    for (const c of o.compagnons) {
      const im = c.src ? await image(c.src, c.h ?? 62, 'width:auto;max-width:100%;transform:scaleX(-1)') : `<span style="display:block;width:56px;height:56px;border-radius:50%;border:1px dashed var(--edge-strong,rgba(217,181,106,.6));margin:3px 0"></span>`
      cases.push(`<button type="button" style="${CASE};${c.on ? CASE_ON : ''}" aria-pressed="${c.on ? 'true' : 'false'}">
  <span style="height:${c.src ? c.h ?? 62 : 62}px;display:flex;align-items:flex-end">${im}</span>
  <b style="font-size:1rem">${c.nom}</b>
  <span class="muted small" style="line-height:1.2">${c.quoi}</span>
  ${c.etat ? `<span style="${PASTILLE};${c.on ? 'background:var(--accent,#d9b56a);color:#1a1412' : 'color:var(--muted,#a89b8a);border:1px solid var(--edge,rgba(217,181,106,.22))'}">${c.etat}</span>` : ''}
</button>`)
    }
    const formes = []
    for (const f of o.formes) {
      const im = await image(f.src, 44, `width:auto;max-width:100%;transform:scaleX(-1);${f.ferme ? 'filter:brightness(0) drop-shadow(0 0 1px rgba(217,181,106,.9));opacity:.8' : ''}`)
      formes.push(`<button type="button" style="${CASE};padding:8px 4px 8px;gap:4px;${f.on ? CASE_ON : ''}" aria-pressed="${f.on ? 'true' : 'false'}">
  <span style="height:44px;display:flex;align-items:flex-end">${im}</span>
  <span class="small" style="line-height:1.15;${f.ferme ? 'color:var(--muted,#a89b8a)' : ''}">${f.nom}</span>
</button>`)
    }
    const pct = Math.round((o.jauge.fait / o.jauge.total) * 100)
    panneau.insertAdjacentHTML(
      'beforeend',
      `<div class="mq-bloc" style="display:flex;flex-direction:column;gap:20px;padding:6px 0 28px">
  <section style="display:flex;flex-direction:column;gap:10px">
    <span class="label">Qui te suit</span>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">${cases.join('')}</div>
  </section>
  <section style="display:flex;flex-direction:column;gap:10px">
    <span class="label">${o.titreFormes}</span>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${formes.join('')}</div>
    <div class="gains-niveau" style="margin-top:2px">
      <div class="xp-bar" role="progressbar" aria-label="${o.jauge.texte}"><div class="xp-fill" style="width:${pct}%"></div></div>
      <p class="muted small" style="margin:6px 0 0">${o.jauge.texte}</p>
    </div>
  </section>
  <section style="display:flex;flex-direction:column;gap:8px">
    <label class="label" for="mq-nom-loge">Son nom</label>
    <input id="mq-nom-loge" class="input" value="${o.nom}" style="font-size:1.05rem;padding:11px 14px;border-radius:12px;border:1px solid var(--edge,rgba(217,181,106,.22));background:rgba(0,0,0,.25);color:var(--ink,#f3ece2)">
    <p class="muted small" style="margin:0">${o.aideNom}</p>
  </section>
</div>`,
    )
  }
  function rendreLaLoge() {
    document.querySelectorAll('.mq-tab').forEach(t => {
      t.setAttribute('aria-selected', t.dataset.mqSel)
      t.classList.remove('mq-tab')
    })
    const panneau = document.querySelector('.loge-panneau')
    if (panneau) for (const c of panneau.children) if (c.dataset.mqCache) c.style.display = c.dataset.mqCache.trim()
  }

  /** La feuille d'adoption de la boutique : son nom d'abord, et s'il te suit dès maintenant. */
  async function feuilleAdoption(o) {
    styles()
    const lui = await image(o.src, 92, 'width:auto')
    const voile = document.createElement('div')
    voile.className = 'mq-bloc'
    voile.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(10,7,6,.62)'
    document.body.appendChild(voile)
    const f = document.createElement('div')
    f.className = 'mq-bloc'
    f.setAttribute('role', 'dialog')
    f.setAttribute('aria-label', o.titre)
    f.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:81;box-sizing:border-box;padding:12px 20px 22px;border-radius:24px 24px 0 0;background:var(--bg-raised,#241c18);border-top:1px solid var(--edge-strong,rgba(217,181,106,.6));box-shadow:0 -18px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:14px'
    f.innerHTML = `<span style="display:block;width:44px;height:4px;border-radius:2px;background:var(--edge,rgba(217,181,106,.3));margin:0 auto 2px"></span>
<div style="display:flex;align-items:flex-end;gap:14px">
  <span style="flex:none">${lui}</span>
  <div style="display:flex;flex-direction:column;gap:4px;min-width:0;margin-bottom:6px">
    <span class="label">${o.qui}</span>
    <b style="font-family:var(--serif,'Cormorant Garamond',serif);font-weight:600;font-size:1.75rem;line-height:1.05">${o.titre}</b>
  </div>
</div>
<label class="sr-only" for="mq-nom">Son nom</label>
<input id="mq-nom" value="${o.nom}" style="font:inherit;font-size:1.15rem;padding:12px 14px;border-radius:12px;border:1px solid var(--edge-strong,rgba(217,181,106,.6));background:rgba(0,0,0,.25);color:var(--ink,#f3ece2)">
<div style="display:flex;flex-wrap:wrap;gap:8px">${o.idees
      .map(
        i =>
          `<button type="button" style="font:inherit;font-size:.92rem;padding:6px 14px;border-radius:999px;border:1px solid ${i === o.nom ? 'var(--edge-strong,rgba(217,181,106,.6));background:var(--accent-soft,rgba(217,181,106,.12));color:var(--accent,#d9b56a)' : 'var(--edge,rgba(217,181,106,.22));background:none;color:var(--ink,#f3ece2)'}">${i}</button>`,
      )
      .join('')}</div>
<label style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:14px;border:1px solid var(--edge,rgba(217,181,106,.22));background:var(--surface,rgba(255,255,255,.035))">
  <input type="checkbox" checked style="width:20px;height:20px;margin:2px 0 0;accent-color:#d9b56a;flex:none">
  <span style="display:flex;flex-direction:column;gap:2px"><b style="font-weight:600">${o.suivre}</b><span class="muted small">${o.suivreAide}</span></span>
</label>
<div style="display:flex;gap:10px;align-items:center">
  <button type="button" class="btn">Plus tard</button>
  <button type="button" class="btn btn-primary" style="flex:1;justify-content:center;min-height:48px">${o.bouton}</button>
</div>`
    document.body.appendChild(f)
  }

  /** Une ligne de plus, sous un élément : ce que la carte dit de lui. */
  function ligneSous(sel, html) {
    trouver(sel).insertAdjacentHTML('afterend', `<p class="mq-bloc" style="margin:10px 0 0;color:var(--muted,#a89b8a);font-size:.93rem;line-height:1.35">${html}</p>`)
  }

  const nettoyerTout = () => {
    rendreLaLoge()
    rendreLesTextes()
    nettoyer()
  }

  window.__mq = {
    poser,
    inserer,
    retoucher,
    rect,
    textes,
    rogner,
    styles,
    OR,
    surLaMarche,
    banniere,
    carteCroissance,
    carteJauge,
    grandisCeSoir,
    poserApres,
    logeCompagnon,
    feuilleAdoption,
    ligneSous,
    changerTexte,
    nettoyer: nettoyerTout,
    decaler: (sel, dx) => decaler(trouver(sel), dx),
  }
})()

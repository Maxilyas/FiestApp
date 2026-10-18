// Maquette — sa niche, sur la durée : après sa forme ultime (500 bonnes
// réponses), la niche elle-même s'embellit, palier par palier, et garde
// chaque ornement gagné. Rien ne change de place ni de taille : la même
// niche, toujours au même coin, un peu plus belle chaque fois. Chargé après
// niche.js. Rien de ceci n'existe dans le code.
;(() => {
  const CSS = `
.ncp{position:absolute;inset:0;overflow:visible;pointer-events:none}
.ncp svg{position:absolute;overflow:visible}
/* 1 000 : la guirlande — de petites lampes chaudes le long de l'arche. */
.ncp-lampe{animation:ncp-lampe 3.2s ease-in-out infinite}
@keyframes ncp-lampe{0%,100%{opacity:.75}50%{opacity:1}}
/* 5 000 : l'arche dorée et son étoile. */
.nc.ncp-or .nc-cadre{border:1.5px solid #f3d27a;box-shadow:0 0 0 1px rgba(243,210,122,.35),0 0 10px rgba(243,210,122,.45),0 8px 18px rgba(0,0,0,.45)}
.nc.ncp-or .nc-rebord{background:linear-gradient(#fff1c2,#d9a640 60%,#a8772a)}
/* 10 000 : la légende — un halo qui respire à peine, des étincelles dans son ciel. */
.ncp-halo{position:absolute;inset:-14px;border-radius:40px 40px 22px 22px;background:radial-gradient(closest-side,rgba(255,222,140,.42),rgba(255,222,140,0));animation:ncp-halo 4.5s ease-in-out infinite;z-index:-1}
@keyframes ncp-halo{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
.ncp-scintille{animation:ncp-scintille 2.6s ease-in-out infinite}
@keyframes ncp-scintille{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
`
  function styles() {
    if (document.getElementById('ncp-styles')) return
    const s = document.createElement('style')
    s.id = 'ncp-styles'
    s.textContent = CSS
    document.head.appendChild(s)
  }

  const ETOILE = (x, y, r, couleur = '#fff4c7') => {
    const t = r * 0.28
    return `<path d="M${x},${y - r} L${x + t},${y - t} L${x + r},${y} L${x + t},${y + t} L${x},${y + r} L${x - t},${y + t} L${x - r},${y} L${x - t},${y - t} Z" fill="${couleur}"/>`
  }
  const FEUILLE = (x, y, angle, l = 7) =>
    `<path transform="translate(${x} ${y}) rotate(${angle})" d="M0,0 C${l * 0.35},-${l * 0.45} ${l * 0.8},-${l * 0.35} ${l},0 C${l * 0.8},${l * 0.35} ${l * 0.35},${l * 0.45} 0,0 Z" fill="#6fae5c"/>`
  const FLEUR = (x, y, r, couleur) =>
    [0, 72, 144, 216, 288].map(a => `<circle cx="${x + Math.cos((a * Math.PI) / 180) * r}" cy="${y + Math.sin((a * Math.PI) / 180) * r}" r="${r * 0.82}" fill="${couleur}"/>`).join('') +
    `<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="#ffd36a"/>`

  /** Les ornements d'une niche, jusqu'au palier donné : 'ami' (1 000), 'complice' (2 500), 'inseparable' (5 000), 'legende' (10 000). */
  function orner(nc, palier) {
    styles()
    const rang = ['ami', 'complice', 'inseparable', 'legende'].indexOf(palier)
    nc.querySelector('.ncp')?.remove()
    nc.classList.toggle('ncp-or', rang >= 2)
    const L = nc.offsetWidth
    const H = nc.offsetHeight
    let svg = ''
    if (rang >= 3) nc.insertAdjacentHTML('afterbegin', '<span class="ncp-halo"></span>')
    if (rang >= 0) {
      // La guirlande : un fil qui suit l'arche, et ses lampes.
      const lampes = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92]
      const fil = `<path d="M${-2},${H * 0.42} C${-2},${-8} ${L + 2},${-8} ${L + 2},${H * 0.42}" fill="none" stroke="#5a4632" stroke-width="1"/>`
      const points = lampes.map((t, k) => {
        // Sur la même courbe que le fil (une cubique), un peu sous lui.
        const u = 1 - t
        const x = u * u * u * -2 + 3 * u * u * t * -2 + 3 * u * t * t * (L + 2) + t * t * t * (L + 2)
        const y = u * u * u * (H * 0.42) + 3 * u * u * t * -8 + 3 * u * t * t * -8 + t * t * t * (H * 0.42)
        const couleur = ['#ffd27a', '#ffb3a7', '#bfe8ff', '#ffd27a', '#d9f5a6', '#ffb3a7', '#ffd27a'][k]
        return `<g class="ncp-lampe" style="animation-delay:${k * 0.45}s"><circle cx="${x}" cy="${y + 2.4}" r="3.6" fill="${couleur}" opacity=".35"/><circle cx="${x}" cy="${y + 2.4}" r="1.8" fill="${couleur}"/></g>`
      })
      svg += fil + points.join('')
    }
    if (rang >= 1) {
      // Les fleurs du rebord : du lierre et deux petites fleurs, de chaque côté.
      svg +=
        FEUILLE(-3, H - 4, 200) + FEUILLE(-1, H - 1, 150, 6) + FLEUR(3, H - 6, 2.2, '#f7a8c4') +
        FEUILLE(L + 3, H - 4, -20) + FEUILLE(L + 1, H - 1, 30, 6) + FLEUR(L - 4, H - 6, 2.2, '#c9b6ff')
    }
    if (rang >= 2) svg += `<g transform="translate(0 0)">${ETOILE(L / 2, -9, 5.5, '#ffe9a8')}</g>`
    if (rang >= 3) {
      svg += [
        [L * 0.18, H * 0.2, 1.8, 0],
        [L * 0.84, H * 0.3, 1.5, 0.8],
        [L * 0.3, H * 0.52, 1.2, 1.5],
        [L * 0.74, H * 0.6, 1.6, 2.1],
      ]
        .map(([x, y, r, d]) => `<g class="ncp-scintille" style="transform-origin:${x}px ${y}px;animation-delay:${d}s">${ETOILE(x, y, r * 2, '#fffbe6')}</g>`)
        .join('')
    }
    const couche = document.createElement('span')
    couche.className = 'ncp'
    couche.innerHTML = `<svg width="${L}" height="${H}" viewBox="0 0 ${L} ${H}" style="left:0;top:0">${svg}</svg>`
    nc.appendChild(couche)
  }

  window.__paliers = { orner }
})()

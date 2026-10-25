// Ce qu'une photo ne dit pas d'elle-même, mesuré dans la page même : ce qui
// élargit la page, un texte que son cadre coupe, ce qui passe sous la niche du
// compagnon, et le contraste de chaque texte sur ce qui est vraiment peint
// derrière lui. Pas un script : les scripts de rendu qui les disent le
// partagent (`rendu-cabinet.ts`, `rendu-niche.ts`, `rendu-themes.ts`) — une
// mesure retouchée l'est pour chacun, et aucun n'en garde une copie qui
// vieillirait seule.
//
// Les mesures partent dans la page en texte, jamais en fonction : `tsx`
// glisserait dans une fonction des `__name` que la page ne connaît pas. Un
// texte relevé s'y coupe par points de code (`[...texte].slice(0, 40)`) :
// `tronquer()` n'y est pas, et `slice` laissait la moitié d'un emoji à la
// frontière, qui sortait en losange dans le rapport.

/**
 * Ce qui passe sous la niche, page en haut : chaque ligne de texte (ses
 * boîtes de ligne, pas son bloc entier), chaque bouton, lien, champ ou image
 * dont la boîte la touche. Sans niche : `(pas de niche)`.
 */
export const SOUS_LA_NICHE = `(() => {
  const niche = document.querySelector('.niche')
  if (!niche) return ['(pas de niche)']
  // Repliée et effacée — la page a défilé sous une tête collée — : rien ne passe dessous.
  if (Number(getComputedStyle(niche).opacity) === 0) return []
  const n = niche.getBoundingClientRect()
  // Recouverte — le voile d'une feuille ou d'un dialogue passe par-dessus elle — : ce qui s'y pose est au-dessus d'elle, rien n'est
  // dessous. Sa propre fiche la fait passer au-dessus du voile (\`.niche.ouverte\`) : elle reste mesurée. Pas \`elementFromPoint\` :
  // il saute ce qui ne prend pas le doigt, et la niche inerte sous sa fiche ne le prend pas.
  if (document.querySelector('.carte-voile, .dialog-backdrop') && !niche.classList.contains('ouverte')) return []
  const touche = r => r.width > 0 && r.height > 0 && r.right > n.left + 1 && r.left < n.right - 1 && r.bottom > n.top + 1 && r.top < n.bottom - 1
  const visible = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    }
    return true
  }
  const nom = el => {
    const classe = (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.')
    return el.tagName.toLowerCase() + (classe ? '.' + classe : '')
  }
  const vus = []
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.niche, .sr-only, script, style') || !visible(el)) continue
    const plage = document.createRange()
    plage.selectNodeContents(t)
    if ([...plage.getClientRects()].some(touche)) vus.push('texte « ' + [...t.textContent.trim()].slice(0, 40).join('') + ' » (' + nom(el) + ')')
  }
  for (const el of document.querySelectorAll('a, button, input, select, textarea, img, svg, [role=button]')) {
    if (el.closest('.niche') || !visible(el)) continue
    if (el.tagName === 'svg' && el.closest('a, button')) continue
    const r = el.getBoundingClientRect()
    // Une grande illustration (le cadran des duels) touche par sa boîte, pas par son dessin.
    if (el.tagName === 'svg' && r.width > 120 && r.height > 120) continue
    if (touche(r)) vus.push(nom(el))
  }
  return [...new Set(vus)]
})()`

/**
 * Ce qui élargit la page (règle `css.md` : rien ne défile de côté), et ce qui
 * l'élargit, nommé — une boîte plus large que l'écran, ou ce qui est posé en
 * absolu au-delà de son bord : un `.sr-only` dont le cadre est plus haut
 * qu'un cadre qui défile n'est pas coupé par lui (le paquet de l'offre de
 * l'Expédition, le 18 octobre 2026). `large` : la largeur de la page, 0 si
 * elle tient dans l'écran.
 */
export const CE_QUI_DEBORDE = `(() => {
  const ecran = document.documentElement.clientWidth
  const large = document.documentElement.scrollWidth
  if (large <= ecran + 1) return { large: 0, fautifs: [] }
  const nom = e => e.tagName.toLowerCase() + '.' + String(e.className.baseVal ?? e.className).split(' ').filter(Boolean).slice(0, 2).join('.')
  const fautifs = [...document.querySelectorAll('body *')]
    .filter(e => {
      const r = e.getBoundingClientRect()
      return r.right > ecran + 1 && !e.closest('.carte-voile') && (r.width > ecran + 1 || ['absolute', 'fixed'].includes(getComputedStyle(e).position))
    })
    .slice(0, 4)
    .map(e => nom(e) + ' ' + Math.round(e.getBoundingClientRect().right))
  return { large, fautifs }
})()`

/**
 * Les textes coupés : une ligne de texte qui dépasse un cadre qui ne défile
 * pas (`overflow: hidden` ou `clip`, une ellipse, des lignes bornées), ou le
 * bord de l'écran — ce que la feuille cache sans rien dire, et qu'une photo ne
 * montre que si l'on sait où regarder. Ce qui dépasse d'un cadre qui défile
 * (une rangée, une feuille) n'est pas coupé : on y va en défilant.
 */
export const CE_QUI_EST_COUPE = `(() => {
  const ecran = document.documentElement.clientWidth
  const visible = el => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    }
    return true
  }
  const nom = el => el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ').filter(Boolean).slice(0, 2).join('.')
  const coupes = []
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    // La gerbe jaillit de son cadre, et la niche découpe son compagnon : c'est leur dessin, pas un texte coupé.
    if (!el || !t.textContent.trim() || el.closest('.sr-only, script, style, .gerbe, .niche') || !visible(el)) continue
    const plage = document.createRange()
    plage.selectNodeContents(t)
    const boites = [...plage.getClientRects()].filter(b => b.width > 1 && b.height > 1)
    if (!boites.length) continue
    let defile = false
    let coupe = null
    for (let a = el; a && a !== document.documentElement && !coupe; a = a.parentElement) {
      const s = getComputedStyle(a)
      const enX = s.overflowX, enY = s.overflowY
      if (['auto', 'scroll'].includes(enX) || ['auto', 'scroll'].includes(enY)) { defile = true; break }
      const parX = ['hidden', 'clip'].includes(enX), parY = ['hidden', 'clip'].includes(enY)
      if (!parX && !parY) continue
      const r = a.getBoundingClientRect()
      const g = r.left + a.clientLeft, d = g + a.clientWidth, h = r.top + a.clientTop, b = h + a.clientHeight
      if (boites.some(x => (parX && (x.right > d + 1 || x.left < g - 1)) || (parY && (x.bottom > b + 1 || x.top < h - 1)))) coupe = nom(a)
    }
    if (!coupe && !defile && boites.some(x => x.right > ecran + 1 || x.left < -1)) coupe = 'le bord de l’écran'
    if (coupe) coupes.push('« ' + [...t.textContent.trim()].slice(0, 40).join('') + ' » (' + nom(el) + ', par ' + coupe + ')')
  }
  return [...new Set(coupes)]
})()`

/**
 * Un texte qui passe sous un bouton voisin : dans une même rangée — le bouton
 * et le texte ont un parent ou un grand-parent communs, sur le même plan —,
 * une ligne de texte dont la boîte entre de plus de deux pixels dans celle
 * d'un bouton, d'un lien ou d'un champ qui ne la porte pas. Une rangée trop
 * serrée ne déborde pas toujours de la page : ce qui rétrécit laisse son texte
 * passer sous le voisin (« 0 / 9 ★ » sous « Quitter », dans la tête d'une
 * partie). Un plan, c'est ce qui se pose par-dessus le reste : une feuille, un
 * dialogue, la niche, une tête ou un pied collés — ce qui défile dessous, ou
 * la page sous un voile, ne sont pas de la même rangée —, et le cadre qui
 * défile : le corps d'une feuille passe sous sa barre et sa croix, qui n'en
 * sont pas.
 */
export const CE_QUI_SE_CHEVAUCHE = `(() => {
  const visible = el => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    }
    return true
  }
  const plan = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.matches('.carte-voile, .dialog-backdrop, .niche')) return e
      const s = getComputedStyle(e)
      if (s.position === 'sticky' || s.position === 'fixed') return e
      if (['auto', 'scroll'].includes(s.overflowY) && e.scrollHeight > e.clientHeight) return e
    }
    return null
  }
  const nom = el => el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ').filter(Boolean).slice(0, 2).join('.')
  const gestes = [...document.querySelectorAll('button, a, input, select, textarea, [role=button]')].filter(g => visible(g) && !g.closest('.sr-only'))
  const vus = []
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.sr-only, script, style, .gerbe, .niche') || !visible(el)) continue
    const plage = document.createRange()
    plage.selectNodeContents(t)
    const boites = [...plage.getClientRects()].filter(b => b.width > 1 && b.height > 1)
    const sonPlan = plan(el)
    for (const g of gestes) {
      if (g.contains(el) || plan(g) !== sonPlan) continue
      const p = g.parentElement
      if (!p || !(p.contains(el) || (p.parentElement && p.parentElement.contains(el) && p.parentElement !== document.body))) continue
      const r = g.getBoundingClientRect()
      const dedans = b => Math.min(b.right, r.right) - Math.max(b.left, r.left) > 2 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 2
      if (boites.some(dedans)) vus.push('« ' + [...t.textContent.trim()].slice(0, 30).join('') + ' » (' + nom(el) + ') sous ' + nom(g))
    }
  }
  return [...new Set(vus)]
})()`

/** Le contraste d'une ligne de texte mesuré sur la photo, et le seuil qu'elle doit tenir. */
export interface ContrasteDUneLigne {
  texte: string
  ratio: number
  seuil: number
}

/**
 * Le contraste de chaque texte à l'écran sur ce qui est vraiment peint
 * derrière lui : les lignes de texte sont relevées, puis le texte devient
 * transparent — son halo reste, il fait partie de ce que l'œil lit — et la
 * photo dit, sous chaque ligne, le pixel le plus clair (pour un texte clair)
 * ou le plus sombre (pour un texte sombre), au 95ᵉ centile. Seuils WCAG :
 * 4,5:1, ou 3:1 pour un grand texte. La page se rend telle qu'elle était : la
 * feuille qui efface le texte repart, une photo peut suivre.
 *
 * La photo se lit à la densité de l'écran (`devicePixelRatio`) : écrite à 2,
 * une photo de l'écran commun, à 1, mesurait un autre coin que la ligne.
 */
export async function contrasteDeLaPage(page: any): Promise<ContrasteDUneLigne[]> {
  const lignes: any[] = await page.evaluate(`(() => {
    const out = []
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const texte = n.textContent.trim()
      if (!texte || !n.parentElement) continue
      // Ce qui ne se lit qu'à l'oreille ne se mesure pas ; un geste éteint non plus — WCAG n'en demande rien, sa sourdine
      // dit justement qu'il ne sert pas (« Valider » sur un mot incomplet, Éclairer qui n'a plus rien à éclairer).
      if (n.parentElement.closest('.sr-only, [aria-disabled="true"], :disabled')) continue
      const s = getComputedStyle(n.parentElement)
      if (s.visibility !== 'visible' || Number(s.opacity) === 0) continue
      const r = document.createRange()
      r.selectNodeContents(n)
      const taille = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700
      for (const b of r.getClientRects()) {
        // Une ligne entière à l'écran : coupée par son bord, la photo la lisait sur du vide — noir —, et une ligne en bas de
        // l'écran se disait illisible à 1,3:1.
        if (b.width < 4 || b.height < 4 || b.top < 0 || b.bottom > innerHeight || b.left < 0 || b.right > innerWidth) continue
        // Recouvert, même en partie (la barre du menu, un dialogue, le pied d'une feuille qui défile) : on ne le voit pas en
        // entier, on ne le mesure pas — ce qui le couvre se serait lu comme son fond.
        const x = b.left + b.width / 2
        const couvert = [b.top + 1, b.top + b.height / 2, b.bottom - 1].some(y => {
          const dessus = document.elementFromPoint(x, y)
          return dessus && !n.parentElement.contains(dessus) && !dessus.contains(n.parentElement)
        })
        if (couvert) continue
        // Hors du cadre qui la porte — défilée hors d'une feuille, sous sa barre : la page ne la montre pas, le voile n'est pas son fond.
        let cachee = false
        for (let a = n.parentElement; a && a !== document.documentElement && !cachee; a = a.parentElement) {
          const sa = getComputedStyle(a)
          if (sa.overflowX === 'visible' && sa.overflowY === 'visible') continue
          const c = a.getBoundingClientRect()
          cachee = b.top < c.top - 1 || b.bottom > c.bottom + 1 || b.left < c.left - 1 || b.right > c.right + 1
        }
        if (cachee) continue
        // Le fond se lit derrière les lettres, pas dans tout l'interligne : la boîte d'une ligne déborde de sa police, et ce qui
        // n'est peint que dans l'interligne — le bas d'une ombre portée — ne gêne pas la lecture.
        const h = Math.min(b.height, taille)
        out.push({ texte: [...texte].slice(0, 30).join(''), couleur: s.color, grand: taille >= 24 || (gras && taille >= 18.66), x: b.left, y: b.top + (b.height - h) / 2, l: b.width, h })
      }
    }
    return out
  })()`)
  const efface = await page.addStyleTag({ content: '* { color: transparent !important; caret-color: transparent !important; } img, svg, video { visibility: hidden !important; }' })
  try {
    await page.waitForTimeout(150)
    const png: Buffer = await page.screenshot({ type: 'png' })
    const dpr = Number(await page.evaluate('window.devicePixelRatio')) || 1
    return await page.evaluate(
      `(async ({ src, lignes, dpr }) => {
        const i = new Image(); i.src = src; await i.decode()
        const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0)
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
        const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        return lignes.map(l => {
          const [r, g, b, a = 1] = l.couleur.match(/[\\d.]+/g).map(Number)
          if (a < 0.5) return null
          const Lt = lum(r, g, b)
          const d = x.getImageData(Math.max(0, Math.round(l.x * dpr)), Math.max(0, Math.round(l.y * dpr)), Math.max(1, Math.round(l.l * dpr)), Math.max(1, Math.round(l.h * dpr))).data
          const fonds = []
          for (let k = 0; k < d.length; k += 4) fonds.push(lum(d[k], d[k + 1], d[k + 2]))
          fonds.sort((p, q) => p - q)
          const clair = Lt > 0.18
          const pire = clair ? fonds[Math.floor(fonds.length * 0.95)] : fonds[Math.floor(fonds.length * 0.05)]
          const ratio = (Math.max(Lt, pire) + 0.05) / (Math.min(Lt, pire) + 0.05)
          return { texte: l.texte, ratio: Math.round(ratio * 100) / 100, seuil: l.grand ? 3 : 4.5 }
        }).filter(Boolean)
      })(${JSON.stringify({ src: `data:image/png;base64,${png.toString('base64')}`, lignes, dpr })})`,
    )
  } finally {
    await efface.evaluate((e: { remove(): void }) => e.remove())
  }
}

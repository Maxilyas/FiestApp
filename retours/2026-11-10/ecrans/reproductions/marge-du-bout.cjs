// La marge du bout, au pixel : la feuille construite (`client/dist`) posée sur des coquilles faites à la main, leur contenu
// allongé pixel par pixel de part et d'autre du bas de l'écran. Aucun serveur : la feuille seule, dans Chromium.
//
//   npm run build -w client
//   node retours/2026-11-10/ecrans/reproductions/marge-du-bout.cjs                  # 360 × 640
//   node retours/2026-11-10/ecrans/reproductions/marge-du-bout.cjs 390x844 --encoche=34
//   node retours/2026-11-10/ecrans/reproductions/marge-du-bout.cjs --avant=<un autre dépôt construit>
//
// La loi, pour chaque coquille à ressort : tant que son contenu tient, la page ne défile pas ; dès qu'il dépasse, elle
// défile de ce qui dépasse et de la marge qui revient au bout — autant que ce qui dépasse, jusqu'à la marge entière.
// Avec `--avant`, la même page sous la feuille d'un autre dépôt (celui d'avant le correctif) : jamais plus de défilement,
// et aucun bloc qui bouge, à aucune hauteur — les coquilles qui gardent leur marge telle quelle comprises. Le script sort
// en erreur si la loi ne tient pas.
const fs = require('fs'), path = require('path')
const { execSync } = require('child_process')
const { chromium } = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'))

const depot = path.resolve(__dirname, '../../../..')
const avant = (process.argv.find(a => a.startsWith('--avant=')) ?? '').slice(8)
const [L, H] = (process.argv.find(a => /^\d+x\d+$/.test(a)) ?? '360x640').split('x').map(Number)
const encoche = Number((process.argv.find(a => a.startsWith('--encoche=')) ?? '=0').split('=')[1])
const feuille = d => {
  const dir = path.join(d, 'client/dist/assets')
  return fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(x => /^index-.*\.css$/.test(x))), 'utf8')
}

/** Un bloc de hauteur fixe ; `X` : celui qu'on allonge. */
const bloc = (h, plus = '') => `<div class="bloc ${plus}" style="flex: none; height: ${h}px"></div>`
const X = `<div class="bloc" data-x style="flex: none; height: 0px"></div>`
const MENU = `<nav class="menu-barre"></nav>`
/**
 * Un cas : les classes du corps, la coquille, et la marge du bas qui s'y resserre — `encoche` : ce qu'il en reste sous
 * l'encoche d'un téléphone, qui ne se rend pas ; 0 : une coquille qui garde sa marge telle quelle, comparée sous `--avant`.
 */
const sousLEncoche = marge => Math.max(0, marge - encoche)
const CAS = [
  { nom: 'le téléphone d’un invité (28 px)', marge: sousLEncoche(28), html: `<div class="player-shell">${bloc(100)}${X}</div>` },
  { nom: 'une révélation, centrée dans la page (.quiz-player)', marge: sousLEncoche(28), html: `<div class="player-shell"><div class="quiz-player"><div class="card result-banner" style="animation: none; padding: 0; height: 60px"></div>${X}</div></div>` },
  { nom: 'une épreuve de la campagne (.quiz-player.epreuve)', marge: sousLEncoche(28), html: `<div class="player-shell campagne sentiers"><div class="quiz-player epreuve">${bloc(80)}${X}</div></div>` },
  // Son geste poussé au bas de la page (`margin-top: auto`) — sans le coller à l'écran ici : collé, il ne dirait plus où finit la page.
  { nom: 'les duels, sans écart, leur geste poussé en bas', marge: sousLEncoche(28), html: `<div class="player-shell campagne duels">${X}<div class="sous-le-pouce duels-geste-principal" style="position: static"><button class="btn btn-primary btn-big btn-block btn-duel">Jouer</button></div></div>` },
  { nom: 'un duel reçu (.duels-defi, sans écart)', marge: sousLEncoche(28), html: `<div class="player-shell campagne duels-defi">${bloc(120)}${X}</div>` },
  { nom: 'un duel envoyé (.duels-envoye, sans écart)', marge: sousLEncoche(28), html: `<div class="player-shell campagne duels-envoye">${bloc(120)}${X}</div>` },
  { nom: 'une fin de partie (.fin-soiree, écart de 14)', marge: sousLEncoche(28), html: `<div class="player-shell fin-soiree">${bloc(100)}${X}</div>` },
  // Sous 900 px de haut, sa page se resserre : 16 px de marge, un écart de 12 — de 10 sous 760.
  { nom: `le départ d’une série (${H < 900 ? '16 px, sa page resserrée' : '28 px'})`, marge: sousLEncoche(H < 900 ? 16 : 28), html: `<div class="player-shell campagne"><section class="bloc campagne-heros" style="flex: none; height: 100px; padding: 0"></section>${X}</div>` },
  { nom: 'une page à menu (24 px)', corps: 'avec-menu', marge: 24, html: `<div class="player-shell">${bloc(100)}${X}</div>${MENU}` },
  // Les écrans du profil resserrés le même jour, chacun à ses mesures. La loge, sans compagnon dans sa niche, serre son
  // écart à deux pas de hauteur d'écran ; le classement des collections pose le sien par sa variable (`--cl-ecart`) ; la
  // page du compagnon n'a plus de marge du bas sur un téléphone (`--chez-bas`, de rien à 24 px passé 800 px de haut) :
  // le ressort lit les mêmes. À 24 px sur une page qui n'en a plus, ce dont elle dépassait l'écran passait derrière le
  // menu sans qu'elle défile.
  { nom: `la loge, à menu (écart de ${H < 760 ? 8 : H < 940 ? 10 : 14})`, corps: 'avec-menu', marge: 24, html: `<div class="player-shell loge-page">${bloc(100)}${X}</div>${MENU}` },
  { nom: 'la loge, à menu, un compagnon dans sa niche (écart de 14)', corps: 'avec-menu avec-niche', marge: 24, html: `<div class="player-shell loge-page">${bloc(100)}${X}</div>${MENU}` },
  { nom: 'le classement des collections, à menu (son écart suit la hauteur de l’écran)', corps: 'avec-menu', marge: 24, html: `<div class="player-shell cl-page">${bloc(100)}${X}</div>${MENU}` },
  { nom: 'chez le compagnon, à menu (sa marge suit la hauteur de l’écran)', corps: 'avec-menu', marge: Math.round((Math.min(280, Math.max(0, H - encoche - 800)) * 24 / 280) * 100) / 100, html: `<div class="player-shell chez-page">${bloc(100)}${X}</div>${MENU}` },
  { nom: 'la boutique et son panier', corps: 'avec-menu avec-panier', marge: 24, html: `<div class="player-shell">${bloc(100)}${X}</div>${MENU}` },
  { nom: 'le téléphone du chef (sa barre de 64 px)', corps: 'avec-chef', marge: 24, html: `<div class="player-shell">${bloc(100)}${X}</div><div class="barre-chef"></div>` },
  { nom: 'le téléphone du chef, la barre haute (88 px)', corps: 'avec-chef', marge: 24, html: `<div class="player-shell">${bloc(100)}${X}</div><div class="barre-chef"><p class="barre-chef-attente">On attend Léa</p></div>` },
  { nom: 'un formulaire (.join, 36 px)', marge: sousLEncoche(36), html: `<div class="join">${bloc(100)}${X}<div class="join-grow"></div><div class="join-actions">${bloc(52)}</div></div>` },
  { nom: 'l’entrée d’une soirée (.join.entree, écart de 14)', marge: sousLEncoche(36), html: `<div class="join entree">${bloc(100)}${X}<div class="join-grow"></div><div class="join-actions">${bloc(52)}</div></div>` },
  { nom: 'sous le bandeau du service (58 px)', bandeau: 58, marge: sousLEncoche(28), html: `<div class="player-shell">${bloc(100)}${X}</div>` },
  { nom: 'une question du Cabinet, sans pied (46 px)', marge: sousLEncoche(46), html: `<div class="player-shell cab-page cab-partie">${bloc(100)}<div class="quiz-player cab-manche">${X}<div class="ans-grid">${bloc(52, 'ans-btn')}${bloc(52, 'ans-btn')}</div></div></div>` },
  { nom: 'une manche du Cabinet, sans pied', marge: sousLEncoche(28), html: `<div class="player-shell cab-page cab-partie">${bloc(100)}<div class="quiz-player cab-manche">${X}</div></div>` },
  { nom: 'une page du Cabinet, le formulaire du nom posé dedans', marge: sousLEncoche(28), html: `<div class="player-shell cab-page"><form class="join cab-nom">${bloc(40)}${X}</form></div>` },
  // Celles qui gardent leur marge telle quelle : sous `--avant`, rien n'y change.
  { nom: '(intacte) une manche du Cabinet et son pied collé', marge: 0, html: `<div class="player-shell cab-page cab-partie">${bloc(100)}<div class="quiz-player cab-manche">${X}</div><div class="cab-pied-partie">${bloc(52)}</div></div>` },
  { nom: '(intacte) une question du Cabinet et son pied collé', marge: 0, html: `<div class="player-shell cab-page cab-partie">${bloc(100)}<div class="quiz-player cab-manche">${X}<div class="ans-grid">${bloc(52, 'ans-btn')}${bloc(52, 'ans-btn')}</div></div><div class="cab-pied-partie">${bloc(52)}</div></div>` },
  { nom: '(intacte) la question d’une soirée', marge: 0, html: `<div class="player-shell"><div class="quiz-player">${X}<div class="ans-grid">${bloc(52, 'ans-btn')}${bloc(52, 'ans-btn')}</div><p class="hint">Réponse enregistrée</p></div></div>` },
  { nom: '(intacte) la question du chef', corps: 'avec-chef', marge: 0, html: `<div class="player-shell"><div class="quiz-player">${X}<div class="ans-grid">${bloc(52, 'ans-btn')}${bloc(52, 'ans-btn')}</div></div></div><div class="barre-chef"></div>` },
  { nom: '(intacte) l’accueil d’un profil', corps: 'avec-menu', marge: 0, html: `<div class="player-shell accueil">${bloc(100)}${X}</div>${MENU}` },
  { nom: '(intacte) le carrefour du profil', corps: 'avec-menu', marge: 0, html: `<div class="player-shell profil-carrefour">${bloc(100)}${X}</div>${MENU}` },
  { nom: '(intacte) le verdict d’un duel', marge: 0, html: `<div class="player-shell campagne duels-verdict">${bloc(100)}${X}</div>` },
  { nom: '(intacte) l’Expédition', marge: 0, html: `<div class="player-shell expedition">${bloc(100)}${X}</div>` },
  { nom: '(intacte) le QG', marge: 0, html: `<div class="player-shell compte admin qg">${bloc(100)}${X}</div>` },
  { nom: '(intacte) un formulaire dans la porte de la télé', marge: 0, html: `<div class="porte-ecran"><div class="join">${bloc(100)}${X}</div></div>` },
  { nom: '(intacte) une page centrée', marge: 0, html: `<div class="center-page"><div>${X}</div></div>` },
  { nom: '(intacte) une page tombée', marge: 0, html: `<div class="filet">${X}</div>` },
]

/**
 * Le contenu allongé à `x`, puis : de combien la page défile, où tombe chaque bloc, et ce dont le contenu dépasse le bas de
 * l'écran une fois compté ce qui ne se rend jamais — la marge de la coquille moins ce qu'elle rend (`marge`), et ce que
 * le corps garde à la barre du menu.
 */
const MESURE = `((x, marge) => {
  document.querySelector('[data-x]').style.height = x + 'px'
  const r = e => { const b = e.getBoundingClientRect(); return [Math.round((b.top + scrollY) * 10) / 10, Math.round((b.bottom + scrollY) * 10) / 10] }
  const blocs = [...document.querySelectorAll('.bloc, .quiz-player, .join-actions, .sous-le-pouce, .cab-pied-partie, .hint, .ans-grid')].map(r)
  const coquille = document.querySelector('.player-shell, .join, .center-page, .filet')
  const garde = parseFloat(getComputedStyle(coquille).paddingBottom) - marge + parseFloat(getComputedStyle(document.body).paddingBottom)
  return { defile: Math.max(0, document.documentElement.scrollHeight - innerHeight), blocs, depasse: Math.max(...blocs.map(b => b[1])) + garde - innerHeight }
})`

;(async () => {
  const nav = await chromium.launch({ headless: true })
  const ctx = await nav.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: 1 })
  const ouvrir = async d => {
    const page = await ctx.newPage()
    // L'encoche du bas d'un iPhone : Chromium sans écran la tient à zéro (skill `regarder-le-rendu`).
    if (encoche) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, topMax: 0, bottom: encoche, bottomMax: encoche, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
    const css = feuille(d)
    return {
      poser: cas => page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css}</style></head><body class="${cas.corps ?? ''}"${cas.bandeau ? ` style="--haut-du-bandeau: ${cas.bandeau}px"` : ''}><div id="root">${cas.bandeau ? `<div style="height: ${cas.bandeau}px"></div>` : ''}<main>${cas.html}</main></div></body></html>`),
      mesurer: (x, marge) => page.evaluate(`${MESURE}(${x}, ${marge})`),
    }
  }
  const ici = await ouvrir(depot)
  const la = avant ? await ouvrir(path.resolve(avant)) : null
  console.log(`${L} × ${H}${encoche ? `, une encoche de ${encoche} px en bas` : ''} — ${depot}${la ? `, comparé à ${path.resolve(avant)}` : ''}`)
  let fautes = 0
  for (const cas of CAS) {
    if (cas.marge === 0 && !la && cas.nom.startsWith('(intacte)')) continue
    await ici.poser(cas)
    if (la) await la.poser(cas)
    // Où le contenu arrive au bas de l'écran : on balaie soixante pixels avant, cent dix après.
    let pli = null
    for (let x = 0; x <= H + 300; x++) if ((await ici.mesurer(x, cas.marge)).depasse >= 0) { pli = x; break }
    if (pli === null) { console.log(`? ${cas.nom} : son contenu n'atteint jamais le bas de l'écran`); fautes++; continue }
    const hors = [], bouge = [], plus = []
    let moins = 0
    const lus = []
    for (let x = Math.max(0, pli - 60); x <= pli + 110; x++) {
      const m = await ici.mesurer(x, cas.marge)
      const d = Math.round(m.depasse * 10) / 10
      // La loi. Sans marge à rendre — sous une grande encoche —, la page défile de ce qui dépasse, et de rien d'autre.
      const attendu = d <= 0 ? 0 : d >= cas.marge ? d + cas.marge : 2 * d
      if (cas.nom.startsWith('(intacte)') ? false : Math.abs(m.defile - attendu) > 1) hors.push(`dépasse de ${d} px : défile de ${m.defile}, attendu ${Math.round(attendu)}`)
      if ([-10, 0, 1, 5, 10, cas.marge, cas.marge + 20].includes(x - pli)) lus.push(`${d > 0 ? '+' : ''}${Math.round(d)} → ${m.defile}`)
      if (la) {
        const a = await la.mesurer(x, cas.marge)
        if (m.defile > a.defile) plus.push(`x=${x} : ${a.defile} → ${m.defile}`)
        if (m.defile < a.defile) moins++
        if (!(a.blocs.length === m.blocs.length && a.blocs.every((b, i) => Math.abs(b[0] - m.blocs[i][0]) < 0.6 && Math.abs(b[1] - m.blocs[i][1]) < 0.6))) bouge.push(`x=${x}`)
      }
    }
    const intacteQuiChange = la && cas.nom.startsWith('(intacte)') && moins > 0
    const faute = hors.length || bouge.length || plus.length || intacteQuiChange
    if (faute) fautes++
    console.log(`${faute ? '✗' : '✓'} ${cas.nom} — ${cas.nom.startsWith('(intacte)') ? 'rien ne change' : `rend ${cas.marge} px`} · ce qui dépasse → ce dont la page défile : ${[...new Set(lus)].join(' · ')}${la ? ` · ${moins} hauteurs où elle défile moins qu'avant` : ''}`)
    for (const [quoi, liste] of [['HORS DE LA LOI', hors], ['UN BLOC A BOUGÉ', bouge], ['DÉFILE PLUS QU’AVANT', plus]]) if (liste.length) console.log(`    ${quoi} (${liste.length}) : ${liste.slice(0, 4).join(' ; ')}`)
    if (intacteQuiChange) console.log('    UNE COQUILLE INTACTE A CHANGÉ')
  }
  await nav.close()
  console.log(fautes ? `\n${fautes} cas hors de la loi` : '\nTout suit la loi.')
  // Par le code de sortie de Node : ce qui vient de s'écrire part d'abord.
  process.exitCode = fautes ? 1 : 0
})()

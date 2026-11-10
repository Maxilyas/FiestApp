// Une page prend l'écran, pas plus : la barre du menu et le bandeau du service
// comptés dans sa hauteur.
//
// Une coquille de page prenait au moins l'écran (`min-height: 100dvh`) sans
// regarder ce que la page pose autour d'elle. La barre du menu pose son
// retrait sur le corps (`body.avec-menu`, 72 px et l'encoche du bas) : l'un
// sur l'autre, toute page à menu défilait de la hauteur de la barre, même à
// moitié vide — « Mes soirées » d'un nouveau venu de 72 px, avec 325 px de
// libre au-dessus du menu ; « Mon compagnon » sans compagnon, « Compte » sur
// un grand téléphone, de même (la revue des écrans du 10 novembre 2026, en
// 360 × 640 et 390 × 844). Le bandeau du service, posé au-dessus de la page,
// s'y ajoutait : 58 px de plus sous lui — 130 pour « Mes soirées » —, et
// autant sur l'écran d'une page en maintenance ou l'accueil sans profil, qui
// n'ont pas de menu.
//
// Ce qui défile ne se voit qu'au navigateur : `server/scripts/rendu-carrefour.ts`
// ouvre ces pages et sort en erreur si l'une défile alors que son contenu
// tient. Ici, la feuille : la règle qui retranche, ce qu'elle retranche, et ce
// qui doit garder la main sur elle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')
const CSS = client('styles.css')
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

/** Les coquilles qui prennent l'écran : une page centrée, un formulaire, la page d'un téléphone, le filet d'une page tombée. */
const COQUILLES = ['.center-page', '.join', '.player-shell', '.filet']
/** Ce que chacune retranche de l'écran : la barre du menu en bas, le bandeau du service en haut — rien, là où il n'y en a pas. */
const RETRANCHE = '- var(--haut-du-menu, 0px) - var(--haut-du-bandeau, 0px)'

/** Chaque règle de la feuille, dans l'ordre : son sélecteur, son corps, où elle commence, et la condition qui l'enveloppe. */
function regles(): { selecteur: string; corps: string; ou: number; sous: string }[] {
  const lues: { selecteur: string; corps: string; ou: number; sous: string }[] = []
  const pile: string[] = []
  const motif = /([^{}]+)\{|\}/g
  for (let m = motif.exec(SANS_COMMENTAIRES); m; m = motif.exec(SANS_COMMENTAIRES)) {
    if (m[0] === '}') {
      pile.pop()
      continue
    }
    const selecteur = m[1].trim()
    // Une condition (`@media`, `@supports`) enveloppe des règles ; `@keyframes` et `@font-face`, des étapes qu'on ne lit pas.
    if (selecteur.startsWith('@')) {
      pile.push(selecteur)
      continue
    }
    const fin = SANS_COMMENTAIRES.indexOf('}', motif.lastIndex)
    lues.push({ selecteur, corps: SANS_COMMENTAIRES.slice(motif.lastIndex, fin), ou: m.index, sous: pile.join(' ') })
    motif.lastIndex = fin + 1
  }
  assert.ok(lues.length > 5000 && pile.length === 0, `la feuille est bien lue (${lues.length} règles, ${pile.length} condition(s) restée(s) ouverte(s))`)
  return lues
}
const REGLES = regles()
/** Les règles qui donnent une hauteur minimale à ce sélecteur, seul ou dans une liste. */
const hauteursDe = (selecteur: string) => REGLES.filter(r => r.selecteur.split(',').some(s => s.trim() === selecteur) && /(?:^|[;\s])min-height\s*:/.test(r.corps))
const minHeight = (corps: string) => /(?:^|[;\s])min-height\s*:\s*([^;]+);/.exec(corps)?.[1].trim()

test('une coquille prend l’écran moins la barre du menu et le bandeau du service : une page qui tient ne défile plus', () => {
  for (const coquille of COQUILLES) {
    const hauteurs = hauteursDe(coquille)
    // Sa règle d'origine d'abord — l'écran —, puis celle qui retranche, en fin de feuille et à la même force : une seule
    // classe. Elle la remplace, et toute règle plus précise garde la main.
    assert.ok(hauteurs.length >= 3, `${coquille} : sa règle d'origine, puis les deux qui retranchent (${hauteurs.length})`)
    const [vh, dvh] = hauteurs.slice(-2)
    assert.equal(minHeight(vh.corps), `calc(100vh ${RETRANCHE})`, coquille)
    assert.equal(vh.sous, '', `${coquille} : le repli en \`vh\`, pour tous`)
    assert.equal(minHeight(dvh.corps), `calc(100dvh ${RETRANCHE})`, coquille)
    assert.equal(dvh.sous, '@supports (min-height: 100dvh)', `${coquille} : \`dvh\` là où le navigateur le connaît`)
    assert.ok(hauteurs[0].ou < vh.ou && vh.ou < dvh.ou)
    // `dvh`, comme avant : la coquille suit la barre d'adresse du navigateur. Seules les pages qui tiennent sur un écran
    // comptent en `svh` (l'accueil, le carrefour du profil).
    assert.match(hauteurs[0].corps, /min-height: 100vh;\s*min-height: 100dvh;/, `${coquille} prenait l'écran`)
  }
  // Une seule règle pour les quatre, et rien d'autre dans sa liste : une classe de plus y prendrait la hauteur de l'écran.
  const laRegle = hauteursDe('.player-shell').at(-1)!
  assert.deepEqual(laRegle.selecteur.split(',').map(s => s.trim()), COQUILLES)

  // Ce que la barre du menu prend au bas de la page : le retrait même que le corps se pose, dit une fois. Le panier de la
  // boutique, posé au-dessus d'elle, de même. Changer l'un sans l'autre, et la page défile de leur écart.
  const retrait = (selecteur: string, propriete: string) => {
    const lues = REGLES.filter(r => r.selecteur === selecteur && r.corps.includes(`${propriete}:`))
    assert.equal(lues.length, 1, `${selecteur} { ${propriete} } : une seule règle`)
    return new RegExp(`${propriete}:\\s*([^;]+);`).exec(lues[0].corps)?.[1].trim()
  }
  assert.equal(retrait('body.avec-menu', 'padding-bottom'), 'calc(72px + env(safe-area-inset-bottom))')
  assert.equal(retrait('body.avec-menu', '--haut-du-menu'), retrait('body.avec-menu', 'padding-bottom'))
  assert.equal(retrait('body.avec-menu.avec-panier', '--haut-du-menu'), retrait('body.avec-menu.avec-panier', 'padding-bottom'))
  // Et qui les pose : la barre du menu sur le corps, **avant que la page ne se dessine** (`useLayoutEffect`) — posée après
  // (`useEffect`), la page se mesurait une image sans elle : le carrefour du profil prenait tout l'écran, ses lignes de
  // 68 px hautes de 123 en 390 × 844, puis reprises sous le doigt (`rendu-carrefour.ts` suit la carte image par image :
  // « LA CARTE A BOUGÉ ») — ; le bandeau, sa hauteur mesurée — nulle quand il se tait, pendant une question.
  assert.match(client('components/Pieces.tsx'), /useLayoutEffect\(\(\) => \{(?:\s*\/\/[^\n]*)*\s*const zone = ici \? ZONE\[ici\] : null\s*document\.body\.classList\.add\('avec-menu'\)/)
  assert.match(client('components/BandeauxDuService.tsx'), /document\.body\.style\.setProperty\('--haut-du-bandeau', `\$\{ici\.offsetHeight\}px`\)/)
  assert.match(CSS, /\nbody:has\(\.player-shell \.ans-grid\) \.bandeau-du-service \{ display: none; \}/)
})

test('une hauteur qui lit une variable se replie sous @supports, jamais en seconde déclaration', () => {
  // Une déclaration qui contient `var()` est tenue pour valide à la lecture : le navigateur qui ne connaît pas `dvh` ne
  // retombe pas sur le `vh` écrit au-dessus d'elle, il la jette au calcul — et la coquille n'a plus de hauteur du tout
  // (vérifié dans Chromium sur une unité inconnue : `min-height: 100px; min-height: calc(100zzz - var(--x, 0px))` vaut 0).
  const debut = CSS.indexOf("/* ── Une page prend l'écran, pas plus")
  assert.ok(debut > 0, 'le bloc des hauteurs se trouve')
  const suivant = CSS.indexOf('\n/* ── ', CSS.indexOf('/* ── Le carrefour du profil', debut) + 1)
  const fautives = REGLES.filter(r => r.ou >= debut && (suivant < 0 || r.ou < suivant)).filter(r => {
    const hauteurs = [...r.corps.matchAll(/(?:^|[;\s])min-height\s*:\s*([^;]+);/g)].map(m => m[1])
    return hauteurs.length > 1 || (hauteurs.some(h => /\d[sdl]vh/.test(h) && h.includes('var(')) && !/@supports \(min-height: 100[sd]vh\)/.test(r.sous))
  })
  assert.deepEqual(fautives.map(r => r.selecteur), [])
})

test('ce qui doit garder la main la garde : l’accueil, une question, le QG, un formulaire dans une autre page', () => {
  // La règle qui retranche n'a qu'une classe : tout sélecteur plus précis l'emporte, où qu'il soit dans la feuille.
  const plusPrecis = (selecteur: string) => (selecteur.match(/\.[\w-]+|:has\(|\[/g) ?? []).length >= 2
  for (const [selecteur, attendu] of [
    // L'accueil d'un profil tient sur un écran, jusqu'à son plafond, et compte en `svh` (sa formule : `accueil-compact.test.ts`).
    ['body.avec-menu .accueil', /min-height: min\(calc\(100svh - /],
    // Le carrefour du profil, de même.
    ['body.avec-menu .profil-carrefour', /min-height: min\(calc\(100svh - var\(--haut-du-menu, 0px\) - var\(--haut-du-bandeau, 0px\)\), var\(--carrefour-plafond\)\);/],
    // Une question tient l'écran au pixel près — le bandeau se tait alors, et sa hauteur vaut zéro.
    ['.player-shell:has(.ans-grid)', /height: 100dvh;/],
    // Le QG, à l'ordinateur : son rail tient toute la hauteur de l'écran.
    ['.player-shell.qg', /min-height: 100vh;/],
    // Un formulaire posé dans une autre page ne prend pas l'écran : la porte de la télé, le nom d'un joueur au Cabinet.
    ['.porte-ecran .join', /min-height: 0;/],
    ['.join.cab-nom', /min-height: 0;/],
  ] as const) {
    assert.ok(plusPrecis(selecteur), selecteur)
    const lues = REGLES.filter(r => r.selecteur === selecteur && attendu.test(r.corps))
    assert.ok(lues.length >= 1, `${selecteur} garde sa hauteur`)
  }
  // Et rien n'est coupé pour autant : aucune coquille ne borne sa hauteur ni ne fait défiler ce qu'elle contient — une
  // page longue défile dans la fenêtre, de ce qui dépasse.
  for (const coquille of COQUILLES) {
    for (const r of REGLES.filter(x => x.selecteur.split(',').some(s => s.trim() === coquille))) assert.doesNotMatch(r.corps, /max-height|overflow(?:-y)?\s*:/, coquille)
  }
})

test('sous le bandeau, le temps du chargement : la racine prend ce qu’il laisse, et rien ne bouge quand la page le reprend', () => {
  // Le serveur pose le bandeau avant la racine, et la page ne le mesure qu'une fois là (`BandeauxDuService`) : d'ici là, sa
  // hauteur vaut zéro, et l'attente écrite dans la page (`ecrireAttente`, une `.center-page`) prenait tout l'écran sous
  // lui — la page défilait de 58 px, et « Chargement… », centré 29 px trop bas, remontait d'autant à l'arrivée de React
  // (rejoué dans Chromium, le code de la page retenu deux secondes). Tant qu'il est là, la racine prend ce qu'il laisse.
  const sous = '@supports (min-height: 100dvh)'
  const regle = (selecteur: string) => {
    const lues = REGLES.filter(r => r.selecteur === selecteur)
    assert.equal(lues.length, 1, selecteur)
    assert.equal(lues[0].sous, sous, `${selecteur} : avec \`dvh\`, ou pas du tout`)
    return lues[0].corps
  }
  assert.match(regle('body:has(> .bandeau-du-service)'), /display: flex; flex-direction: column; min-height: 100dvh;/)
  assert.match(regle('body:has(> .bandeau-du-service) > #root'), /display: flex; flex: 1 0 auto; flex-direction: column; min-height: 0;/)
  assert.match(regle('body:has(> .bandeau-du-service) > #root > .center-page'), /flex: 1 0 auto; min-height: 0;/)
  // Le bandeau du serveur est bien l'enfant direct du corps, avant la racine, et l'attente celui de la racine ; la page le
  // retire en le reprenant, dans la même image — ces règles cessent alors de valoir, et la hauteur mesurée prend le relais.
  assert.match(client('components/BandeauxDuService.tsx'), /document\.querySelectorAll<HTMLElement>\(`body > \.\$\{CLASSE_DU_BANDEAU\}`\)/)
  assert.match(client('components/BandeauxDuService.tsx'), /useLayoutEffect\(\(\) => \{[\s\S]*?for \(const b of poses\) b\.remove\(\)[\s\S]*?document\.body\.classList\.add\('avec-bandeau'\)/)
  assert.match(client('annonce.tsx'), /<div className="center-page">\s*<div className="attente" role="status">/)
})

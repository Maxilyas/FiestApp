// Une feuille, une carte ou un dialogue ouvert : la page de dessous ne défile
// plus, et rien ne clignote en l'ouvrant (les remarques du propriétaire du
// 15 octobre 2026, sur la feuille des missions du jour).
//
// « Une sorte de saccade où l'image remonte un peu un coup » : arrivé au bout
// de la feuille, le geste suivant passait à la page de l'accueil — 309
// pixels, mesurés au doigt dans Chromium — et, au téléphone, la barre
// d'adresse se repliait : l'écran grandissait, et la feuille, posée en bas
// d'un voile fixe, sautait d'un coup. Le même voile sert vingt-six feuilles,
// la carte d'un joueur et les dialogues.
//
// « L'intégralité de l'écran qui clignote très rapidement » : le voile se
// posait noir d'un coup, sous une feuille encore transparente — 38, puis 15,
// puis 34 de luminosité, filmé image par image. Et figer la page par son
// défilement (`html { overflow: hidden }`, la première réponse à la saccade)
// la changeait de nature à l'ouverture : la barre d'adresse peut revenir, et
// tout l'écran se redimensionnait le temps qu'elle glisse. Puis, en fondu
// d'opacité, le voile emportait la feuille avec lui : « c'est la page de
// dessous qui s'affiche une micro seconde (l'accueil) », au téléphone — sa
// couleur seule s'anime depuis.
//
// « Une histoire de transparence avec le thème qui passe par-dessus » (le
// propriétaire, le 19 octobre 2026) : sous vingt-cinq thèmes sur trente-cinq,
// la carte d'un ami, touchée dans la liste des amis, laissait lire toute la
// liste au travers d'elle — le `.card` d'un thème, en verre translucide, est
// plus fort que le sol de la carte. Et sous Le Sommet, au téléphone Android,
// la feuille des amis ne se dessinait pas : les couches fixes du décor
// prenaient la mémoire des tuiles, et le décor restait à sa place.
//
// Un vrai geste demande un navigateur ; ici, les règles qui l'empêchent, et
// les voiles qui les portent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const css = source('styles.css')
/** Une règle de la feuille de style, jusqu'à son accolade fermante. */
const regle = (selecteur: string) => {
  const debut = css.indexOf(`${selecteur} {`)
  assert.ok(debut >= 0, selecteur)
  return css.slice(debut, css.indexOf('}', debut))
}

test('le cadre qui défile garde ses gestes : arrivé au bout, il ne les passe pas à la page de dessous', () => {
  assert.match(regle('.carte-corps'), /overflow-y: auto; overscroll-behavior: contain;/, 'le corps d’une feuille')
  assert.match(regle('.carte-defile'), /overflow-y: auto; overscroll-behavior: contain;/, 'la carte d’un joueur')
})

test('le voile ne laisse passer aucun geste vers la page — sans jamais figer la page elle-même', () => {
  // `touch-action` s'arrête au cadre qui défile : la feuille défile toujours, rien d'autre.
  assert.match(regle('.carte-voile'), /touch-action: none;/)
  assert.match(regle('.dialog-backdrop'), /touch-action: none;/)
  assert.doesNotMatch(css, /html:has\([^)]*\)\s*\{\s*overflow: hidden/, 'le défilement de la page ne change pas à l’ouverture')
  // Les voiles que ces règles visent sont bien ceux que posent la feuille, le dialogue et la carte.
  assert.match(source('components/Pieces.tsx'), /<div className="carte-voile" onClick=\{onFermer\}>/)
  assert.match(source('components/Dialog.tsx'), /<div className="dialog-backdrop" onClick=/)
  assert.match(source('components/CarteJoueur.tsx'), /<div className="dialog-backdrop" onClick=\{onFermer\}>/)
})

/** Une animation de la feuille de style, jusqu'à la fin de son dernier pas. */
const pas = (nom: string) => {
  const debut = css.indexOf(`@keyframes ${nom} {`)
  assert.ok(debut >= 0, nom)
  return css.slice(debut, css.indexOf('}\n}', debut))
}

test('à l’ouverture, le voile s’assombrit avec la feuille qui monte, par sa couleur — et celui d’une carte ou d’un dialogue : rien ne clignote', () => {
  assert.match(regle('.carte-voile'), /animation: voile-tombe 0\.22s ease-out both;/, 'le voile au pas de la feuille')
  assert.match(regle('.carte-feuille'), /animation: carte-monte 0\.22s ease-out;/)
  // Le voile s'assombrit par sa couleur, jamais par son opacité : en fondu
  // d'opacité, il emportait la feuille, tout l'écran repartait de transparent,
  // et au téléphone l'accueil reparaissait le temps d'une image.
  assert.match(pas('voile-tombe'), /from \{ background-color: rgba\(8, 5, 4, 0\);/)
  assert.doesNotMatch(pas('voile-tombe'), /opacity/)
  assert.doesNotMatch(regle('.carte-voile'), /opacity/)
  // Le voile d'une carte ou d'un dialogue de même : la carte d'un joueur, sa fiche, un « Partir ? ».
  assert.match(regle('.dialog-backdrop'), /animation: voile-tombe 0\.15s ease-out both;/)
  assert.doesNotMatch(regle('.dialog-backdrop'), /opacity/)
  // La feuille ne s'efface pas elle-même : transparente sur un voile déjà noir, elle faisait le trou.
  assert.doesNotMatch(pas('carte-monte'), /opacity/)
})

// ── Sous tous les thèmes, rien ne se lit au travers ────────────────────────

const THEMES = new URL('../../client/src/themes/', import.meta.url)
/** Chaque feuille où un thème peint : la sienne, et la commune pour Ivoire. */
const feuillesDesThemes: [string, string][] = [
  ['styles.css', css],
  ...readdirSync(THEMES)
    .filter(f => f.endsWith('.css'))
    .map((f): [string, string] => [f, readFileSync(new URL(f, THEMES), 'utf8')]),
]
/** Une liste de sélecteurs coupée à ses virgules — pas à celles d'une parenthèse, `:not(a, b)`. */
const couper = (liste: string) =>
  liste
    .split(/,(?![^(]*\))/)
    .map(s => s.trim())
    .filter(Boolean)
/** Les règles d'une feuille, celles d'un `@media` comprises, à plat. */
const reglesDe = (texte: string) =>
  [...texte.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, tete, corps]) => ({ selecteurs: couper(tete), corps }))
const PARENTHESES = String.raw`\((?:[^()]|\([^()]*\))*\)`

/**
 * La force d'un sélecteur, en un nombre — un identifiant pour 10 000, une
 * classe, un attribut ou une pseudo-classe pour 100, une balise ou un
 * pseudo-élément pour 1 : `:where()` ne compte pas ; `:not()`, `:is()` et
 * `:has()`, leur argument le plus fort.
 */
function force(selecteur: string): number {
  let f = 0
  let reste = selecteur.replace(new RegExp(`:where${PARENTHESES}`, 'g'), ' ').replace(new RegExp(`:(?:not|is|has)(${PARENTHESES})`, 'g'), (_, arg: string) => {
    f += Math.max(...couper(arg.slice(1, -1)).map(force))
    return ' '
  })
  const compter = (motif: RegExp, poids: number) => {
    reste = reste.replace(motif, () => {
      f += poids
      return ' '
    })
  }
  compter(/#[\w-]+/g, 10_000)
  compter(/\[[^\]]*\]/g, 100)
  compter(/::[\w-]+/g, 1)
  compter(/[.:][\w-]+/g, 100)
  compter(/[a-z][\w-]*/gi, 1)
  return f
}

/** Une règle posée par un thème : sous `:root[data-theme='…']`. */
const duTheme = (s: string) => /^:root\[data-theme='[a-z]+'\]/.test(s)

/** Les classes du sujet d'un sélecteur — son dernier composé —, hors de ses parenthèses ; aucune s'il vise un pseudo-élément. */
function sujet(selecteur: string): string[] {
  const dernier = selecteur.split(/\s*[\s>+~]\s*(?![^(]*\))/).pop()!
  if (dernier.includes('::')) return []
  return [...dernier.replace(new RegExp(`:[\\w-]+${PARENTHESES}`, 'g'), '').matchAll(/\.([\w-]+)/g)].map(m => m[1])
}

test('sous tous les thèmes, une feuille, une carte ou un dialogue ouvert garde son sol plein : on ne lit rien au travers', () => {
  // Ce que pose un dialogue.
  assert.match(source('components/Dialog.tsx'), /className="card dialog"/)
  const DIALOGUES = [{ nom: 'un dialogue', classes: ['card', 'dialog'] }]
  const peint = (corps: string) => /(?:^|;)\s*background(?:-color)?\s*:/.test(corps)
  for (const { nom, classes } of DIALOGUES) {
    const vise = (s: string) => sujet(s).length > 0 && sujet(s).every(c => classes.includes(c))
    // Son sol : la règle la plus forte qui le pose plein, d'un `--bg-raised`.
    const sols = reglesDe(css)
      .filter(r => /(?:^|;)\s*background(?:-color)?\s*:[^;]*var\(--bg-raised\)\s*(?:;|$)/.test(r.corps))
      .flatMap(r => r.selecteurs.filter(s => !duTheme(s) && vise(s)))
    assert.ok(sols.length > 0, `le sol d’${nom}`)
    const forceDuSol = Math.max(...sols.map(force))
    // Chaque thème repeint `.card` d'un verre fait pour laisser voir son décor
    // sous une carte de la page — translucide sous vingt-cinq d'entre eux. Plus
    // fort que le sol, il le remplaçait : posé sur la page, le dialogue
    // laissait lire ce qu'il couvrait, et la carte d'un ami, toute la liste des
    // amis. Le sol se reprend plus fort qu'eux, sa couleur seule : leurs
    // dégradés, leur bordure et leur ombre restent, posés sur du plein.
    let repeints = 0
    for (const [ou, feuille] of feuillesDesThemes) {
      for (const r of reglesDe(feuille).filter(r => peint(r.corps))) {
        for (const s of r.selecteurs.filter(s => duTheme(s) && vise(s))) {
          assert.ok(force(s) < forceDuSol, `${ou} : « ${s} » (${force(s)}) repeint le sol d’${nom}, plus fort que lui (${forceDuSol})`)
          repeints++
        }
      }
    }
    assert.ok(repeints >= 30, `le .card de chaque thème est lu (${repeints} règles)`)
  }
  assert.match(css, /\n:root \.card\.dialog:not\(\.carte-fond\) \{ background-color: var\(--bg-raised\); \}/)
  // La carte d'un joueur n'est plus un `.card` (la carte à collectionner, le
  // 20 octobre 2026) : ce sont ses faces qui ont un sol — celui du tableau de
  // bord, quadrillé, sur du plein —, et aucun thème n'y touche ; ce qui se pose
  // sous elle aussi : translucides, sa croix et « Retourner la carte »
  // laissaient lire la page au travers.
  const CARTE = source('components/CarteJoueur.tsx')
  assert.match(CARTE, /className=\{'carte-joueur' \+ \(ligue \? ` cadre-\$\{ligue\}` : ''\)\}/)
  assert.doesNotMatch(CARTE, /className=["'`{][^>]*\bcard\b/, 'ni `.card`, ni `.dialog` : chaque thème les repeint')
  assert.match(regle('.carte-defile'), /background: var\(--bg-raised\);/)
  assert.match(regle('.carte-joueur .carte-defile'), /var\(--bg-raised\);\s*$/, 'le quadrillage, sur du plein')
  for (const s of ['.carte-croix', '.carte-retourner', '.carte-joueur > .carte-gestes']) assert.match(regle(s), /background: var\(--bg-raised\);/, s)
  const DE_LA_CARTE = ['carte-joueur', 'carte-pivot', 'carte-face', 'carte-defile', 'carte-sous', 'carte-croix', 'carte-retourner']
  for (const [ou, feuille] of feuillesDesThemes) {
    for (const r of reglesDe(feuille).filter(r => peint(r.corps))) {
      for (const s of r.selecteurs.filter(duTheme)) assert.ok(!sujet(s).some(c => DE_LA_CARTE.includes(c)), `${ou} : « ${s} » repeint le sol de la carte d’un joueur`)
    }
  }
  // Une feuille pose le sien sur la page même, et aucun thème n'y touche.
  assert.match(regle('.carte-feuille'), /background: var\(--bg\);/)
  for (const [ou, feuille] of feuillesDesThemes) {
    for (const r of reglesDe(feuille).filter(r => peint(r.corps))) {
      for (const s of r.selecteurs.filter(duTheme)) assert.ok(!sujet(s).includes('carte-feuille'), `${ou} : « ${s} » repeint le sol d’une feuille`)
    }
  }
  // Et ces sols sont pleins sous tous les thèmes, Velours et Ivoire compris.
  for (const [ou, feuille] of feuillesDesThemes) {
    const sols = [...feuille.matchAll(/--(bg|bg-raised):\s*([^;]+);/g)]
    assert.ok(sols.length >= 2, `${ou} : ses sols sont lus`)
    for (const [, jeton, valeur] of sols) assert.match(valeur, /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, `${ou} : --${jeton} (${valeur}) se lit au travers`)
  }
})

test('une feuille, une carte ou un dialogue ouvert retire le décor du thème : la mémoire du téléphone va à ce qu’on ouvre', () => {
  // « Le décor reste visible à travers la feuille », sous Le Sommet, au
  // téléphone Android (le propriétaire, le 19 octobre 2026) : les couches
  // fixes du décor — la montagne, ses lanternes, ses drapeaux, le voile de
  // nuit, la neige —, plein écran à la densité du téléphone, prenaient la
  // mémoire des tuiles, et la feuille ouverte par-dessus n'en avait plus :
  // elle ne se dessinait pas, ou à moitié. Le temps qu'elle reste ouverte, le
  // décor se retire — assombri aux trois quarts, couvert presque partout, il
  // ne s'y voyait guère.
  const OUVERTS = ['.carte-voile', '.dialog-backdrop', '.coffre-scene']
  // Les voiles d'une feuille, d'une carte, d'un dialogue, et la scène du coffre de la semaine.
  assert.match(source('components/Pieces.tsx'), /<div className="carte-voile"/)
  assert.match(source('components/Dialog.tsx'), /<div className="dialog-backdrop"/)
  assert.match(source('components/CarteJoueur.tsx'), /<div className="dialog-backdrop"/)
  assert.match(source('components/Coffre.tsx'), /<div className=\{`coffre-scene /)
  // Retiré, quelle que soit la force de la règle du thème qui le pose.
  const sous = `:root[data-theme]:has(${OUVERTS.join(', ')})`
  const retrait = reglesDe(css).find(r => r.selecteurs.some(s => s.startsWith(sous)))
  assert.ok(retrait, `la règle qui retire le décor sous ${OUVERTS.join(', ')}`)
  assert.match(retrait.corps, /^\s*content: none !important;\s*$/)
  const retirees = new Set(
    retrait.selecteurs.map(s => {
      assert.ok(s.startsWith(sous), s)
      return s.slice(sous.length).trim()
    }),
  )
  // Chaque couche fixe d'un thème est de son décor : chacune se retire.
  let couches = 0
  for (const [ou, feuille] of feuillesDesThemes) {
    for (const r of reglesDe(feuille).filter(r => /(?:^|;)\s*position:\s*fixed\b/.test(r.corps))) {
      for (const s of r.selecteurs.filter(duTheme)) {
        const couche = s.replace(/^:root(?:\[[^\]]*\])+/, '').trim()
        assert.ok(retirees.has(couche), `${ou} : « ${s} », une couche fixe de son décor, reste sous une feuille ouverte`)
        couches++
      }
    }
  }
  assert.ok(couches >= 60, `les couches fixes des thèmes sont lues (${couches})`)
})

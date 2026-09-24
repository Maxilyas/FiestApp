// Inventaire de client/src/styles.css : couleurs, tailles, espacements,
// rayons, ombres, z-index, points de rupture, animations, variables.
// Usage, depuis la racine du dépôt :
//   node retours/2026-09-24/experts/scripts/design-systeme/inventaire-css.mjs [--json]
import { readFileSync } from 'node:fs'

const brut = readFileSync('client/src/styles.css', 'utf8')
const css = brut.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))


// Déclarations « propriété: valeur », avec leur ligne et leur contexte
// (sélecteurs et @media englobants), en suivant les accolades.
const decl = []
const pile = []
let tampon = ''
let debut = 0
const ligneDe = (pos) => css.slice(0, pos).split('\n').length
for (let i = 0; i < css.length; i++) {
  const c = css[i]
  if (c === '{') { pile.push(tampon.trim().replace(/\s+/g, ' ')); tampon = ''; debut = i + 1 }
  else if (c === ';' || c === '}') {
    const d = tampon.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/)
    if (d && pile.length && !pile[pile.length - 1].startsWith('@font-face')) decl.push({ ligne: ligneDe(debut + tampon.search(/\S/)), prop: d[1], val: d[2].replace(/\s+/g, ' '), ctx: pile.join(' > ') })
    tampon = ''; debut = i + 1
    if (c === '}') pile.pop()
  } else tampon += c
}

const compte = (arr) => {
  const m = new Map()
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const estJeton = (d) => /^:root/.test(d.ctx) && d.prop.startsWith('--')

// Couleurs
const reCouleur = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black)\b/g
const couleursHorsJetons = []
const couleursJetons = []
for (const d of decl) {
  for (const c of d.val.matchAll(reCouleur)) {
    const v = c[0].replace(/\s+/g, ' ').toLowerCase()
    ;(estJeton(d) ? couleursJetons : couleursHorsJetons).push({ v, ligne: d.ligne, prop: d.prop, ctx: d.ctx })
  }
}

const valeursDe = (re) => decl.filter((d) => re.test(d.prop))
const fontSizes = valeursDe(/^font-size$/)
const fontFam = valeursDe(/^font-family$/)
const fontWeight = valeursDe(/^font-weight$/)
const lineHeight = valeursDe(/^line-height$/)
const letter = valeursDe(/^letter-spacing$/)
const esp = valeursDe(/^(padding|margin|gap|row-gap|column-gap)(-\w+)?$/)
const rayons = valeursDe(/^border(-\w+)?-radius$/)
const ombres = valeursDe(/^(box-shadow|text-shadow|--shadow.*)$/)
const zi = valeursDe(/^z-index$/)
const trans = valeursDe(/^(transition|animation)(-duration)?$/)

const medias = compte([...brut.matchAll(/@media([^{]+)\{/g)].map((m) => m[1].trim()))
const keyframes = [...brut.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
const durees = compte(trans.flatMap((d) => [...d.val.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((m) => (m[2] === 's' ? Math.round(parseFloat(m[1]) * 1000) : +m[1]) + 'ms')))

// Variables : définies / utilisées
const definies = new Map()
for (const d of decl) if (d.prop.startsWith('--')) definies.set(d.prop, (definies.get(d.prop) || []).concat(d.ligne))
const utilisees = compte([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))

// Unités de font-size
const unites = compte(fontSizes.map((d) => (d.val.match(/(px|rem|em|%|vw|vh|vmin|clamp|calc)/) || ['?'])[0]))

// Les espacements en px, atomisés
const pas = compte(esp.flatMap((d) => [...d.val.matchAll(/(-?\d*\.?\d+)(px|rem|em)/g)].map((m) => m[1] + m[2])))

const sortie = {
  lignes: brut.split('\n').length,
  declarations: decl.length,
  couleurs: {
    jetonsDistincts: compte(couleursJetons.map((c) => c.v)).length,
    horsJetonsOccurrences: couleursHorsJetons.length,
    horsJetonsDistinctes: compte(couleursHorsJetons.map((c) => c.v)),
    horsJetonsDetail: couleursHorsJetons.map((c) => `${c.ligne} ${c.prop}: ${c.v}  [${c.ctx.slice(0, 70)}]`),
  },
  typo: {
    fontSizeOccurrences: fontSizes.length,
    fontSizeDistinctes: compte(fontSizes.map((d) => d.val)),
    unites,
    fontFamily: compte(fontFam.map((d) => d.val)),
    fontWeight: compte(fontWeight.map((d) => d.val)),
    lineHeight: compte(lineHeight.map((d) => d.val)),
    letterSpacing: compte(letter.map((d) => d.val)),
  },
  espacements: { occurrences: esp.length, pasDistincts: pas.length, pas },
  rayons: compte(rayons.map((d) => d.val)),
  ombres: compte(ombres.map((d) => d.val)),
  zIndex: zi.map((d) => `${d.val}  L${d.ligne} [${d.ctx.slice(0, 60)}]`),
  medias,
  keyframes: { nombre: keyframes.length, noms: keyframes },
  durees,
  transitions: compte(trans.map((d) => d.val)),
  variables: {
    definies: [...definies.keys()].length,
    jamaisUtilisees: [...definies.keys()].filter((v) => !utilisees.find(([u]) => u === v)),
    utiliseesNonDefinies: utilisees.filter(([u]) => !definies.has(u)),
    usages: utilisees,
  },
}

if (process.argv.includes('--json')) console.log(JSON.stringify(sortie, null, 1))
else {
  const t = (titre, x) => console.log(`\n## ${titre}\n` + (Array.isArray(x) ? x.map((e) => (Array.isArray(e) ? `${e[1]}\t${e[0]}` : e)).join('\n') : JSON.stringify(x, null, 1)))
  console.log(`lignes ${sortie.lignes}, déclarations ${sortie.declarations}`)
  t('couleurs hors jetons (distinctes)', sortie.couleurs.horsJetonsDistinctes)
  console.log('occurrences hors jetons:', sortie.couleurs.horsJetonsOccurrences, ' — jetons distincts:', sortie.couleurs.jetonsDistincts)
  t('font-size', sortie.typo.fontSizeDistinctes)
  t('unités font-size', sortie.typo.unites)
  t('font-family', sortie.typo.fontFamily)
  t('font-weight', sortie.typo.fontWeight)
  t('line-height', sortie.typo.lineHeight)
  t('letter-spacing', sortie.typo.letterSpacing)
  console.log('\nespacements: occurrences', sortie.espacements.occurrences, 'pas distincts', sortie.espacements.pasDistincts)
  t('pas', sortie.espacements.pas)
  t('rayons', sortie.rayons)
  t('ombres', sortie.ombres)
  t('z-index', sortie.zIndex)
  t('@media', sortie.medias)
  t('keyframes (' + sortie.keyframes.nombre + ')', sortie.keyframes.noms)
  t('durées', sortie.durees)
  t('variables jamais utilisées', sortie.variables.jamaisUtilisees)
  t('variables utilisées non définies', sortie.variables.utiliseesNonDefinies)
  t('usages des variables', sortie.variables.usages)
}

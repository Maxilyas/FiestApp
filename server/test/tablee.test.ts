// La tablée — le banc où des agents jouent FiestApp au téléphone (skill
// `tablee`). Celle du Cabinet, le 25 octobre 2026, a faussé deux jeux sur
// trois retours (`retours/2026-10-25/synthese.md`, « Les limites ») : le
// pilote touchait le centre d'un élément — l'épingle tombait au milieu de la
// carte de France, le curseur du Filet ne bougeait que d'un cran à la fois —,
// `ecrire` dans un curseur répondait « Malformed value », et les personnages,
// qui savent tout, finissaient 24 parties sur 47 à 9 sur 9. La régie démarre
// un serveur et un Chromium dès son import : ce qui se lit des arguments d'un
// geste vit à part (`scripts/tablee/gestes.ts`), et le reste se relit dans
// les fichiers — un geste se dit à trois endroits (règle `tablee.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { CATEGORIES } from '../../shared/categories'
import { DES_PAR_GESTE_MAX, lireLeDe, lireLeToucher, pointVise, UN_CURSEUR_NE_SE_TAPE_PAS } from '../scripts/tablee/gestes'

const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8')
const REGIE = lire('server/scripts/tablee/regie.ts')
const PILOTE = lire('server/scripts/tablee/pilote.mjs')
const AIDE = /const AIDE = `([\s\S]*?)`/.exec(PILOTE)?.[1] ?? ''
const SKILL = '.claude/skills/tablee'
const CONSIGNES = lire(`${SKILL}/consignes-cabinet.md`)
const FICHES = readdirSync(new URL(`../../${SKILL}/personas/`, import.meta.url))
  .filter(f => f.startsWith('cabinet-'))
  .map(f => ({ nom: f, texte: lire(`${SKILL}/personas/${f}`) }))

test('toucher --a : où toucher, en pour cent de la boîte de l’élément', () => {
  assert.deepEqual(lireLeToucher(['Ton estimation', '--a', '25%']), { cible: 'Ton estimation', visee: { x: 25, y: 50 } }, 'sans hauteur, au milieu')
  // Sans guillemets, la cible arrive en mots séparés ; « --a » vient après elle.
  assert.deepEqual(lireLeToucher(['La', 'carte', 'de', 'France', '--a', '60%,55%']), { cible: 'La carte de France', visee: { x: 60, y: 55 } })
  assert.deepEqual(lireLeToucher(['e12', '--a', '12.5,0']), { cible: 'e12', visee: { x: 12.5, y: 0 } }, 'le % se sous-entend')
  // « 60%, 55% » tapé avec une espace : deux arguments, la même visée.
  assert.deepEqual(lireLeToucher(['e7', '--a', '60%,', '55%']), { cible: 'e7', visee: { x: 60, y: 55 } })
  assert.deepEqual(lireLeToucher(['Jouer', 'sans', 'compte']), { cible: 'Jouer sans compte', visee: null }, 'sans --a, le centre, comme avant')
  for (const malformes of [['e12', '--a'], ['e12', '--a', '130%'], ['e12', '--a', 'droite'], ['e12', '--a', '30%,55%,2%'], ['--a', '30%']]) {
    const refus = lireLeToucher(malformes)
    assert.equal(typeof refus, 'string', `refusé en mots : ${malformes.join(' ')}`)
  }
  assert.match(String(lireLeToucher(['e12', '--a', '130%'])), /--a 30%/, 'le refus dit comment viser')
})

test('le point visé reste dans l’élément : une visée à 100 % touche son dernier pixel, pas le voisin', () => {
  assert.deepEqual(pointVise({ width: 200, height: 40 }, { x: 25, y: 50 }), { x: 50, y: 20 })
  assert.deepEqual(pointVise({ width: 200, height: 40 }, { x: 100, y: 100 }), { x: 199, y: 39 })
  assert.deepEqual(pointVise({ width: 200, height: 40 }, { x: 0, y: 0 }), { x: 0, y: 0 })
})

test('un curseur ne se tape pas : le refus dit le geste qui le règle', () => {
  assert.match(UN_CURSEUR_NE_SE_TAPE_PAS, /^Un curseur ne se tape pas : touche-le où tu veux, --a 30%/)
  // `ecrire` et `coller` le lisent avant de toucher le champ, et avant `fill('')`, que Playwright refuse sur un curseur.
  for (const geste of ['ecrire', 'coller']) {
    const corps = new RegExp(`case '${geste}': \\{([\\s\\S]*?)\\n    \\}`).exec(REGIE)?.[1] ?? ''
    assert.match(corps, /refuserUnCurseur\(/, `« ${geste} » refuse un curseur`)
    assert.ok(corps.indexOf('refuserUnCurseur(') < corps.search(/toucher\(p, el\)/), `« ${geste} » refuse avant de toucher`)
  }
})

test('le dé : six faces d’office, un seul ; plusieurs d’un coup, à l’annonce, avant que le chrono coure', () => {
  assert.deepEqual(lireLeDe([]), { faces: 6, fois: 1 })
  assert.deepEqual(lireLeDe(['12']), { faces: 12, fois: 1 })
  assert.deepEqual(lireLeDe(['12', '9']), { faces: 12, fois: 9 })
  assert.deepEqual(lireLeDe(['2', String(DES_PAR_GESTE_MAX)]), { faces: 2, fois: DES_PAR_GESTE_MAX })
  // Une partie de l'Éclair, d'un geste : cinq affirmations par manche, trois manches.
  assert.ok(DES_PAR_GESTE_MAX >= 15)
  for (const faux of [['1'], ['0'], ['101'], ['douze'], ['4.5'], ['12', '0'], ['12', String(DES_PAR_GESTE_MAX + 1)], ['12', '3', '4']]) {
    assert.equal(typeof lireLeDe(faux), 'string', `refusé : de ${faux.join(' ')}`)
  }
})

test('un geste se dit à trois endroits : la régie, l’aide du pilote, les consignes', () => {
  // Chaque geste que la régie connaît, l'aide le nomme : un agent ne connaît que l'aide.
  const gestes = [...REGIE.matchAll(/case '([a-z-]+)':|geste === '([a-z-]+)'/g)].map(m => m[1] ?? m[2])
  assert.ok(gestes.length > 30, 'les gestes de la régie se lisent')
  assert.ok(gestes.includes('de'), 'la régie lance le dé')
  const absents = [...new Set(gestes)].filter(g => !new RegExp(`(^|[\\s·(])${g}\\b`, 'm').test(AIDE))
  assert.deepEqual(absents, [], 'des gestes de la régie que l’aide du pilote ne dit pas')
  assert.match(AIDE, /^ {2}de \[faces\]/m, 'l’aide dit le dé')
  assert.match(AIDE, /toucher <ref\|texte> \[--a <x>%\[,<y>%\]\]/, 'l’aide dit --a')
  assert.match(AIDE, /toucher "Ton estimation" --a 30%/)
  // Les consignes du Cabinet : le Filet et l'Épingle au doigt, le curseur au clavier, le dé.
  assert.match(CONSIGNES, /toucher "Ton estimation" --a 30%/)
  assert.match(CONSIGNES, /--a 60%,55%/)
  assert.match(CONSIGNES, /touche Tab/, 'un curseur s’atteint par Tab avant les flèches')
  assert.match(CONSIGNES, /`de 12`/)
})

test('les personnages du Cabinet ignorent des choses, et le dé décide ailleurs', () => {
  assert.equal(FICHES.length, 6, 'les six personnages du Cabinet')
  // La part du calibrage : celle de son joueur « tablée », que la synthèse compare jeu par jeu.
  assert.match(CONSIGNES, /joueur « tablée »/)
  assert.match(CONSIGNES, /calibrage-cabinet\.ts/)
  for (const { nom, texte } of FICHES) {
    const ignore = (/\*\*Ce qu['’](?:il|elle) ignore\*\* : ([^\n]+(?:\n[^\n*]+)*)/.exec(texte)?.[1] ?? '').replace(/\s+/g, ' ')
    assert.ok(ignore, `${nom} : ses domaines d’ignorance`)
    assert.ok(
      CATEGORIES.some(c => ignore.includes(`« ${c} »`)),
      `${nom} : ses domaines se disent dans les mots des catégories (« Sport », « Cinéma & séries »…), ceux que l’écran affiche`,
    )
    assert.match(texte, /le dé/, `${nom} : hors de ses domaines, le dé`)
    assert.doesNotMatch(texte, /(excellente|bonne) culture générale/, `${nom} : une fiche qui promet de tout savoir fait tout savoir`)
  }
})

test('quitter une partie du Cabinet : « Quitter », puis « Quitter la partie »', () => {
  // Deux boutons « Quitter » se confondaient au pilote (la tête de la manche et
  // la confirmation) : celle-ci dit « Quitter la partie » (lot de la page).
  assert.match(CONSIGNES, /« Quitter la partie »/)
  for (const { nom, texte } of FICHES) {
    if (/quitte|« Quitter »/.test(texte)) assert.match(texte, /« Quitter la partie »|« Continuer »/, `${nom} : le bouton qu’on touche à la question`)
  }
})

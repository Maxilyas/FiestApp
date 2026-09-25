// Aucun emoji d'après Unicode 12 : l'écran commun tourne sous Windows 10, qui
// affiche les plus récents en carré vide — devant toute la salle. La règle
// est écrite dans CLAUDE.md ; ce test la garde (81 emojis le 24 septembre
// 2026, tous conformes : c'est le prochain qu'on surveille).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import ts from 'typescript'

// Les points de code d'Emoji 13.0 et au-delà (emoji-data.txt d'Unicode). Le
// moteur d'expressions de Node connaît tous les emojis, mais pas l'année de
// chacun. Le bloc « Symbols and Pictographs Extended-A » (1FA70–1FAFF) ne
// porte que du récent, sauf les quinze points d'Emoji 12 : on le prend
// entier, moins ceux-là — une table point par point oubliait 🪎 (Emoji 17).
const EMOJI_12_DU_BLOC: [number, number][] = [
  [0x1fa70, 0x1fa73], [0x1fa78, 0x1fa7a], [0x1fa80, 0x1fa82], [0x1fa90, 0x1fa95],
]
const RECENTS_HORS_BLOC: [number, number][] = [
  // Emoji 13.0
  [0x1f6d6, 0x1f6d7], [0x1f6fb, 0x1f6fc], [0x1f90c, 0x1f90c], [0x1f972, 0x1f972], [0x1f977, 0x1f978],
  [0x1f9a3, 0x1f9a4], [0x1f9ab, 0x1f9ad], [0x1f9cb, 0x1f9cb], [0x26a7, 0x26a7],
  // Emoji 14.0 et suivants (U+1F6D8, l'éboulement, est d'Emoji 17)
  [0x1f6d8, 0x1f6d8], [0x1f6dc, 0x1f6df], [0x1f7f0, 0x1f7f0], [0x1f979, 0x1f979], [0x1f9cc, 0x1f9cc],
]
function pointRecent(p: number): boolean {
  if (p >= 0x1fa70 && p <= 0x1faff) return !EMOJI_12_DU_BLOC.some(([a, b]) => p >= a && p <= b)
  return RECENTS_HORS_BLOC.some(([a, b]) => p >= a && p <= b)
}

// Des séquences d'Emoji 13.0 à 15.1 faites de points de code anciens : un
// ours et un flocon, séparés par un liant, font un carré vide sous Windows 10.
// Écrites sans variante (FE0F) ni couleur de peau, retirées aussi de l'emoji
// avant de comparer : « 👰🏽‍♀️ » est une 👰‍♀ comme une autre.
const SEQUENCES_RECENTES = [
  // 13.0
  '🐻‍❄', '🐈‍⬛', '🧑‍🎄', '👩‍🍼', '👨‍🍼', '🧑‍🍼', '🏳‍⚧', '👰‍♀', '👰‍♂', '🤵‍♀', '🤵‍♂',
  // 13.1
  '❤‍🔥', '❤‍🩹', '😮‍💨', '😵‍💫', '😶‍🌫', '🧔‍♀', '🧔‍♂',
  // 15.0 et 15.1
  '🐦‍⬛', '🐦‍🔥', '🍋‍🟩', '🍄‍🟫', '⛓‍💥', '🙂‍↔', '🙂‍↕', '🧑‍🧑‍🧒', '🧑‍🧒',
  // 15.1 : toute personne tournée vers la droite (🚶‍➡️, 🏃‍➡️, 🧑‍🦯‍➡️…)
  '‍➡',
]
const VARIANTE = /\u{FE0F}/gu
const PEAU = /[\u{1F3FB}-\u{1F3FF}]/u

/** Un emoji qui s'afficherait en carré vide sous Windows 10. */
function estRecent(e: string): boolean {
  if ([...e].some(c => pointRecent(c.codePointAt(0)!))) return true
  // Les couples à couleurs de peau (💏🏻, 👩🏻‍❤️‍👨🏾) sont d'Emoji 13.1 ; sans
  // couleur, ils sont bien plus anciens.
  if (PEAU.test(e) && /[💏💑❤]/u.test(e)) return true
  const nu = e.replace(VARIANTE, '').replace(new RegExp(PEAU.source, 'gu'), '')
  return SEQUENCES_RECENTES.some(s => nu.includes(s))
}

const EMOJI = /\p{Extended_Pictographic}(?:\u{FE0F}|\p{Emoji_Modifier})*(?:\u{200D}(?:\p{Extended_Pictographic}|\u{27A1})(?:\u{FE0F}|\p{Emoji_Modifier})*)*/gu

/**
 * Ce qu'un fichier peut afficher : ses littéraux, pas ses commentaires — un
 * commentaire ne s'affiche nulle part, et il cite parfois l'emoji qu'on a
 * retiré, pour dire pourquoi. Pour le code, l'analyseur de TypeScript lit
 * les chaînes, les gabarits et le texte du JSX : filtrer par début de ligne
 * prenait « * 🥲 » d'un gabarit pour un commentaire, et « {/* 🫠 *\/} »
 * pour du texte.
 */
function affichable(nom: string, texte: string): { valeur: string; position: number }[] {
  if (/\.(tsx?|mjs)$/.test(nom)) {
    const source = ts.createSourceFile(nom, texte, ts.ScriptTarget.Latest, true, nom.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const morceaux: { valeur: string; position: number }[] = []
    const visiter = (n: ts.Node) => {
      if (
        ts.isStringLiteral(n) ||
        ts.isNoSubstitutionTemplateLiteral(n) ||
        ts.isTemplateHead(n) ||
        ts.isTemplateMiddle(n) ||
        ts.isTemplateTail(n) ||
        ts.isRegularExpressionLiteral(n) ||
        ts.isJsxText(n)
      ) {
        morceaux.push({ valeur: n.getText(source), position: n.getStart(source) })
      }
      ts.forEachChild(n, visiter)
    }
    visiter(source)
    return morceaux
  }
  // Le JSON (les quiz livrés, le manifeste) n'a pas de commentaire ; le CSS,
  // le HTML et le SVG, si — on les efface, sans décaler les positions.
  const blanc = (m: string) => m.replace(/[^\n]/g, ' ')
  const sans = texte.replace(/\/\*[\s\S]*?\*\//g, blanc).replace(/<!--[\s\S]*?-->/g, blanc)
  return [{ valeur: sans, position: 0 }]
}

/** Les emojis récents d'un fichier, chacun avec sa ligne. */
function fautifsDe(nom: string, texte: string): string[] {
  const fautifs: string[] = []
  for (const { valeur, position } of affichable(nom, texte)) {
    for (const m of valeur.matchAll(EMOJI)) {
      if (!estRecent(m[0])) continue
      const ligne = texte.slice(0, position + m.index!).split('\n').length
      const points = [...m[0]].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase())
      fautifs.push(`${m[0]} (${points.join(' ')}) — ${nom}:${ligne}`)
    }
  }
  return fautifs
}

/** Les fichiers d'un dossier du dépôt que la salle peut voir s'afficher. */
function fichiers(dossier: string): { nom: string; texte: string }[] {
  const racine = new URL(`../../${dossier}/`, import.meta.url)
  return (readdirSync(racine, { recursive: true }) as string[])
    .filter(f => /\.(tsx?|css|html|json|webmanifest|svg)$/.test(f))
    .map(f => ({ nom: `${dossier}/${f}`, texte: readFileSync(new URL(f.replace(/\\/g, '/'), racine), 'utf8') }))
}

test('aucun emoji d’après Unicode 12 dans ce que la salle peut voir', () => {
  const fautifs: string[] = []
  const vus = new Set<string>()
  const index = readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8')
  // Le serveur aussi : ses toasts et ses prix s'affichent au mur. Et les quiz
  // livrés (server/content), que chaque nouvel espace reçoit.
  for (const { nom, texte } of [
    ...fichiers('client/src'),
    ...fichiers('client/public'),
    { nom: 'client/index.html', texte: index },
    ...fichiers('shared'),
    ...fichiers('server/src'),
    ...fichiers('server/content'),
  ]) {
    fautifs.push(...fautifsDe(nom, texte))
    for (const { valeur } of affichable(nom, texte)) for (const m of valeur.matchAll(EMOJI)) vus.add(m[0])
  }
  assert.deepEqual(fautifs, [], 'ces emojis s’afficheraient en carré vide sous Windows 10')
  assert.ok(vus.size > 50, `les emojis sont bien trouvés (${vus.size})`)
})

test('la garde reconnaît un emoji récent, où qu’il s’affiche', () => {
  // Qu'elle ne passe pas à vide : 🥲 (Emoji 13.0), 🫠 (14.0), 🪎 (17.0),
  // l'ours polaire, la mariée (13.0), le phénix (15.1), une famille (15.1),
  // un marcheur tourné vers la droite, et une couleur de peau par-dessus.
  for (const e of ['🥲', '🫠', '🪎', '🪊', '🛘', '🐻‍❄️', '👰‍♀️', '👰🏽‍♂️', '🤵‍♀️', '🐦‍🔥', '🍋‍🟩', '🍄‍🟫', '⛓️‍💥', '🙂‍↔️', '🚶‍➡️', '🚶🏿‍➡️', '🧑‍🧑‍🧒', '💏🏻']) {
    assert.ok(estRecent(e), e)
    assert.equal(fautifsDe('x.ts', `export const X = '${e}'`).length, 1, `${e} dans une chaîne`)
  }
  // Aucun faux positif : ZWJ anciens, variantes, drapeaux, chiffres cerclés,
  // couleurs de peau.
  for (const e of ['🦊', '🩰', '🪕', '🩺', '👨‍👩‍👧', '👩‍❤️‍👨', '🏳️‍🌈', '🇫🇷', '①', '👍🏽', '🧑‍🤝‍🧑', '❤️', '🧑‍🦯', '💏']) {
    assert.ok(!estRecent(e), `${e} passe`)
  }

  // Un commentaire ne s'affiche pas, un littéral si — même quand il en a
  // l'air.
  assert.deepEqual(fautifsDe('x.tsx', 'const a = <p>{/* 🫠 retiré */}Bonjour</p>'), [])
  assert.deepEqual(fautifsDe('x.ts', '// 🫠 retiré\n/* 🥲 */ const a = 1'), [])
  assert.equal(fautifsDe('x.ts', 'const a = `\n * 🥲\n`').length, 1, 'une ligne de gabarit qui commence par *')
  assert.equal(fautifsDe('x.ts', 'const a = `\n // 🫠\n`').length, 1, 'une ligne de gabarit qui commence par //')
  assert.equal(fautifsDe('x.ts', "/* … */ export const X = '🥲'").length, 1, 'un littéral derrière un commentaire')
  assert.equal(fautifsDe('x.tsx', 'const a = <p>Bravo 🥳 🫠</p>').length, 1, 'le texte du JSX')
  assert.equal(fautifsDe('x.tsx', 'const a = <p title="🫠" />').length, 1, 'un attribut')
  assert.equal(fautifsDe('q.json', '{"answers": ["🪎"]}').length, 1, 'un quiz livré')
  assert.deepEqual(fautifsDe('x.css', '/* 🫠 */ .a { color: red }'), [])
  assert.equal(fautifsDe('x.css', ".a::before { content: '🫠' }").length, 1, 'un contenu de CSS')
  assert.deepEqual(fautifsDe('x.html', '<!-- 🫠 --><p>ok</p>'), [])
})

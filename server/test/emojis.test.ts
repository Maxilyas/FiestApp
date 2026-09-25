// Aucun emoji d'après Unicode 12 : l'écran commun tourne sous Windows 10, qui
// affiche les plus récents en carré vide — devant toute la salle. La règle
// est écrite dans CLAUDE.md ; ce test la garde (81 emojis le 24 septembre
// 2026, tous conformes : c'est le prochain qu'on surveille).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import ts from 'typescript'
import { EMOJI, emojisRecents, estRecent } from '../../shared/emojis'

// La règle vit dans `shared/emojis.ts` : l'éditeur et la liste collée la
// partagent, pour les quiz qu'écrivent les animateurs.

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

test('ce qu’écrit un animateur : chaque emoji récent une fois, les anciens jamais', () => {
  // Le même contrôle que la garde du dépôt, sur les quiz de l'éditeur et les
  // listes collées : un 🫠 tapé au téléphone s'affichait en carré à la télé.
  assert.deepEqual(emojisRecents('Complète : « Toy … » 🫠', 'Bravo 🥳 🫠', null, undefined, '🦊 et 🥲'), ['🫠', '🥲'])
  assert.deepEqual(emojisRecents('Quel emoji résume le mieux Julie ?', '😂', '😴', '🤪', '👑', '🇫🇷', '👍🏽'), [])
  assert.deepEqual(emojisRecents('Le mariage 👰‍♀️ et le phénix 🐦‍🔥'), ['👰‍♀️', '🐦‍🔥'])
  // `EMOJI` est bien celui que la garde du dépôt utilise.
  assert.equal([...'🫠 et 🦊'.matchAll(EMOJI)].length, 2)
})

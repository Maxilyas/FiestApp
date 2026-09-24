// Inventaire des textes montrés à quelqu'un : textes JSX, attributs lisibles
// (title, aria-label, placeholder, alt), chaînes et gabarits qui ressemblent
// à une phrase, messages de `new Error('…')`. Sortie TSV : fichier:ligne, genre, texte.
// Usage (depuis la racine) : node retours/2026-09-24/experts/scripts/mots/inventaire.mjs > inventaire.tsv
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const racines = process.argv.slice(2).length ? process.argv.slice(2) : ['client/src', 'shared', 'server/src']
const fichiers = []
const parcourir = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? parcourir(p) : /\.tsx?$/.test(n) && fichiers.push(p) } }
racines.forEach(parcourir)

const LISIBLE = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label', 'hint', 'texte', 'message', 'titre', 'aide'])
const phrase = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s) && (/\s/.test(s.trim()) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s.trim())) && !/^[a-z-]+(\s[a-z-]+)*$/.test(s.trim()) && !/^[./@#]|^https?:|^\w+:\w+$|SELECT |INSERT |CREATE |UPDATE |DELETE /.test(s.trim())

for (const f of fichiers) {
  const src = readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const sortir = (n, genre, t) => { t = t.replace(/\s+/g, ' ').trim(); if (t) console.log(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}\t${genre}\t${t}`) }
  const visiter = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
    if (ts.isJsxText(n)) { if (/[A-Za-zÀ-ÿ?!]/.test(n.text)) sortir(n, 'jsx', n.text) }
    else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && LISIBLE.has(n.name.getText())) { sortir(n, 'attr:' + n.name.getText(), n.initializer.text); return }
    else if (ts.isNewExpression(n) && /Error$/.test(n.expression.getText()) && n.arguments?.[0]) { sortir(n, 'erreur', n.arguments[0].getText().replace(/^['`"]|['`"]$/g, '')); return }
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent
      if (ts.isJsxAttribute(p) && p.name.getText() === 'className') return
      if (ts.isElementAccessExpression(p) || ts.isLiteralTypeNode(p) || ts.isPropertyAssignment(p) && p.name === n) return
      if (ts.isCallExpression(p) && /querySelector|getElementById|addEventListener|\.on$|\.emit$|ecouter|fetch|getItem|setItem|require|prepare|exec|\.get$|\.post$|\.use$|log$|warn$|error$/.test(p.expression.getText())) return
      if (phrase(n.text)) sortir(n, 'chaine', n.text)
    } else if (ts.isTemplateExpression(n)) {
      const t = n.getText().slice(1, -1)
      if (phrase(t.replace(/\$\{[^}]*\}/g, 'X'))) sortir(n, 'gabarit', t)
      return
    }
    ts.forEachChild(n, visiter)
  }
  visiter(sf)
}

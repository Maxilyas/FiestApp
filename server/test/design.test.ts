// Le système de design, gardé par des tests : ce qui ne se voit qu'à l'écran,
// mais qui se lit dans le code — une marque d'homonymie qu'on ne coupe pas,
// une règle d'emojis qu'on n'enfreint pas par mégarde.
//
// Les constats viennent de la tablée du 24 septembre 2026
// (`retours/2026-09-24/verification/design.md`) : chacun a été rejoué à
// l'écran avant d'être corrigé ; ici, on garde la cause.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { partsDuNom } from '../../shared/homonymes'

const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')

/** Le corps de la première règle dont le sélecteur est exactement celui-ci. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|\\})\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

// ── E6 · La marque d'homonymie ne se coupe jamais ─────────────────────────

test('le prénom d’une pastille se coupe, sa marque « (2) » jamais', () => {
  // Sur la console, « Camille (2) » devenait « Camil… » : les points de
  // suspension mangeaient la marque, la seule chose qui distingue deux
  // invités identiques (invariant 17).
  assert.deepEqual(partsDuNom({ name: 'Camille', nomAffiche: 'Camille (2)' }), { prenom: 'Camille', marque: ' (2)' })
  assert.deepEqual(partsDuNom({ name: 'Camille' }), { prenom: 'Camille', marque: '' })
  assert.deepEqual(partsDuNom({ name: 'Camille', nomAffiche: 'Camille' }), { prenom: 'Camille', marque: '' })

  // Le prénom porte les points de suspension ; la marque ne rétrécit pas.
  assert.match(regle('.chip-prenom'), /text-overflow:\s*ellipsis/)
  assert.match(regle('.chip-marque'), /flex:\s*none/)
  assert.doesNotMatch(regle('.chip-marque'), /overflow/)
  // Et c'est bien la vue qui les sépare.
  const hote = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  assert.match(hote, /className="chip-marque"/)
})

// ── A1 · Un bouton bascule dit son état, et un seul ───────────────────────

/** Tous les fichiers `.tsx` du client, avec leur texte. */
function sourcesDuClient(): { fichier: string; texte: string }[] {
  const racine = new URL('../../client/src/', import.meta.url)
  return (readdirSync(racine, { recursive: true }) as string[])
    .filter(f => f.endsWith('.tsx'))
    .map(f => ({ fichier: f, texte: readFileSync(new URL(f.replace(/\\/g, '/'), racine), 'utf8') }))
}

/**
 * Les balises ouvrantes `<button …>` d'un source JSX, attributs compris :
 * jusqu'au `>` qui finit sa ligne, et qui n'est pas celui d'une flèche
 * (`onClick={() => …}`).
 */
const boutons = (texte: string) => [...texte.matchAll(/<button\b[\s\S]*?[^=]>(?=[ \t]*$)/gm)].map(m => m[0])

test('chaque bouton en pastille dit s’il est choisi', () => {
  // Le multiplicateur, QCM ou Estimation, les onglets du podium : la couleur
  // disait l'état à l'œil, rien ne le disait à l'oreille (WCAG 4.1.2).
  let vus = 0
  for (const { fichier, texte } of sourcesDuClient()) {
    for (const b of boutons(texte)) {
      if (!/className=\{?['"`(]*pill-btn\b/.test(b)) continue
      vus++
      assert.match(b, /aria-(pressed|current)=/, `${fichier} : ${b.replace(/\s+/g, ' ')}`)
    }
  }
  assert.ok(vus >= 8, `les pastilles sont bien trouvées (${vus})`)
})

test('un bouton bascule garde son nom : l’état ne passe que par aria-pressed', () => {
  // « Couper les sons » avec aria-pressed=true, son allumé : un lecteur
  // d'écran lisait « Couper les sons, activé » — l'inverse de la réalité.
  for (const { fichier, texte } of sourcesDuClient()) {
    for (const b of boutons(texte)) {
      if (!/aria-pressed=/.test(b)) continue
      assert.doesNotMatch(b, /aria-label=\{[^}]*\?/, `${fichier} : un libellé qui change avec l'état — ${b.replace(/\s+/g, ' ')}`)
    }
  }
})

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
import React from 'react'
import { partsDuNom } from '../../shared/homonymes'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

/** Un composant du client, rendu en HTML — la recette d'`accessibilite.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

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

test('une pastille de profil au prénom long, dans une équipe, tient dans sa carte', () => {
  // Une boîte flex compte le prénom entier dans son `min-content` : avec le
  // bouton à `min-width: min-content`, le plancher du prénom n'était jamais
  // atteint. « Rachid (tél. HS) » hors ligne, badge et équipe, finissait sa
  // croix « Exclure » à 352 px pour une pastille qui s'arrête à 304 — la
  // colonne défilait en largeur, en 1366 comme en 1920.
  const bouton = regle('.player-chip .chip-name')
  assert.match(bouton, /display:\s*inline-grid/)
  // La première colonne descend jusqu'au plancher, jamais en dessous ; la
  // marque a la sienne, entière : le `min-content` vaut « plancher + marque ».
  assert.match(bouton, /grid-template-columns:\s*minmax\(var\(--plancher[^)]*\),\s*max-content\)\s+auto/)
  assert.match(regle('.chip-prenom'), /min-width:\s*0/)
  // Le sélecteur d'équipe cède jusqu'à sa flèche : 3 em de plancher
  // laissaient déborder le pire cas (badge, marque, lune, équipe, croix).
  const equipe = /min-width:\s*([\d.]+)em/.exec(regle('.player-chip .chip-team'))
  assert.ok(equipe && Number(equipe[1]) <= 2.2, `le sélecteur garde ${equipe?.[1]} em`)
  // Le plancher est posé sur le bouton, pas en `minWidth` sur le prénom :
  // posé sur le prénom, il ne pèse pas sur la colonne de la grille.
  const hote = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  assert.match(hote, /className="chip-name"\s*style=\{\{ '--plancher': /)
  assert.doesNotMatch(hote, /className="chip-prenom" style=/)
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
  // L'infobulle et le texte lu non plus : un `title` devient la description
  // du bouton (« Fond clair — Fond sombre (Velours), activé »), et « La plus
  // belle, portée, activé » disait l'état deux fois.
  let vus = 0
  for (const { fichier, texte } of sourcesDuClient()) {
    for (const m of texte.matchAll(/<button\b[\s\S]*?[^=]>(?=[ \t]*$)/gm)) {
      const b = m[0]
      if (!/aria-pressed=/.test(b)) continue
      vus++
      const dit = `${fichier} : ${b.replace(/\s+/g, ' ')}`
      assert.doesNotMatch(b, /aria-label=\{[^}]*\?/, `un libellé qui change avec l'état — ${dit}`)
      // Le contenu lu : sans les icônes, les commentaires, ni ce qui est
      // caché à l'oreille.
      const contenu = texte
        .slice(m.index! + b.length, texte.indexOf('</button>', m.index!))
        .replace(/<Icon\b[^>]*\/>/g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/<(\w+)\b[^>]*aria-hidden[^>]*>[\s\S]*?<\/\1>/g, '')
      // Une infobulle ou un texte tirés de la condition d'`aria-pressed`,
      // ou de son contraire, redisent l'état. (Une infobulle propre à chaque
      // bouton d'un groupe, elle, ne change pas quand on le presse.)
      const etat = /aria-pressed=\{!?([^}]*)\}/.exec(b)?.[1].trim()
      if (!etat) continue
      const echappe = etat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const redit = new RegExp(`[{(]\\s*!?${echappe}\\s*\\?\\s*['"\`]`)
      assert.doesNotMatch(/title=(\{[^}]*\})/.exec(b)?.[1] ?? '', redit, `une infobulle qui change avec l'état — ${dit}`)
      assert.doesNotMatch(contenu, redit, `un texte lu qui redit l'état — ${dit}`)
    }
  }
  assert.ok(vus >= 10, `les bascules sont bien trouvées (${vus})`)
})

// ── Les jetons des deux thèmes : focus, survol, contrôles natifs ─────────

/** Les variables d'un bloc de thème, telles qu'écrites. */
function jetons(ouverture: string): Map<string, string> {
  const debut = CSS.indexOf(ouverture)
  assert.ok(debut >= 0, `le bloc ${ouverture} existe`)
  const corps = CSS.slice(debut, CSS.indexOf('\n}', debut))
  return new Map([...corps.matchAll(/^\s*(--[\w-]+|color-scheme):\s*([^;]+);/gm)].map(m => [m[1], m[2].trim()]))
}
const VELOURS = jetons(':root {')
const IVOIRE = new Map([...VELOURS, ...jetons(":root[data-theme='ivoire'] {")])

/** La couleur d'un jeton, `var(--autre)` suivi jusqu'à un #rrggbb. */
function teinte(theme: Map<string, string>, nom: string): string {
  let valeur = theme.get(nom)
  for (let i = 0; valeur && i < 5; i++) {
    const renvoi = /^var\((--[\w-]+)\)$/.exec(valeur)
    if (!renvoi) break
    valeur = theme.get(renvoi[1])
  }
  assert.match(valeur ?? '', /^#[0-9a-f]{6}$/i, `${nom} se résout en une couleur`)
  return valeur!
}

/** Le contraste WCAG entre deux couleurs. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, v] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * v
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

test('A2 · un seul anneau de focus, qui se voit sur les deux thèmes', () => {
  // Neuf sélecteurs recopiaient l'anneau, six composants gardaient celui du
  // navigateur, et un champ n'avait qu'un filet d'un pixel.
  const anneaux = [...CSS.matchAll(/outline:\s*2px solid/g)]
  assert.equal(anneaux.length, 1, 'l’anneau est écrit une fois')
  assert.match(CSS, /:where\([^)]*\)+:focus-visible \{\s*outline: 2px solid var\(--focus\)/)
  assert.doesNotMatch(regle('.input:focus'), /outline:\s*none/, 'un champ garde l’anneau')
  // Un indicateur de focus se détache de son fond à 3:1 au moins (WCAG 1.4.11).
  for (const [nom, theme] of [['Velours', VELOURS], ['Ivoire', IVOIRE]] as const) {
    for (const fond of ['--bg', '--bg-raised']) {
      const c = contraste(teinte(theme, '--focus'), teinte(theme, fond))
      assert.ok(c >= 3, `${nom} : le focus sur ${fond} tient ${c.toFixed(2)}:1`)
    }
  }
})

test('S3 · le survol d’un texte reste lisible, en Ivoire aussi', () => {
  // `--accent-hover` est un aplat : écrit sur la crème, il tombait à 2,49:1.
  assert.doesNotMatch(CSS, /[^-]color:\s*var\(--accent-hover\)/, 'aucun texte n’est écrit en --accent-hover')
  for (const [nom, theme] of [['Velours', VELOURS], ['Ivoire', IVOIRE]] as const) {
    const c = contraste(teinte(theme, '--accent-text-hover'), teinte(theme, '--bg'))
    assert.ok(c >= 4.5, `${nom} : le survol tient ${c.toFixed(2)}:1`)
  }
})

test('S2 · les contrôles natifs suivent le thème', () => {
  // Sans `color-scheme`, les listes d'équipe s'ouvraient en blanc sur le Velours.
  assert.equal(VELOURS.get('color-scheme'), 'dark')
  assert.equal(IVOIRE.get('color-scheme'), 'light')
})

// ── Au texte agrandi ──────────────────────────────────────────────────────

test('T1 · au souvenir, le détail d’une équipe a sa propre case, pas la colonne du nom', async () => {
  // Enfant du nom, le détail n'avait que sa colonne : 14 px de large au texte
  // agrandi, et « 5 / me / · / 188 / pts » tombait une lettre par ligne.
  const equipe = { id: 'r', name: 'Les Randonneurs', emoji: '🥾', position: 0, memberCount: 5, total: 1014, average: 203, bonus: 0, gamePoints: 2, finalPoints: 2 }
  for (const compact of [false, true]) {
    const html = await rendu('components/TeamBoard', 'TeamBoard', { teams: [equipe], compact })
    assert.match(html, /<span class="lb-name">Les Randonneurs<\/span><span class="team-sub">/)
  }
  // Étroite, la ligne passe sur trois étages ; le seuil suit la taille du texte.
  assert.match(CSS, /\.team-board \{ container-type: inline-size; \}/)
  assert.match(CSS, /@container \(max-width: [\d.]+rem\) \{\s*\.lb-row\.team-row \{[^}]*grid-template-areas:\s*'rang av nom'\s*'rang av sub'\s*'pts pts pts'/)
  // Les points ont toute la largeur de leur étage : dans la seule colonne
  // des chiffres, « 420 » devenait « 42 » à 240 px de large.
  assert.match(CSS, /@container \(max-width: [\d.]+rem\) \{[^@]*\.team-row > \.team-points \{ justify-self: end; \}/)
})

test('T2 · les avatars de l’entrée ne descendent jamais sous la largeur d’un doigt', () => {
  // Six colonnes forcées faisaient 36 px à 277 de large pour des boutons de
  // 44 : ils se chevauchaient, et toucher le koala choisissait le lion.
  assert.match(regle('.emoji-grid'), /grid-template-columns:\s*repeat\(auto-fill, minmax\(44px, 1fr\)\)/)
})

// ── S7 · Aucune classe morte ──────────────────────────────────────────────

test('S7 · chaque classe de la feuille de style est nommée quelque part', () => {
  // Une règle morte trompe qui cherche une cause : un expert a pris
  // `.player-chip .player-name`, que plus rien ne portait, pour celle de la
  // coupure des prénoms. Le repérage est celui de `css-mort.mjs` (la tablée
  // du 24 septembre) : un nom en entier, ou un préfixe construit.
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const classes = new Set<string>()
  for (const [, sel] of css.matchAll(/([^{}]+)\{/g)) {
    if (sel.trim().startsWith('@')) continue
    for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(m[1])
  }
  const lire = (dossier: URL): string[] =>
    (readdirSync(dossier, { recursive: true }) as string[])
      .filter(f => /\.(tsx?|html)$/.test(f))
      .map(f => readFileSync(new URL(f.replace(/\\/g, '/'), dossier), 'utf8'))
  const source = [
    ...lire(new URL('../../client/src/', import.meta.url)),
    ...lire(new URL('../../shared/', import.meta.url)),
    readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8'),
  ].join('\n')
  // `av-${finition}`, `'status-' + a.status` : des noms assemblés.
  const prefixes = [...source.matchAll(/[`'" ]([a-z][\w-]*-)(?:\$\{|['"`] *\+)/g)].map(m => m[1])
  const nommee = (c: string) =>
    new RegExp(`(^|[^\\w-])${c.replace(/-/g, '\\-')}($|[^\\w-])`).test(source) || prefixes.some(p => c.startsWith(p))
  const mortes = [...classes].filter(c => !nommee(c)).sort()
  assert.deepEqual(mortes, [], 'des classes sans personne pour les porter')
  assert.ok(classes.size > 400, `la feuille est bien lue (${classes.size} classes)`)
})

test('S6 · les métaux des paliers se lisent sur les deux thèmes', () => {
  // Écrits en dur, bronze et argent ne suivaient pas le thème : l'argent
  // tombait à 1,64:1 sur la crème des fiches imprimées du bilan.
  assert.match(regle('.palier-1'), /var\(--bronze-text\)/)
  assert.match(regle('.palier-2'), /var\(--argent-text\)/)
  for (const [nom, theme] of [['Velours', VELOURS], ['Ivoire', IVOIRE]] as const) {
    for (const metal of ['--bronze-text', '--argent-text']) {
      const c = contraste(teinte(theme, metal), teinte(theme, '--bg'))
      assert.ok(c >= 4.5, `${nom} : ${metal} tient ${c.toFixed(2)}:1`)
    }
  }
})

// ── A4 · Des noms qui manquaient ──────────────────────────────────────────

test('A4 · chaque QR code a un nom, et la page un repère principal', () => {
  // `qrcode.react` pose role="img" : sans titre, un lecteur d'écran
  // annonçait « image » six fois, sans dire où elle menait.
  for (const { fichier, texte } of sourcesDuClient()) {
    for (const [balise] of texte.matchAll(/<QRCodeSVG\b[^>]*\/>/g)) {
      assert.match(balise, /title="QR code [^"]+"/, `${fichier} : ${balise}`)
    }
  }
})

test('A4 · le repère principal entoure le contenu, sans effacer l’en-tête ni la console', () => {
  // Posé sur `#root`, il enveloppait toute la page : la console de l'écran
  // commun perdait « banner » et « contentinfo », l'éditeur et le compte
  // leur « banner », et « aller au contenu » tombait sur le titre.
  const index = readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8')
  assert.match(index, /<div id="root"><\/div>/)

  // À la console : le bandeau, puis la scène en `<main>`, puis la console,
  // l'un après l'autre et jamais l'un dans l'autre.
  const hote = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  const bandeau = hote.indexOf('</header>', hote.indexOf('<header className="host-band">'))
  const scene = hote.indexOf("<main className={'host-grid'")
  const finScene = hote.indexOf('</main>', scene)
  const console_ = hote.indexOf('<footer className="host-console">')
  assert.ok(bandeau > 0 && bandeau < scene && scene < finScene && finScene < console_, 'bandeau, scène, console')

  // Une page pose son repère, ou `main.tsx` l'enveloppe — jamais les deux :
  // un `<main>` dans un autre ne se lit plus comme repère.
  const racine = readFileSync(new URL('../../client/src/main.tsx', import.meta.url), 'utf8')
  const propres = /REPERE_PROPRE = new Set<unknown>\(\[([^\]]*)\]\)/.exec(racine)
  assert.ok(propres, 'la liste des pages qui posent leur repère')
  const listees = new Set(propres[1].split(',').map(n => n.trim()))
  for (const { fichier, texte } of sourcesDuClient()) {
    const vue = /^views[\\/](\w+)\.tsx$/.exec(fichier)?.[1]
    const pose = /<main\b/.test(texte)
    if (vue) assert.equal(pose, listees.has(vue), `${vue} : ${pose ? 'pose' : 'ne pose pas'} de <main>`)
    // Hors des pages, seuls l'enveloppe et le message d'erreur des pages
    // publiques en posent un : l'entrée, les formulaires, la fin de soirée
    // vivent dans l'enveloppe.
    else if (pose) assert.ok(['components/SpaceNav.tsx', 'main.tsx'].includes(fichier.replace(/\\/g, '/')), fichier)
  }

  // Une page en flux : l'en-tête et la navigation d'abord, puis le repère.
  for (const vue of ['RecapApp', 'BilanApp', 'ArchivesApp', 'AccountApp', 'AdminApp', 'EditorApp']) {
    const texte = readFileSync(new URL(`../../client/src/views/${vue}.tsx`, import.meta.url), 'utf8')
    const repere = texte.indexOf('<main className="page-corps">')
    const tete = Math.min(...[texte.indexOf('<BilanHead'), texte.indexOf('</header>')].filter(i => i > 0))
    assert.ok(repere > tete && tete > 0, `${vue} : le repère suit l'en-tête`)
    const nav = texte.indexOf('<SpaceNav')
    if (nav > 0) assert.ok(nav < repere, `${vue} : la navigation précède le repère`)
  }
  // Le message d'erreur d'une page publique : la navigation, puis le repère.
  const nav = readFileSync(new URL('../../client/src/components/SpaceNav.tsx', import.meta.url), 'utf8')
  assert.match(nav, /<SpaceNav current=\{current\} \/>\s*<main className="page-corps">\s*<p className="error center">/)
})

test('A4 · dans l’éditeur, un bouton répété dit ce qu’il vise', () => {
  // Dix « Supprimer » à la suite, au lecteur d'écran, ne disaient pas quel
  // quiz ni quelle question partirait.
  const source = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  let vus = 0
  for (const m of source.matchAll(/<button\b[\s\S]*?[^=]>(?=[ \t]*$)/gm)) {
    const fin = source.indexOf('</button>', m.index! + m[0].length)
    const texte = source.slice(m.index! + m[0].length, fin).replace(/<[^>]*>/g, '').trim()
    if (!['Supprimer', 'Modifier', 'Dupliquer', 'Aperçu'].includes(texte)) continue
    vus++
    // Et le nom commence par le mot affiché : c'est lui qu'une commande vocale dit.
    assert.match(m[0], new RegExp(`aria-label=\\{\`${texte} `), `${texte} : ${m[0].replace(/\s+/g, ' ')}`)
  }
  assert.ok(vus >= 5, `les boutons sont bien trouvés (${vus})`)
})

test('T7 · une ligne de classement qu’on touche a la hauteur d’un doigt', () => {
  assert.match(regle('.lb-row.lb-ouvrable'), /min-height:\s*44px/)
})

test('T12 · le mot de passe s’affiche, sous un bouton au nom fixe', async () => {
  const html = await rendu('components/MotDePasse', 'MotDePasse', { id: 'x', value: 'secret', onChange: () => {} })
  assert.match(html, /type="password"/)
  assert.match(html, /aria-label="Afficher le mot de passe" aria-pressed="false" title="Afficher le mot de passe"/)
  // Les trois champs du téléphone le prennent : la connexion, la création, le profil.
  const entree = readFileSync(new URL('../../client/src/components/Entree.tsx', import.meta.url), 'utf8')
  const profil = readFileSync(new URL('../../client/src/components/ProfilForm.tsx', import.meta.url), 'utf8')
  assert.equal([...entree.matchAll(/<MotDePasse\b/g)].length, 2)
  assert.equal([...profil.matchAll(/<MotDePasse\b/g)].length, 1)
  // Et la récupération par le code de secours : un mot de passe neuf, tapé
  // une fois, sans champ pour le confirmer — là où l'œil sert le plus.
  const secours = readFileSync(new URL('../../client/src/components/Secours.tsx', import.meta.url), 'utf8')
  assert.equal([...secours.matchAll(/<MotDePasse\b/g)].length, 1)
  assert.doesNotMatch(entree + profil + secours, /type="password"/)
  // Toucher l'œil laisse le focus dans le champ : passé au bouton, il
  // fermait le clavier du téléphone au milieu de la saisie.
  const oeil = readFileSync(new URL('../../client/src/components/MotDePasse.tsx', import.meta.url), 'utf8')
  assert.match(oeil, /onMouseDown=\{e => e\.preventDefault\(\)\}/)
  // « e- / mail » : le code de secours, affiché à la création du profil au
  // téléphone, coupait le mot en bout de ligne ; un gluon le tient entier.
  // Chaque texte qui l'écrit, hors commentaires, le porte.
  for (const fichier of ['Secours', 'Entree', 'ProfilForm']) {
    const texte = readFileSync(new URL(`../../client/src/components/${fichier}.tsx`, import.meta.url), 'utf8')
    for (const ligne of texte.split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(ligne) || !/adresse e-/.test(ligne)) continue
      assert.match(ligne, /e-\{\/\*[^*]*\*\/ '\\u2060'\}mail/, `${fichier} : ${ligne.trim()}`)
    }
  }
})

test('T6 · un mot trop long pour sa case se coupe à la syllabe, pas n’importe où', () => {
  assert.match(regle('.ans-text'), /hyphens:\s*auto/)
  assert.doesNotMatch(regle('.ans-text'), /overflow-wrap:\s*anywhere/)
  // La césure suit la langue de la page.
  assert.match(readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8'), /<html lang="fr">/)
})

test('A4 · chaque page d’animateur a son nom d’onglet', async () => {
  // `/connexion`, `/activer`, `/compte`, `/edit` et `/admin` s'appelaient
  // toutes « FiestApp » : ni la liste des onglets ni le lecteur d'écran qui
  // annonce la page ne les distinguaient.
  const { titreDePage } = (await import(new URL('../../client/src/titres.ts', import.meta.url).href)) as {
    titreDePage: (page: string) => string
  }
  const pages = ['connexion', 'activer', 'compte', 'edit', 'admin', 'host', 'profil']
  const titres = pages.map(p => titreDePage(p))
  assert.equal(new Set(titres).size, pages.length, titres.join(' / '))
  for (const t of titres) assert.notEqual(t, 'FiestApp')
  assert.equal(titreDePage('edit'), 'Mes quiz · FiestApp')
  // Et la page le pose dès son premier rendu.
  const racine = readFileSync(new URL('../../client/src/main.tsx', import.meta.url), 'utf8')
  assert.match(racine, /if \(route\.kind === 'account'\) document\.title = titreDePage\(route\.page\)/)
})

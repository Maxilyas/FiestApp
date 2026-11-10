// Le carrefour du profil : « Mon profil » tenu sur un écran, sans défiler.
//
// « J'aimerais que tu passes en revue tous les écrans de l'application et que
// tu modifies ceux que tu trouves trop longs / ou ça serait logique de tout
// voir sans scroller » (le propriétaire, le 10 novembre 2026, au lendemain de
// l'accueil en lignes). `/profil` est un carrefour — soi en tête, puis cinq
// gros boutons, six avec un compagnon — et ne tenait pas : empilés, chacun
// sur deux ou trois lignes de texte, ils faisaient 630 px en 360 × 640, la
// page 829 pour 575 visibles au-dessus du menu, et « Mes soirées » comme « Ma
// carrière » restaient dessous. Comme à l'accueil, sans rien changer au style,
// ni un nom, ni un geste, ni leur ordre : les mêmes gros boutons, en lignes
// dans une carte, une ligne de texte sous chaque titre, la page qui prend
// l'écran au-dessus du menu.
//
// Ce que ces épreuves ne voient pas — ce qui passe sous le menu, taille par
// taille — se mesure au navigateur : `server/scripts/rendu-carrefour.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global, et la page lit son adresse et ses balises en se chargeant.
const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false, querySelector: () => null },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
  history: { state: null },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const source = (f: string) => readFileSync(client(f), 'utf8')
const feuille = () => source('styles.css')
/** Les espaces insécables rendues ordinaires : ce que l'épreuve compare, ce sont les mots. */
const lisible = (s: string) => s.replace(/[  ]/g, ' ')
/** La phrase entière d'une ligne, telle qu'un lecteur d'écran la lit : l'essentiel, puis ses suites. */
const phrase = (l: { detail: string; suite?: readonly string[] }) => lisible(l.detail + (l.suite ?? []).join(''))

/** La page du carrefour, dans sa source : de son titre à la fin de la page. */
function laPage(): string {
  const app = source('views/ProfilApp.tsx')
  const debut = app.indexOf("// ── Le profil : qui l'on est, puis ses gros boutons ──")
  const fin = app.indexOf('/**\n * La page avant son profil')
  assert.ok(debut > 0 && fin > debut, 'la page du profil se lit dans sa source')
  return app.slice(debut, fin)
}

/** Sa carte, de son ouverture au glossaire, sans ses commentaires. */
function laCarte(): string {
  const page = laPage()
  const debut = page.indexOf('<div className="profil-boutons jouer-carte">')
  assert.ok(debut > 0, 'ses boutons tiennent dans une carte, celle des sections de l’accueil')
  return page.slice(debut, page.indexOf('<Glossaire')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

/**
 * Les gros boutons d'un morceau de page, chacun de `<GrosBouton` à sa fermeture — celle de son rang, pas celle d'une
 * icône qu'il porte (`icone={<Icon … />}`) —, et ce qui reste entre eux.
 */
function grosBoutons(jsx: string): { boutons: string[]; reste: string } {
  const boutons: string[] = []
  let reste = ''
  let i = 0
  for (;;) {
    const debut = jsx.indexOf('<GrosBouton', i)
    if (debut < 0) break
    reste += jsx.slice(i, debut)
    let profondeur = 0
    let fin = debut
    for (; fin < jsx.length; fin++) {
      if (jsx[fin] === '{') profondeur++
      else if (jsx[fin] === '}') profondeur--
      else if (profondeur === 0 && jsx.startsWith('/>', fin)) break
    }
    boutons.push(jsx.slice(debut, fin + 2))
    i = fin + 2
  }
  return { boutons, reste: reste + jsx.slice(i) }
}

test('le carrefour range ses boutons en lignes, dans une carte : les mêmes boutons, les mêmes gestes, dans le même ordre', () => {
  const page = laPage()
  // Son cadre à lui, que la feuille règle sans toucher à l'accueil ni à la boutique, qui partagent la page et ses pièces ;
  // et le compte de ses lignes, qui borne ce qu'elles se partagent : cinq, six avec un compagnon.
  assert.match(page, /const lignes = nicheIci \? 6 : 5\n/)
  assert.match(page, /<div className="player-shell profil-carrefour" style=\{\{ '--carrefour-lignes': lignes \} as CSSProperties\} onClick=\{suivreUnLien\}>\s*<h1 className="sr-only">Mon profil<\/h1>/)
  // Les autres pages de ce fichier — l'accueil, la boutique, la loge, un écran du profil — ne le portent pas.
  assert.equal(source('views/ProfilApp.tsx').match(/className="[^"]*profil-carrefour/g)?.length, 1)

  // Dans la carte, rien que ses lignes : ni titre, ni groupe, ni bouton d'une autre sorte — et seul « Mon compagnon »
  // dépend de quelque chose, sa niche.
  const { boutons, reste } = grosBoutons(laCarte())
  assert.equal(boutons.length, 6)
  assert.equal(reste.replace(/\s+/g, ''), '<divclassName="profil-boutonsjouer-carte">{nicheIci&&()}</div>')
  // Les mêmes noms, les mêmes icônes, les mêmes gestes, dans l'ordre d'avant : les rendus et la tablée les touchent par leur nom.
  const ceQuIlOuvre = (b: string) => {
    const titre = /titre=(?:"([^"]+)"|\{(\w+)\})/.exec(b)
    const geste = /onClick=\{\(\) => ouvrir\(((?:pieceNeuve \?\? )?'\w+')\)\}|href="([^"]+)"/.exec(b)
    return `${titre?.[1] ?? titre?.[2]} → ${geste?.[1] ?? geste?.[2]}`
  }
  assert.deepEqual(boutons.map(ceQuIlOuvre), [
    "M’habiller → pieceNeuve ?? 'avatar'",
    "Mon compagnon → 'compagnon'",
    "Ma collection → 'collection'",
    'TITRE_DES_COLLECTIONNEURS → /collectionneurs',
    "Mes soirées → 'soirees'",
    "Ma carrière → 'carriere'",
  ])
  const icone = (b: string) =>
    /icone=\{(?:<Icon name="([\w-]+)" \/>|codeDeLaNiche \? <codeDeLaNiche\.(NicheEnMiniature) niche=\{nicheIci\} taille=\{36\} \/> : <Icon name="home" \/>)\}/.exec(b)?.slice(1).find(Boolean)
  assert.deepEqual(boutons.map(icone), ['hanger', 'NicheEnMiniature', 'award', 'trophy', 'book', 'bar-chart'])
  // Ce que chaque ligne garde : le compteur rouge de « M'habiller », la jauge et le compte de « Mon compagnon » et de « Ma
  // collection », « Nouveau » sur le classement des collections.
  assert.match(boutons[0], /compteur=\{plus && plus\.nouveautes\.nouveautes > 0 \? \{ n: plus\.nouveautes\.nouveautes, label: nouveautesAPorter\(plus\.nouveautes\.nouveautes\) \} : undefined\}/)
  assert.match(boutons[1], /jauge=\{sonBouton\?\.jauge \?\? 0\}\s*compte=\{sonBouton\?\.compte\}/)
  assert.match(boutons[2], /jauge=\{plus \? plus\.collection\.acquis \/ Math\.max\(1, plus\.collection\.total\) : 0\}\s*compte=\{plus && `\$\{formatNumber\(plus\.collection\.acquis\)\} sur \$\{formatNumber\(plus\.collection\.total\)\}`\}/)
  assert.match(boutons[3], /pastille=\{nouvelle\('collectionneurs'\)\}/)
  for (const b of [boutons[0], boutons[3], boutons[4], boutons[5]]) assert.doesNotMatch(b, /jauge=/, 'une jauge là seulement où quelque chose se remplit')

  // Autour de la carte, la page d'avant : soi en tête — l'œil au bout —, son laurier d'hier, puis le glossaire et le menu.
  assert.match(page, /<IdentiteLigne profil=\{profil\} onCarte=\{\(\) => setCarteOuverte\(true\)\} \/>/)
  const [soi, laurier, carte] = ['<IdentiteLigne', '<p className="carte-laurier">', '<div className="profil-boutons jouer-carte">'].map(x => page.indexOf(x))
  assert.ok(soi > 0 && soi < laurier && laurier < carte, 'soi, son laurier, puis la carte')
  assert.match(page, /<\/div>\s*<Glossaire\s+mots=\{\[[^\]]+\]\}\s*\/>\s*\{erreur && <p className="error">\{erreur\}<\/p>\}[\s\S]*?\{menu\('profil'\)\}\s*<\/div>/)
})

test('la ligne de chaque bouton : l’essentiel en peu de mots, la suite à ses jointures — la même phrase à l’oreille', async () => {
  const carte = laCarte()
  // Écrites dans la page : la phrase d'avant, coupée là où elle peut s'arrêter.
  assert.match(carte, /titre="M’habiller"\s*detail="Avatar, titre, vitrine"\s*suite=\{\[', fond', ', thème', ', gerbe'\]\}/)
  assert.match(carte, /detail="Avatars, thèmes, trophées"\s*suite=\{\[' — et où gagner le reste'\]\}/)
  assert.match(carte, /detail=\{profil\.soirees\.length === 0 \? 'Aucune encore' : `\$\{profil\.soirees\.length\} soirée\$\{profil\.soirees\.length > 1 \? 's' : ''\}`\}\s*suite=\{profil\.soirees\.length === 0 \? undefined : \[', jouées ou animées'\]\}/)
  assert.match(carte, /detail=\{precision !== null \? `Précision \$\{precision\} %` : 'Tes chiffres'\}\s*suite=\{\[precision !== null \? ' · tes courbes' : ', tes courbes'\]\}/)
  assert.match(carte, /detail=\{sonBouton\?\.detail \?\? 'Sa niche, son nom, ses ornements'\}\s*suite=\{sonBouton\?\.suite\}/)
  assert.match(carte, /titre=\{TITRE_DES_COLLECTIONNEURS\} \{\.\.\.ligneDesCollectionneurs\(profil\.collectionneur\)\} pastille=/)

  // Le classement des collections : sa place, puis ses carats — les deux se lisent sur un téléphone. La phrase d'avant,
  // « 4ᵉ sur 87 · ta collection vaut 579 carats », y passait sur deux ou trois lignes.
  const { ligneDesCollectionneurs } = await import(client('views/ProfilApp.tsx').href)
  const ligne = (l: { detail: string; suite?: readonly string[] }) => [lisible(l.detail), ...(l.suite ?? []).map(lisible)]
  assert.deepEqual(ligne(ligneDesCollectionneurs(undefined)), ['Ta place', ', et ce que vaut ta collection'])
  assert.deepEqual(ligne(ligneDesCollectionneurs({ rang: 4, classes: 87, carats: 579 })), ['4ᵉ sur 87', ' · 579 carats'])
  assert.deepEqual(ligne(ligneDesCollectionneurs({ rang: 1, classes: 1, carats: 1 })), ['1ʳᵉ sur 1', ' · 1 carat'])
  assert.deepEqual(ligne(ligneDesCollectionneurs({ rang: 128, classes: 1024, carats: 12480 })), ['128ᵉ sur 1024', ' · 12 480 carats'])
  // Sans place — rien de ce qu'on classe, ou masqué : ce que vaut sa collection, la phrase d'avant.
  assert.deepEqual(ligne(ligneDesCollectionneurs({ classes: 87, carats: 579 })), ['Ta collection vaut 579 carats'])
  // Un nombre ne quitte pas son mot : « sur 87 », « 579 carats ».
  assert.equal(ligneDesCollectionneurs({ rang: 4, classes: 87, carats: 579 }).detail, '4ᵉ sur 87')
  assert.deepEqual(ligneDesCollectionneurs({ rang: 4, classes: 87, carats: 579 }).suite, [' · 579 carats'])

  // « Mon compagnon » : son nom, puis sa forme là où la ligne a la place ; sans nom, sa forme seule.
  const { ceQueDitSonBouton } = await import(client('components/Niche.tsx').href)
  assert.deepEqual(ceQueDitSonBouton({ compagnon: 'loup', rang: 2, nom: 'Croc' }, 350), { detail: 'Croc', suite: [', le loup adulte'], jauge: 0.7, compte: '350 sur 500' })
  assert.deepEqual(ceQueDitSonBouton({ compagnon: 'loup', rang: 2 }, 350), { detail: 'Le loup adulte', jauge: 0.7, compte: '350 sur 500' })
  assert.deepEqual(ceQueDitSonBouton({ compagnon: 'loup', rang: 2, nom: 'Croc' }, undefined), { detail: 'Croc', suite: [', le loup adulte'], jauge: 0 })

  // La phrase reste une phrase, pour qui l'écoute : l'essentiel et ses suites se lisent d'un trait.
  assert.equal(phrase(ligneDesCollectionneurs(undefined)), 'Ta place, et ce que vaut ta collection')
  assert.equal(phrase(ligneDesCollectionneurs({ rang: 4, classes: 87, carats: 579 })), '4ᵉ sur 87 · 579 carats')
  assert.equal(phrase(ceQueDitSonBouton({ compagnon: 'luciole', rang: 3, nom: 'Capitaine Flocon' }, 350)), 'Capitaine Flocon, la luciole-constellation')
  assert.equal(phrase({ detail: 'Avatar, titre, vitrine', suite: [', fond', ', thème', ', gerbe'] }), 'Avatar, titre, vitrine, fond, thème, gerbe')

  // L'essentiel tient sur la ligne en 360 de large : une trentaine de caractères, comme à l'accueil — au-delà, il serait
  // coupé au bout sur le petit téléphone. Mesuré au navigateur (`rendu-carrefour.ts`) ; ici, la borne qui retient une
  // phrase de trop.
  const essentiels = [
    'Avatar, titre, vitrine',
    'Sa niche, son nom, ses ornements',
    'Avatars, thèmes, trophées',
    'Aucune encore',
    '1024 soirées',
    'Précision 100 %',
    'Tes chiffres',
    ligneDesCollectionneurs(undefined).detail,
    ligneDesCollectionneurs({ rang: 1024, classes: 2048, carats: 124800 }).detail,
    ligneDesCollectionneurs({ classes: 2048, carats: 124800 }).detail,
    // Un nom de seize lettres, le plus long qu'un compagnon porte ; sans nom, sa forme au nom le plus long.
    ceQueDitSonBouton({ compagnon: 'loup', rang: 3, nom: 'Capitaine Flocon' }, 350).detail,
    ceQueDitSonBouton({ compagnon: 'luciole', rang: 3 }, 350).detail,
  ]
  for (const e of essentiels) assert.ok([...e].length <= 33, `« ${e} » : ${[...e].length} caractères`)
})

test('la feuille : la page tient entre le haut de l’écran et la barre du menu, ses lignes partent de 48 px et se partagent le reste', () => {
  const css = feuille()
  const bloc = (selecteur: string) => css.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?()[\]]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? ''
  // La carte est celle des sections de l'accueil : une colonne, des lignes qui partent de leur contenu et grandissent.
  assert.match(bloc('.jouer-carte'), /display: flex; flex-direction: column;/)
  assert.match(bloc('.jouer-carte > .gros-bouton'), /flex: 1 0 auto;/)
  // L'empilement d'avant s'en va : dix pixels entre deux lignes de la carte les auraient séparées de leur filet.
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /(?:^|\n)\.profil-boutons \{/)

  // La page prend l'écran au-dessus de la barre du menu, et sous le bandeau du service s'il y en a un, jusqu'à son plafond :
  // `min-height: 100dvh`, sous le retrait que la barre pose sur le corps, la faisait toujours défiler de la hauteur de la barre.
  assert.match(bloc('body.avec-menu .profil-carrefour'), /min-height: min\(calc\(100vh - var\(--haut-du-menu, 0px\) - var\(--haut-du-bandeau, 0px\)\), var\(--carrefour-plafond\)\);/)
  assert.match(
    css,
    /@supports \(min-height: 100svh\) \{\n  body\.avec-menu \.profil-carrefour \{ min-height: min\(calc\(100svh - var\(--haut-du-menu, 0px\) - var\(--haut-du-bandeau, 0px\)\), var\(--carrefour-plafond\)\); \}\n\}/,
    '`svh`, comme l’accueil : la barre d’adresse du navigateur dépliée, tout tient encore',
  )
  // Son plafond se compte par ligne : au-delà, elles seraient plus hautes que les gros boutons d'avant.
  assert.match(bloc('.profil-carrefour'), /--carrefour-plafond: calc\([\d.]+rem \+ var\(--carrefour-lignes, 5\) \* [\d.]+rem\);/)
  // Seules les lignes s'étirent, à partir de leur contenu.
  assert.match(bloc('.profil-carrefour > *'), /flex: none;/)
  assert.match(bloc('.profil-carrefour > .profil-boutons'), /flex: 1 0 auto;/)
  // Une ligne ne descend pas sous 48 px, une cible de doigt ; trois pas de hauteur, aux mesures de l'accueil.
  assert.match(bloc('.profil-carrefour'), /--carrefour-rang: 48px;/)
  assert.match(bloc('.profil-boutons > .gros-bouton'), /min-height: var\(--carrefour-rang\);/)
  const pas = [...css.matchAll(/@media \(min-height: (\d+)px\) \{\n  \.profil-carrefour \{([^}]*)\}/g)].map(m => ({ haut: Number(m[1]), rang: Number(m[2].match(/--carrefour-rang: (\d+)px;/)?.[1]) }))
  assert.deepEqual(pas, [{ haut: 720, rang: 50 }, { haut: 820, rang: 54 }])

  // Une seule ligne de texte sous chaque titre : coupée au bout plutôt que passée dessous, ses suites entières ou pas du tout.
  assert.match(bloc('.profil-boutons .gros-detail'), /overflow: hidden;[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/)
  assert.match(bloc('.profil-boutons .gros-a-suite'), /display: flex;[^}]*flex-wrap: wrap;[^}]*height: 1\.25em;/)
  assert.match(bloc('.profil-boutons .gros-essentiel'), /min-width: 0;[^}]*text-overflow: ellipsis;/)
  assert.match(bloc('.profil-boutons .gros-suite'), /flex: none;[^}]*white-space: pre;/)
  // La jauge garde sa ligne, et sa hauteur tant que son compte n'est pas arrivé : rien ne saute quand il arrive.
  assert.match(bloc('.profil-boutons .gros-jauge'), /min-height: calc\(var\(--carrefour-detail\) \* 1\.25\);/)
  assert.match(bloc('.profil-boutons .gros-compte'), /font-size: var\(--carrefour-detail\); line-height: 1\.25;/)
  // Aucun texte sous le plus petit de l'application (`--t-label`, 0,6875 rem), à aucun pas.
  const tailles = [...css.matchAll(/--carrefour-(?:titre|detail): ([\d.]+)rem;/g)].map(m => Number(m[1]))
  assert.equal(tailles.length, 6, `${tailles.length} tailles lues`)
  assert.ok(Math.min(...tailles) >= 0.6875, `la plus petite : ${Math.min(...tailles)} rem`)
  // Dans la carte, le compteur rouge se pose sur l'épaule de la pastille ronde : à cheval sur le coin du bouton, il en
  // sortirait. Tenu par sa droite : il grandit avec le texte sans mordre sur le titre.
  assert.match(bloc('.profil-boutons .gros-compteur'), /top: calc\(50% - var\(--carrefour-icone\) \/ 2 - 6px\); right: calc\(100% - var\(--carrefour-bord\) - var\(--carrefour-icone\) - 7px\); left: auto;/)
  // Soi, en tête : sa hauteur gardée d'avance — la bordure de ligue se pose après la page, et toute la carte bougeait.
  assert.match(bloc('.profil-carrefour > .identite-ligne'), /min-height: calc\(2\.4rem \* 2\.02 \+ 4px\);/)
})

test('les règles du carrefour ne visent que lui : ni l’accueil, ni la boutique, ni les gros boutons d’ailleurs', () => {
  const css = feuille()
  // Son bloc, en fin de feuille : après celui de l'accueil, dont il départage les règles à égalité (la carte, son compteur).
  const debut = css.indexOf('/* ── Le carrefour du profil : tout sur un écran')
  assert.ok(debut > css.indexOf("/* ── L'accueil compact"), 'le bloc du carrefour suit celui de l’accueil')
  const suivant = css.indexOf('\n/* ── ', debut + 1)
  const leBloc = css.slice(debut, suivant < 0 ? undefined : suivant).replace(/\/\*[\s\S]*?\*\//g, '')
  const selecteurs = [...leBloc.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].flatMap(m => m[1].split(',').map(s => s.trim()))
  assert.ok(selecteurs.length > 20, `${selecteurs.length} sélecteurs lus`)
  // Chacun sous son cadre ou sous sa carte : les gros boutons de l'accueil et du Cabinet, qui partagent `GrosBouton`,
  // gardent leurs mesures, et la boutique, qui partage la page, les siennes.
  for (const s of selecteurs) assert.match(s, /^(?:body\.avec-menu )?\.profil-carrefour(?![\w-])|^\.profil-boutons(?![\w-])/, s)
  // Le cadre vit sur la page seule, et chaque ligne se règle sous la carte : sa carte de joueur s'ouvre dans la page, une
  // règle écrite sous son cadre descendrait jusqu'à elle.
  for (const s of selecteurs.filter(x => /gros-|pastille/.test(x))) assert.match(s, /^\.profil-boutons /, s)
  for (const s of selecteurs.filter(x => /profil-carrefour /.test(x))) assert.match(s, /^\.profil-carrefour > [.*\w-]+$/, `${s} : l'enfant direct de la page`)
})

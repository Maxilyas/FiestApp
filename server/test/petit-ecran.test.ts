// Le téléphone à 320 px et au texte agrandi.
//
// L'audit du 27 septembre 2026 (`retours/2026-09-27/`, axe 11) l'a mesuré dans
// Chromium : à 320 px, les lauréats n'avaient plus que « M… » de leur prénom ;
// à 277 px — un 360 au texte à 130 % —, plus une lettre, laurier ou pas, et
// « Camille (2) » perdait sa marque dans les points de suspension. Le rendu
// se regarde dans un navigateur ; ici, ce qui le décide et qu'une retouche
// défairait sans que le typecheck le voie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import React from 'react'
import { partsDuNomAffiche } from '../../shared/homonymes'

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
function regle(selecteur: string, dans = CSS): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|[{}])\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(dans)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

/** Les blocs `@container …` de la feuille, entiers, accolades comprises. */
function requetesDeConteneur(): { condition: string; corps: string }[] {
  const blocs: { condition: string; corps: string }[] = []
  for (const m of CSS.matchAll(/@container\s*([^{]*)\{/g)) {
    let profondeur = 1
    let k = m.index! + m[0].length
    while (profondeur > 0 && k < CSS.length) {
      if (CSS[k] === '{') profondeur++
      else if (CSS[k] === '}') profondeur--
      k++
    }
    blocs.push({ condition: m[1].trim(), corps: CSS.slice(m.index! + m[0].length, k - 1) })
  }
  return blocs
}

// ── La marque d'homonymie ne se coupe jamais ──────────────────────────────

test('« Camille (2) » se coupe au prénom : la marque reste, le laurier aussi', async () => {
  // La marque se reconnaît à la forme que `nomsAffiches` écrit.
  assert.deepEqual(partsDuNomAffiche('Camille (2)'), { prenom: 'Camille', marque: ' (2)' })
  assert.deepEqual(partsDuNomAffiche('Marie-Charlotte Lefebvre (12)'), { prenom: 'Marie-Charlotte Lefebvre', marque: ' (12)' })
  assert.deepEqual(partsDuNomAffiche('Camille'), { prenom: 'Camille', marque: '' })
  // Le premier arrivé n'est jamais marqué : « (1) » est un prénom, pas une marque.
  assert.deepEqual(partsDuNomAffiche('Jo (1)'), { prenom: 'Jo (1)', marque: '' })
  assert.deepEqual(partsDuNomAffiche('(2)'), { prenom: '(2)', marque: '' })

  // Le prénom dans sa case qui se coupe, la marque à côté, son espace dans le
  // texte : la ligne se lit toujours « Camille (2) ».
  assert.equal(
    await rendu('components/Laurier', 'NomLaure', { nom: 'Camille (2)' }),
    '<span class="nom-laure"><span class="nom-laure-texte">Camille</span><span class="nom-marque"> (2)</span></span>',
  )
  const laure = await rendu('components/Laurier', 'NomLaure', { nom: 'Camille (2)', laurier: true })
  assert.match(laure, /^<span class="nom-laure"><span class="nom-laure-texte">Camille<\/span><span class="nom-marque"> \(2\)<\/span><span class="laurier-bulle"[^>]*><svg class="laurier laurier-1"/)
  // Le cas de toutes les soirées reste un texte nu (`finitions.test.ts` le lit ainsi).
  assert.equal(await rendu('components/Laurier', 'NomLaure', { nom: 'Camille' }), 'Camille')

  // C'est le prénom qui porte les points de suspension ; la marque ne rétrécit pas.
  assert.match(regle('.nom-laure-texte'), /text-overflow:\s*ellipsis/)
  assert.match(regle('.nom-marque'), /flex:\s*none/)
  assert.match(regle('.nom-marque'), /white-space:\s*pre\b/, 'son espace se voit')
  assert.doesNotMatch(regle('.nom-marque'), /overflow/)

  // Au classement de la salle d'attente, avec le vrai composant.
  const joueurs = [
    { id: 'a', name: 'Camille', avatar: '🐙', score: 1200, connected: true, teamId: null },
    { id: 'b', name: 'Camille', nomAffiche: 'Camille (2)', avatar: '🐙', score: 900, connected: true, teamId: null, laurier: true },
  ]
  const html = await rendu('components/Leaderboard', 'Leaderboard', { players: joueurs })
  assert.match(html, /<span class="nom-laure-texte">Camille<\/span><span class="nom-marque"> \(2\)<\/span><span class="laurier-bulle"[^>]*><svg class="laurier laurier-1"/)
})

test('chaque prénom d’un classement passe par NomLaure', () => {
  // Une ligne qui écrirait le prénom nu le laisserait couper sa marque. Seul
  // le nom d'une équipe n'en porte jamais.
  const exceptions = new Set(['{t.name}'])
  const racine = new URL('../../client/src/', import.meta.url)
  const fichiers = readdirSync(racine, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.tsx'))
  const vus: string[] = []
  for (const f of fichiers) {
    // Les commentaires JSX ne sont pas du contenu. Les marches du podium
    // d'un quiz (`marche-nom`) sont un classement aussi.
    const source = readFileSync(new URL(f, racine), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    for (const m of source.matchAll(/<span className="(?:lb-name|marche-nom)">\s*([^\s<][^<]*|<\w+)/g)) {
      const contenu = m[1].trim()
      vus.push(f)
      if (exceptions.has(contenu)) continue
      assert.equal(contenu, '<NomLaure', `${f} : « ${contenu} » dans une ligne de classement`)
    }
  }
  assert.ok(vus.length >= 10, 'les lignes de classement sont bien là')
})

// ── Une ligne étroite passe sur deux étages ───────────────────────────────

test('une ligne de classement étroite passe sur deux étages : le prénom seul en haut', () => {
  // Les listes sont des conteneurs : c'est leur largeur qui compte, pas celle
  // de l'écran — la même ligne vit dans une carte, sous une échelle, au mur.
  assert.match(CSS, /\.leaderboard,\s*\.podium\s*\{\s*container-type:\s*inline-size;?\s*\}/)

  const bloc = requetesDeConteneur().find(b => /\.lb-row:not\(\.team-row\)\s*\{/.test(b.corps))
  assert.ok(bloc, 'une requête de conteneur range les lignes de classement')
  // En `rem`, le seuil grandit avec le texte agrandi par le système. Et il
  // couvre le téléphone de 320 px : sa liste y fait 242 px (mesurée dans
  // Chromium, podium et salle d'attente), où un lauréat n'avait plus que
  // « M… » de son prénom.
  const seuil = /^\(max-width:\s*([\d.]+)rem\)$/.exec(bloc.condition)
  assert.ok(seuil, `un seuil en rem : ${bloc.condition}`)
  assert.ok(Number(seuil[1]) * 16 > 242, `${seuil[1]} rem ne couvre pas la liste d’un téléphone de 320 px`)

  // Le prénom seul au premier étage, le niveau et les points au second.
  const ligne = regle('.lb-row:not(.team-row)', bloc.corps)
  assert.match(ligne, /display:\s*grid/)
  assert.match(ligne, /grid-template-areas:\s*'rang av nom nom'\s*'rang av niv pts'/)
  // Chaque enfant d'une ligne a sa case : sans elle, la grille le placerait
  // où elle peut, sur un troisième étage.
  for (const [enfant, aire] of [
    ['.lb-rank', 'rang'],
    ['.lb-avatar', 'av'],
    ['.lb-name', 'nom'],
    ['.niveau', 'niv'],
    ['.lb-score', 'pts'],
  ]) {
    assert.match(regle(`.lb-row:not(.team-row) > ${enfant}`, bloc.corps), new RegExp(`grid-area:\\s*${aire}\\b`), enfant)
  }
  assert.match(regle('.lb-row > .guess-value', bloc.corps), /grid-area:\s*val\b/)
})

// ── Les onglets : à la ligne plutôt que hors de l'écran, et au clavier ────

/** Une source du client, telle qu'on l'écrit. */
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

test('les onglets passent à la ligne plutôt que de sortir de l’écran', () => {
  // Sur une grille d'une seule rangée, « Apparence » refusait de céder : à
  // 320 px « Carrière » sortait de l'écran — et le mot de passe avec lui.
  const onglets = regle('.onglets')
  assert.match(onglets, /display:\s*flex/)
  assert.match(onglets, /flex-wrap:\s*wrap/)
  assert.doesNotMatch(onglets, /grid-auto-flow:\s*column/)
  // D'une même largeur tant qu'ils tiennent, jamais sous leur texte.
  assert.match(regle('.onglet'), /flex:\s*1 1 0/)
  // Sous 340 px (un 360 au texte à 130 % en fait 277), sans leurs icônes —
  // toute rangée d'onglets, depuis que le profil a ses tuiles.
  assert.match(CSS, /@media \(max-width: 340px\) \{\s*\.onglets \.onglet \{[^}]*\}\s*\.onglets \.onglet \.icon \{ display: none; \}/)
  // Au texte agrandi, la pastille de niveau du profil poussait la page : le prénom se coupe.
  assert.match(regle('.identite-nom'), /overflow-wrap:\s*anywhere/)
})

test('les onglets se prennent aux flèches, un seul arrêt de Tab, le panneau affiché seulement', async () => {
  const { ongletVise } = await import(new URL('../../client/src/components/Onglets.tsx', import.meta.url).href)
  assert.equal(ongletVise('ArrowRight', 2, 3), 0)
  assert.equal(ongletVise('ArrowLeft', 0, 3), 2)
  assert.equal(ongletVise('Home', 2, 3), 0)
  assert.equal(ongletVise('End', 0, 3), 2)
  assert.equal(ongletVise('Enter', 1, 3), null)

  const html = await rendu('components/Onglets', 'Onglets', {
    onglets: [
      { id: 'a', nom: 'Apparence' },
      { id: 't', nom: 'Trophées' },
    ],
    actif: 't',
    onChoisir: () => {},
    label: 'Mon profil',
    idOnglet: (id: string) => `onglet-${id}`,
    idPanneau: (id: string) => `profil-${id}`,
  })
  const boutons = [...html.matchAll(/<button [^>]*>/g)].map(m => m[0])
  assert.equal(boutons.length, 2)
  assert.match(boutons[0], /tabindex="-1"/)
  assert.doesNotMatch(boutons[0], /aria-controls/, 'le panneau d’un onglet inactif n’est pas dans la page')
  assert.match(boutons[1], /tabindex="0"/)
  assert.match(boutons[1], /aria-controls="profil-t"/)

  // Le classement du jour passe par elle, et a son panneau. Les pages de
  // « Mes avatars » passent par les gemmes de l'album (`Gemmes`), qui prennent
  // les flèches de même. Le profil, lui, a ses tuiles.
  assert.match(source('components/Apparence.tsx'), /<Gemmes\s/)
  assert.match(source('components/Gemmes.tsx'), /const j = ongletVise\(e\.key, i, gemmes\.length\)/)
  const jour = source('views/JourApp.tsx')
  assert.match(jour, /<Onglets\s/)
  assert.match(jour, /role="tabpanel" id="classement-periode" aria-labelledby=\{`periode-\$\{periode\}`\}/)
})

// ── Le laurier : derrière le prénom, et dit une fois ──────────────────────

test('à l’écran commun, le laurier suit le prénom de la pastille, et se dit une fois', async () => {
  // Posé avant le bouton du prénom, il lui prenait sa place à gauche : « Op… ».
  const hote = source('views/HostApp.tsx')
  assert.doesNotMatch(hote, /<Laurier laurier=\{p\.laurier\} \/>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)*<button\s+className="chip-name"/)
  assert.match(hote, /<span className="chip-prenom">\{prenom\}<\/span>[\s\S]{0,400}<Laurier laurier=\{joueur\.laurier\} decoratif \/>/)
  // Muet dans le bouton, qui le dit dans son nom.
  // Il s'y dit par ce qu'il est : le laurier du jour, à son allure, ou l'argent du défi (`texteDuLaurier`).
  assert.match(hote, /aria-label=\{`Donner un surnom à \$\{p\.nomAffiche \?\? p\.name\}\$\{p\.laurier \? `, \$\{texteDuLaurier\(p\.laurier\)\}` : ''\}`\}/)
  assert.match(regle('.player-chip .chip-name'), /grid-auto-flow:\s*column/)

  // Décoratif, il se tait ; seul, il se nomme.
  const muet = await rendu('components/Laurier', 'Laurier', { laurier: true, decoratif: true })
  assert.match(muet, /^<span class="laurier-bulle" role="presentation" title="vainqueur du quiz du jour d’hier"><svg class="laurier laurier-1"[^>]* aria-hidden="true"/)
  assert.doesNotMatch(muet, /role="img"|aria-label/)
  assert.match(await rendu('components/Laurier', 'Laurier', { laurier: true }), /role="img" aria-label="vainqueur du quiz du jour d’hier"/)
  // Sur la carte et le profil, le texte le dit juste à côté : il se taisait deux fois moins.
  // Celui du jour comme celui d'argent : chacun sa phrase.
  for (const f of ['components/CarteJoueur.tsx', 'views/ProfilApp.tsx'])
    assert.match(
      source(f),
      /<Laurier laurier=\{(?:carte|profil)\.laurier\} decoratif \/>[\s\S]{0,120}'Vainqueur du défi de la semaine dernière' : 'Vainqueur du quiz du jour d’hier'/,
      f,
    )

  // « Niv. niveau 5 » : le préfixe du mur se tait pour l'oreille, avec un repli.
  assert.match(regle('.host .niveau::before'), /content: 'Niv\.\\00a0';\s*(?:\/\*[\s\S]*?\*\/\s*)?content: 'Niv\.\\00a0' \/ '';/)
})

test('le laurier a son infobulle pour la souris, hors du texte du prénom et une fois pour l’oreille', async () => {
  // L'animateur à la console voyait une couronne sans savoir ce qu'elle dit
  // — l'arbitrage du 27 septembre 2026 [mots-2]. Un <title> aurait glissé
  // la phrase dans le texte du prénom : l'infobulle est sur l'enveloppe.
  const dit = await rendu('components/Laurier', 'Laurier', { laurier: true })
  assert.match(dit, /^<span class="laurier-bulle" role="presentation" title="vainqueur du quiz du jour d’hier"><svg class="laurier laurier-1"[^>]* role="img" aria-label="vainqueur du quiz du jour d’hier"/)
  const laure = await rendu('components/Laurier', 'NomLaure', { nom: 'Camille (2)', laurier: true })
  assert.equal(laure.replace(/<[^>]+>/g, ''), 'Camille (2)', 'le texte de la ligne ne change pas')
  assert.match(regle('.laurier-bulle'), /display:\s*contents/, 'l’enveloppe ne fait pas de boîte')
})

// ── La carte d'un joueur : une vraie fenêtre modale ───────────────────────

test('la carte d’un joueur rend le reste de la page inerte, et le focus à qui l’a ouverte', async () => {
  // Le deuxième Tab sortait vers un bouton caché derrière elle, et Échap
  // rendait le focus à la page entière.
  const { horsDeLaBoite } = await import(new URL('../../client/src/modale.ts', import.meta.url).href)
  type N = { nom: string; parentElement: N | null; children: N[] }
  const noeud = (nom: string, enfants: N[] = []): N => {
    const n: N = { nom, parentElement: null, children: enfants }
    for (const e of enfants) e.parentElement = n
    return n
  }
  const carte = noeud('carte')
  const voile = noeud('voile', [carte])
  const page = noeud('page', [noeud('entête'), noeud('classement'), voile])
  const corps = noeud('body', [noeud('bandeau'), page, noeud('toasts')])
  assert.deepEqual(
    horsDeLaBoite(carte, corps).map((n: N) => n.nom),
    ['entête', 'classement', 'bandeau', 'toasts'],
  )
  const carteJoueur = source('components/CarteJoueur.tsx')
  assert.match(carteJoueur, /useModale\(boite, onFermer\)/)
  const modale = source('modale.ts')
  assert.match(modale, /setAttribute\('inert', ''\)/)
  assert.match(modale, /avant\?\.focus\(/)
})

// ── Un dialogue : une vraie fenêtre modale aussi ──────────────────────────

test('« Quitter cette partie ? » rend le reste de la page inerte, et un toucher ne lui vole pas son focus', async () => {
  // La tablée du 25 octobre 2026 (Hugo, au lecteur d'écran) : ouverte au lever du doigt — « Quitter » à la révélation d'une manche
  // du Cabinet, sans pause à demander —, la fenêtre posait le focus sur « Continuer », puis le mousedown que le navigateur fait
  // suivre tombait sur le voile, qui ne se focalise pas : le focus partait sur la page, rien n'était inerte derrière, et Tab,
  // Tab, Entrée jouait « Manche suivante » derrière la fenêtre restée ouverte.
  const { arretDuTab } = await import(new URL('../../client/src/components/Dialog.tsx', import.meta.url).href)
  // Le voile d'une feuille arrête le sien de même : il vit avec les fenêtres modales (`modale.ts`), que les deux importent.
  const { retenirLeFocus } = await import(new URL('../../client/src/modale.ts', import.meta.url).href)

  // Un appui sur le voile même garde le focus où la fenêtre l'a posé ; un appui dans la boîte garde le sien.
  const appui = (target: object, currentTarget: object) => {
    const vu = { empeche: false }
    retenirLeFocus({ target, currentTarget, preventDefault: () => void (vu.empeche = true) })
    return vu.empeche
  }
  const voile = {}
  assert.equal(appui(voile, voile), true, 'le mousedown du doigt sur le voile')
  assert.equal(appui({}, voile), false, 'un champ, un bouton de la boîte prennent le focus')

  // Tab tourne dans la boîte — et y revient d'ailleurs : le focus tombé sur la page n'emmène plus Tab derrière la fenêtre.
  const arrets = ['Continuer', 'Quitter la partie']
  assert.equal(arretDuTab(arrets, 'la page', false), 'Continuer', 'Tab parti de la page revient au premier bouton')
  assert.equal(arretDuTab(arrets, 'la page', true), 'Quitter la partie', 'et Maj+Tab au dernier')
  assert.equal(arretDuTab(arrets, 'Quitter la partie', false), 'Continuer', 'du dernier au premier')
  assert.equal(arretDuTab(arrets, 'Continuer', true), 'Quitter la partie', 'du premier au dernier, en arrière')
  assert.equal(arretDuTab(arrets, 'Continuer', false), null, 'entre deux arrêts, le navigateur y suffit')
  assert.equal(arretDuTab([], 'la page', false), null, 'une boîte sans arrêt ne retient rien')

  // Le reste de la page inerte, comme sous la carte d'un joueur : tout ce qui n'est ni le voile ni l'un de ses ancêtres. Le voile
  // reste vivant — le toucher pour renoncer le ferme encore —, et l'inertie se compte avec les autres fenêtres (`couvrir`).
  const dialogue = source('components/Dialog.tsx')
  assert.match(dialogue, /<div className="dialog-backdrop" ref=\{voile\} onMouseDown=\{retenirLeFocus\}/, 'le voile garde le focus où la fenêtre l’a posé')
  assert.match(dialogue, /const decouvrir = couvrir\(voile\.current \? horsDeLaBoite\(voile\.current, document\.body\) : \[\]\)/)
  // Rendu vivant avant de rendre le focus : un bouton inerte ne le prend pas.
  const nettoyage = dialogue.slice(dialogue.indexOf("document.removeEventListener('keydown', onKey)"))
  assert.ok(nettoyage.indexOf('decouvrir()') >= 0, 'le reste de la page rendu vivant en partant')
  assert.ok(nettoyage.indexOf('decouvrir()') < nettoyage.indexOf('opener?.focus'), 'avant que le focus revienne à « Quitter »')
  assert.match(dialogue, /const vise = arretDuTab\(focusable\(\), document\.activeElement, e\.shiftKey\)/)
})

test('deux fenêtres empilées : ce qu’elles couvrent ne revit qu’au départ de la dernière, d’où qu’elle parte', async () => {
  // La barre du chef referme d'elle-même la feuille d'une équipe que l'écran commun a retirée (`BarreDuChef.tsx`), et
  // « Supprimer l'équipe » y ouvre une confirmation par-dessus. Chaque fenêtre écartait ce qui était déjà inerte : la confirmation
  // ne retenait pas la niche, les bandeaux ni le reste de `body`, que la feuille avait endormis — la feuille partie la première,
  // son nettoyage les rendait vivants derrière la confirmation encore ouverte, et le lecteur d'écran les lisait.
  const { couvrir } = await import(new URL('../../client/src/modale.ts', import.meta.url).href)
  const element = (inerte = false) => {
    const attributs = new Set(inerte ? ['inert'] : [])
    return {
      hasAttribute: (n: string) => attributs.has(n),
      setAttribute: (n: string) => void attributs.add(n),
      removeAttribute: (n: string) => void attributs.delete(n),
    }
  }
  const niche = element()
  const bandeau = element()
  const page = element()
  // Inerte par la page elle-même — la face cachée d'une carte à collectionner : aucune fenêtre n'y touche.
  const faceCachee = element(true)
  const inertes = () => [niche, bandeau, page, faceCachee].map(e => e.hasAttribute('inert'))

  const sousLaFeuille = couvrir([niche, bandeau, faceCachee])
  assert.deepEqual(inertes(), [true, true, false, true], 'la feuille ouverte')
  const sousLeDialogue = couvrir([page, niche, bandeau, faceCachee])
  assert.deepEqual(inertes(), [true, true, true, true], 'la confirmation ouverte sur elle')
  sousLaFeuille()
  assert.deepEqual(inertes(), [true, true, true, true], 'la feuille partie la première : rien ne revit derrière la confirmation')
  sousLaFeuille()
  assert.deepEqual(inertes(), [true, true, true, true], 'rendu deux fois, rien de plus')
  sousLeDialogue()
  assert.deepEqual(inertes(), [false, false, false, true], 'la dernière partie, tout revit — sauf ce que la page avait endormi')

  // Dans l'ordre d'ouverture aussi.
  const a = couvrir([niche])
  const b = couvrir([niche])
  b()
  assert.equal(niche.hasAttribute('inert'), true, 'la fenêtre du dessus partie, celle d’en dessous couvre encore')
  a()
  assert.equal(niche.hasAttribute('inert'), false)

  // Les deux portes passent par lui : une feuille, une carte (`useModale`), un dialogue — plus aucune n'écarte à part ce qui
  // était inerte, ni ne le rend vivant à plat.
  for (const f of ['modale.ts', 'components/Dialog.tsx']) {
    const s = source(f)
    assert.match(s, /couvrir\(/, `${f} compte ce qu'il couvre`)
    assert.doesNotMatch(s, /filter\(e => !e\.hasAttribute\('inert'\)\)/, `${f} écarte encore à part ce qui était inerte`)
    assert.doesNotMatch(s, /for \(const e of rendus\) e\.removeAttribute\('inert'\)/, `${f} rend encore vivant à plat`)
  }
})

test('une fenêtre reçoit le focus sans anneau : ni à l’arrivée sans geste, ni ouverte au clavier', () => {
  // La feuille des missions s'ouvre d'elle-même à l'arrivée sur `/#missions` (le lien des fins de partie), le réveil d'un gardien
  // à l'arrivée au Cabinet : focalisée par le code avant tout geste — ou ouverte au clavier —, `:focus-visible` donnait à la boîte
  // le filet blanc du navigateur (`outline: auto`, mesuré dans Chromium en 360 × 640), que l'anneau de l'application écarte de ce
  // qui a `tabindex="-1"`. Au Cabinet, `.cab-page` l'effaçait sous trois feuilles, pas sous les deux autres.
  const modale = source('modale.ts')
  assert.match(modale, /const SANS_ANNEAU[^=]*= \{ focusVisible: false \}/)
  assert.match(modale, /boite\.current\?\.focus\(SANS_ANNEAU\)/)
  assert.doesNotMatch(modale, /boite\.current\?\.focus\(\)/, 'aucune boîte focalisée avec l’anneau')
  // L'anneau d'or de l'application, lui, n'a pas changé : il vient au premier Tab, sur « Fermer ».
  assert.match(CSS, /:where\(:not\(\[tabindex='-1'\]\)\):focus-visible \{\s*outline: 2px solid var\(--focus\);/)
  // La feuille et la carte d'un joueur passent par elle.
  for (const f of ['components/Pieces.tsx', 'components/CarteJoueur.tsx']) assert.match(source(f), /useModale\(boite, onFermer\)/, f)
  // Et la ceinture CSS, pour un navigateur qui ignore l'option : la feuille comme la carte d'un joueur, sans le filet du navigateur.
  assert.match(CSS, /\.carte-joueur:focus \{ outline: none; \}\n\.carte-feuille:focus \{ outline: none; \}/)
})

test('Échap ne ferme que la fenêtre du dessus : la feuille, la carte ou le dialogue ouvert en dernier', async () => {
  // Une feuille, la carte d'un joueur et un dialogue écoutent tous Échap sur le document, et la plus ancienne l'entend la
  // première : la galerie des compagnons se fermait avec l'adoption qu'on y confirmait, et une feuille devenue modale se serait
  // fermée avec la carte d'un ami ouverte sur elle.
  const { poserUneFenetre } = await import(new URL('../../client/src/modale.ts', import.meta.url).href)
  const feuille = poserUneFenetre()
  assert.equal(feuille.dessus(), true, 'seule ouverte')
  const carte = poserUneFenetre()
  assert.deepEqual([feuille.dessus(), carte.dessus()], [false, true], 'la carte ouverte sur la feuille a le clavier')
  const dialogue = poserUneFenetre()
  assert.deepEqual([feuille.dessus(), carte.dessus(), dialogue.dessus()], [false, false, true])
  dialogue.retirer()
  dialogue.retirer()
  assert.deepEqual([feuille.dessus(), carte.dessus()], [false, true], 'le dialogue parti, la carte reprend le clavier ; retiré deux fois, rien de plus')
  // Une fenêtre d'en dessous qui part la première — sa page démontée — ne retire pas celle du dessus.
  feuille.retirer()
  assert.equal(carte.dessus(), true)
  carte.retirer()
  // Les deux portes du clavier le lisent : celle des feuilles et des cartes, celle des dialogues.
  assert.match(source('modale.ts'), /const touche = \(e: KeyboardEvent\) => e\.key === 'Escape' && fenetre\.dessus\(\) && fermer\.current\(\)/)
  const dialogues = source('components/Dialog.tsx')
  assert.match(dialogues, /const onKey = \(e: KeyboardEvent\) => \{\s*(?:\/\/[^\n]*\n\s*)*if \(!fenetre\.dessus\(\)\) return/)
  for (const f of ['modale.ts', 'components/Dialog.tsx']) assert.match(source(f), /fenetre\.retirer\(\)/, `${f} se retire en partant`)
})

test('la carte se ferme d’une croix sous elle, toujours en vue, et ne prend plus tout l’écran', async () => {
  // « Fermer » attendait au pied d'une carte bien remplie : il fallait
  // défiler jusqu'au bout pour le trouver (la remarque du 3 octobre 2026).
  // Montée dans sa barre, elle passe sous la carte à collectionner, avec
  // « Retourner la carte » (le choix du propriétaire du 20 octobre 2026 :
  // « en bas ») — hors de ce qui défile, sous le pouce.
  const html = await rendu('components/CarteJoueur', 'CarteJoueur', { slug: 's', playerId: 'p', onFermer: () => {} })
  const pivot = html.indexOf('<div class="carte-pivot">')
  const defile = html.indexOf('<div class="carte-defile">')
  const sous = html.indexOf('<div class="carte-sous">')
  const croix = html.indexOf('class="carte-croix" aria-label="Fermer"')
  assert.ok(pivot > 0 && pivot < defile && defile < sous && sous < croix, `la croix, sous la carte : ${html}`)
  // La carte et ses faces se ferment avant sa rangée : elle n'est pas dans ce qui défile.
  assert.match(html.slice(defile, sous), /<\/div><\/section><\/div>$/, 'la rangée de la croix, hors de la carte qui défile')
  const carte = source('components/CarteJoueur.tsx')
  assert.doesNotMatch(carte, /dialog-actions|btn btn-ghost" onClick=\{onFermer\}/, 'plus de « Fermer » au pied')
  assert.match(regle('.carte-pivot'), /max-height:\s*min\(76dvh, 580px\)/)
  assert.match(regle('.carte-joueur'), /max-height:\s*calc\(100dvh - 40px\)/, 'la carte et sa rangée tiennent dans l’écran')
  assert.match(regle('.carte-sous'), /flex:\s*none/, 'sa rangée ne défile pas')
})

test('un toast ne s’ancre jamais en haut et en bas à la fois', () => {
  // Posé en haut sur une page de joueur, il recevait aussi le « bottom » de
  // la barre du chef ou du menu : « Lien copié » s'étirait en colonne sur
  // toute la hauteur (la remarque du 4 octobre 2026).
  assert.match(regle('.player-shell > .toast'), /top:[^;]+;\s*bottom:\s*auto/)
  for (const barre of ['avec-chef', 'avec-menu']) {
    assert.ok(!new RegExp(`body\\.${barre} \\.toast \\{`).test(CSS), `${barre} : sans exception, la barre étirait le toast d’une page de joueur`)
    assert.match(regle(`body.${barre} .toast:not(.player-shell > .toast)`), /bottom:/)
  }
})

// ── Les choix du profil : le focus reste, et l'on entend ce qui change ────

test('choisir un avatar, une finition, un fond ou sa vitrine ne fait plus tomber le focus', async () => {
  // Désactivée le temps de l'enregistrement, la case touchée perdait le
  // focus, qui tombait sur la page ; l'état changeait sans rien dire.
  for (const f of ['components/Apparence.tsx', 'components/Trophees.tsx', 'components/Carriere.tsx', 'components/Loge.tsx']) {
    const s = source(f)
    assert.doesNotMatch(s, /(?<!aria-)disabled=\{[^}]*busy[^}]*\}/, `${f} désactive encore pendant l’enregistrement`)
  }
  // Ce qui enregistre le dit sans se désactiver — « Porter », dans la barre
  // de la loge, compris. La vitrine, elle, n'enregistre plus rien : dans la
  // loge, ses hauts faits s'essaient, et la barre les porte. Les avatars non
  // plus : la fiche d'un portrait, qui seule portait encore d'ici, vit dans
  // l'album de la collection, qui ne fait que montrer.
  for (const f of ['components/Carriere.tsx', 'components/Loge.tsx']) {
    assert.match(source(f), /aria-disabled=\{busy \|\| undefined\}/, `${f} dit encore qu’il enregistre`)
  }
  assert.doesNotMatch(source('components/Trophees.tsx'), /\bbusy\b|\benregistrer\(/, 'la vitrine essaie, elle n’enregistre pas')
  assert.doesNotMatch(source('components/Apparence.tsx'), /\bbusy\b|\benregistrer\(/, 'les avatars s’essaient, ils ne s’enregistrent pas')
  // La barre de l'essai part avec « Porter » ou « Annuler » : le focus revient au panneau.
  assert.match(source('components/Loge.tsx'), /if \(avaitUnEssai\.current && !aUnEssai\) rendreLeFocus\(loge\.current, \['\.loge-panneau'\]\)/)
  const profil = source('views/ProfilApp.tsx')
  assert.match(profil, /if \(enregistrement\.current\) return/, 'un second toucher est ignoré')
  assert.match(profil, /<p className="sr-only" role="status">\s*\{annonce\}\s*<\/p>/)

  Object.assign(globalThis, { window: { location: { pathname: '/profil', search: '', hash: '' } } })
  const { annonceDuChoix } = await import(new URL('../../client/src/components/choix.ts', import.meta.url).href)
  assert.equal(annonceDuChoix({ avatar: '🐸' }), 'Tu portes 🐸.')
  assert.equal(annonceDuChoix({ legendaire: 'lg:phenix' }), 'Tu portes Le Phénix.')
  assert.equal(annonceDuChoix({ legendaire: null }), 'Tu reviens à ton emoji.')
  assert.equal(annonceDuChoix({ fond: 'aurore' }), 'Ton fond de carte : Aurore boréale.')
  assert.equal(annonceDuChoix({ titre: null }), 'Sans titre.')

  // La vitrine est une liste, et son ordre se dit à l'oreille.
  const trophees = source('components/Trophees.tsx')
  assert.doesNotMatch(trophees, /<ul className="vitrine-choix[^"]*" role="group"/)
  assert.doesNotMatch(trophees, /<span className="vitrine-rang" aria-hidden="true">/)
  // Rien n'y part sous le doigt : « Les plus durs, d'office », qui ne
  // paraissait qu'une vitrine choisie et rendait le focus au titre, est une
  // option de la liste, toujours là (`loge.test.ts` la rend dans les deux
  // états) ; aucun bouton de la vitrine ne dépend de ce qu'elle montre.
  const vitrine = trophees.slice(trophees.indexOf('export function MaVitrine'), trophees.indexOf('export function UnProche'))
  assert.match(vitrine, /<ul className="vitrine-choix vitrine-a-choisir" aria-label="Les trophées de ma carte">\s*<li>\s*<button\s+type="button"\s+className=\{'vitrine-option' \+ \(office\.montre/)
  assert.doesNotMatch(vitrine, /\{montree && \(/)
  // Dans la loge, une case d'avatar touchée n'ouvre plus rien et ne part pas :
  // elle s'essaie, et ses voisines restent où elles sont (`grille-avatars.test.ts`
  // les compare avant et après l'essai) — le focus reste sur elle. Les fiches,
  // et le focus posé sur leur nom, vivent dans « Ma collection ».
  const apparence = source('components/Apparence.tsx')
  assert.doesNotMatch(apparence, /aria-expanded|aria-controls=\{ouvert/)
  assert.match(apparence, /onClick=\{\(\) => essayer\(piece\)\}/)
})

// ── Ce qui se lit sans la couleur, et sur son fond ────────────────────────

test('le palier d’un écusson se compte en crans, pas seulement en couleur', async () => {
  for (const palier of [0, 1, 2, 3] as const) {
    const html = await rendu('components/Ecusson', 'Ecusson', { categorie: 'Histoire', palier })
    assert.equal([...html.matchAll(/class="ecusson-cran"/g)].length, palier, `palier ${palier}`)
  }
  assert.match(regle('.ecusson-forme .ecusson-cran'), /fill:\s*currentColor/)
})

test('silhouettes, fonds fermés, rideau et aurore : ce qui se lit sur son fond', () => {
  // La silhouette d'un emoji de collection, claire sur sa case sombre (1,1:1 en noir).
  assert.match(regle('.silhouette'), /filter:\s*brightness\(0\) invert\(1\)/)
  assert.match(regle(":root[data-theme='ivoire'] .silhouette"), /filter:\s*brightness\(0\);/)
  // Un fond fermé atténue son dessin, pas la règle qui l'ouvre (2,3:1).
  assert.doesNotMatch(regle('.finition-btn:disabled'), /opacity/)
  assert.match(regle('.finition-btn:disabled > :not(.muted)'), /opacity/)
  // Au théâtre, ce qui défile passe derrière le rideau.
  assert.match(regle('.carte-fond.fond-theatre:not(.fond-apercu)::before'), /z-index:\s*1/)
  // À l'aurore, la lueur verte derrière l'en-tête s'adoucit.
  const aurore = regle('.carte-fond.fond-aurore::before')
  const vert = /radial-gradient\(70% 38% at 28% 16%, rgba\(70, 255, 170, ([\d.]+)\)/.exec(aurore)
  assert.ok(vert && Number(vert[1]) <= 0.3, `la lueur de l’en-tête à ${vert?.[1]}`)
})

test('l’accueil d’un profil garde la place de la carte du jour pendant qu’elle arrive', async () => {
  // Posée 400 ms après la page, elle poussait les onglets de 233 px (CLS 0,175).
  Object.assign(globalThis, { window: { location: { pathname: '/', search: '', hash: '' } } })
  const html = await rendu('components/Jour', 'CarteDuJour', {})
  assert.match(html, /<section class="card jour-carte jour-carte-attente" aria-busy="true"/)
  assert.match(regle('.jour-carte-attente'), /min-height:\s*[\d.]+rem/)
})

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
  assert.match(laure, /^<span class="nom-laure"><span class="nom-laure-texte">Camille<\/span><span class="nom-marque"> \(2\)<\/span><span class="laurier-bulle"[^>]*><svg class="laurier"/)
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
  assert.match(html, /<span class="nom-laure-texte">Camille<\/span><span class="nom-marque"> \(2\)<\/span><span class="laurier-bulle"[^>]*><svg class="laurier"/)
})

test('chaque prénom d’un classement passe par NomLaure', () => {
  // Une ligne qui écrirait le prénom nu le laisserait couper sa marque. Seuls
  // le nom d'une équipe et son propre prénom, sur l'aperçu du profil, n'en
  // portent jamais.
  const exceptions = new Set(['{t.name}', '{profil.name}'])
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

  // Les familles de « Mes avatars » et le classement du jour passent par
  // elle ; le classement a son panneau. Le profil, lui, a ses tuiles.
  assert.match(source('components/Apparence.tsx'), /<Onglets\s/)
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
  assert.match(hote, /aria-label=\{`Donner un surnom à \$\{p\.nomAffiche \?\? p\.name\}\$\{p\.laurier \? `, \$\{LAURIER_TEXTE\}` : ''\}`\}/)
  assert.match(regle('.player-chip .chip-name'), /grid-auto-flow:\s*column/)

  // Décoratif, il se tait ; seul, il se nomme.
  const muet = await rendu('components/Laurier', 'Laurier', { laurier: true, decoratif: true })
  assert.match(muet, /^<span class="laurier-bulle" role="presentation" title="vainqueur du quiz du jour d’hier"><svg class="laurier"[^>]* aria-hidden="true"/)
  assert.doesNotMatch(muet, /role="img"|aria-label/)
  assert.match(await rendu('components/Laurier', 'Laurier', { laurier: true }), /role="img" aria-label="vainqueur du quiz du jour d’hier"/)
  // Sur la carte et le profil, le texte le dit juste à côté : il se taisait deux fois moins.
  for (const f of ['components/CarteJoueur.tsx', 'views/ProfilApp.tsx'])
    assert.match(source(f), /<Laurier laurier decoratif \/> Vainqueur du quiz du jour d’hier/, f)

  // « Niv. niveau 5 » : le préfixe du mur se tait pour l'oreille, avec un repli.
  assert.match(regle('.host .niveau::before'), /content: 'Niv\.\\00a0';\s*(?:\/\*[\s\S]*?\*\/\s*)?content: 'Niv\.\\00a0' \/ '';/)
})

test('le laurier a son infobulle pour la souris, hors du texte du prénom et une fois pour l’oreille', async () => {
  // L'animateur à la console voyait une couronne sans savoir ce qu'elle dit
  // — l'arbitrage du 27 septembre 2026 [mots-2]. Un <title> aurait glissé
  // la phrase dans le texte du prénom : l'infobulle est sur l'enveloppe.
  const dit = await rendu('components/Laurier', 'Laurier', { laurier: true })
  assert.match(dit, /^<span class="laurier-bulle" role="presentation" title="vainqueur du quiz du jour d’hier"><svg class="laurier"[^>]* role="img" aria-label="vainqueur du quiz du jour d’hier"/)
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

test('la carte se ferme d’une croix dans sa barre, toujours en vue, et ne prend plus tout l’écran', () => {
  // « Fermer » attendait au pied d'une carte bien remplie : il fallait
  // défiler jusqu'au bout pour le trouver (la remarque du 3 octobre 2026).
  const carte = source('components/CarteJoueur.tsx')
  const barre = carte.indexOf('<header className="carte-joueur-barre">')
  const croix = carte.indexOf('className="carte-croix" aria-label="Fermer"')
  const defile = carte.indexOf('<div className="carte-defile">')
  assert.ok(barre > 0 && barre < croix && croix < defile, 'la croix, dans la barre, avant ce qui défile')
  assert.doesNotMatch(carte, /dialog-actions|btn btn-ghost" onClick=\{onFermer\}/, 'plus de « Fermer » au pied')
  assert.match(regle('.carte-joueur'), /max-height:\s*min\(76dvh, 580px\)/)
  assert.match(regle('.carte-joueur-barre'), /flex:\s*none/, 'la barre ne défile pas')
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
  for (const f of ['components/Apparence.tsx', 'components/Trophees.tsx', 'components/Carriere.tsx']) {
    const s = source(f)
    assert.doesNotMatch(s, /(?<!aria-)disabled=\{[^}]*busy[^}]*\}/, `${f} désactive encore pendant l’enregistrement`)
    assert.match(s, /aria-disabled=\{busy \|\| undefined\}/, `${f} dit encore qu’il enregistre`)
  }
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
  assert.match(trophees, /rendreLeFocus\(section\.current, \['h3'\]\)/)
  // La légende d'un avatar dessiné reçoit le focus à l'ouverture.
  assert.match(source('components/Apparence.tsx'), /querySelector<HTMLElement>\('\.galerie-detail-nom'\)/)
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

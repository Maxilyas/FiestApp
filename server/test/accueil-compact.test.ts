// L'accueil compact : tout ce qu'on vient y faire sur un écran, sans défiler.
//
// « J'aimerais que tout soit visible sans avoir à scroll plus bas », sans
// revoir le style (le propriétaire, le 9 novembre 2026). En 360 × 640,
// l'accueil d'une habituée faisait 1096 px pour 575 visibles au-dessus de la
// barre du menu : le quiz du jour à moitié, les duels, le Cabinet et tout
// « Entre amis » restaient dessous. La maquette validée le même jour — « Les
// lignes », `retours/2026-11-09/accueil-compact/` — : une carte par section,
// ses boutons en lignes, une ligne de texte chacun ; le quiz du jour et le
// défi de la semaine tous les deux sous les yeux, sans onglets.
//
// Ce que ces épreuves ne voient pas — ce qui passe sous le menu, taille par
// taille — se mesure au navigateur : `server/scripts/rendu-accueil.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import React from 'react'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false, querySelector: () => null },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const feuille = () => readFileSync(client('styles.css'), 'utf8')
/** Les espaces insécables rendues ordinaires : ce que l'épreuve compare, ce sont les mots. */
const lisible = (s: string) => s.replace(/[  ]/g, ' ')
/** La phrase entière d'une ligne, telle qu'un lecteur d'écran la lit : l'essentiel, puis ses suites. */
const phrase = (l: { detail: string; suite?: readonly string[] }) => lisible(l.detail + (l.suite ?? []).join(''))

/** Léa, l'habituée de la maquette : un sentier qu'elle avance, douze jours de série, sa ligue, le défi relevé par neuf joueurs. */
const LEA = {
  jour: { serie: 12, jours: [{ jour: '2026-11-10' }] },
  aujourdhui: '2026-11-11',
  campagne: { vies: 12, avance: { branche: 'foret', palier: 5, laissee: false } },
  defi: { joueurs: 9 },
  duels: { cote: 1084, ligue: 'or', joues: 14, semaine: { duels: 0, ligue: 'or' } },
  cabinet: true,
}

async function accueil(props: object = LEA) {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, ...props }))
}
/** La carte d'une section : ce qu'elle contient, entre son titre et sa fin. */
const carteDe = (html: string, section: 'seul' | 'amis') =>
  html.match(new RegExp(`<section class="jouer-section" aria-labelledby="jouer-${section}"[^>]*><span class="label" id="jouer-${section}">[^<]*</span><div class="jouer-carte[^"]*">(.*?)</div></section>`))?.[1]
const titres = (h: string) => [...h.matchAll(/<b>([^<]*)<\/b>/g)].map(m => m[1])

test('l’accueil range ses boutons en lignes : une carte par section, le quiz du jour et le défi de la semaine tous les deux sous les yeux', async () => {
  const html = await accueil()
  // « Seul » : une seule carte, ses boutons dedans, dans l'ordre d'avant — la campagne, le quiz du jour, le défi, les duels, le Cabinet.
  const seul = carteDe(html, 'seul')
  assert.ok(seul, 'la section « Seul » tient ses boutons dans une carte')
  assert.deepEqual(titres(seul), ['La campagne', 'Le quiz du jour', 'Le défi de la semaine', 'Les duels', 'Le Cabinet de curiosités'])
  // Rien d'autre dans la carte que ses lignes : ni onglets, ni panneau caché — un filet les sépare, c'est tout.
  assert.equal(seul.replace(/<a class="gros-bouton[^"]*" href="[^"]*">.*?<\/a>/g, ''), '')
  // « Entre amis » : une carte elle aussi, coupée en deux.
  assert.match(html, /<div class="jouer-carte jouer-duo">/)
  assert.deepEqual(titres(carteDe(html, 'amis') ?? ''), ['Créer un salon', 'Rejoindre une soirée'])
  // Les mêmes boutons, les mêmes noms, les mêmes adresses : la tablée et les rendus les touchent par leur nom.
  for (const [titre, href] of [['La campagne', '/campagne#sentiers'], ['Le quiz du jour', '/jour'], ['Le défi de la semaine', '/campagne#defi'], ['Les duels', '/duels'], ['Le Cabinet de curiosités', '/cabinet'], ['Créer un salon', '/salon']]) {
    assert.match(html, new RegExp(`<a class="gros-bouton" href="${href}"><span class="gros-icone">.*?</span><span class="gros-texte"><b>${titre}</b>`), titre)
  }
  assert.match(html, /<button type="button" class="gros-bouton"><span class="gros-icone">.*?<\/span><span class="gros-texte"><b>Rejoindre une soirée<\/b>/)

  // Le quiz du jour et le défi de la semaine se voient tous les deux, chacun ce qui l'attend : plus d'onglet à toucher pour
  // découvrir le défi (la tuile à deux onglets du 19 octobre 2026 le montrait sans prendre un bouton de plus ; en lignes,
  // les deux tiennent dans sa place).
  assert.doesNotMatch(html, /role="tab|jour-defi|aria-selected/)
  assert.match(lisible(seul), /<b>Le quiz du jour<\/b><span class="gros-detail">Série de 12 jours<\/span><\/span><span class="pastille-attente">À jouer<\/span>/)
  assert.match(seul, /<b>Le défi de la semaine<\/b>.*?<span class="pastille-attente">À relever<\/span>/)
  assert.ok(!existsSync(client('components/JourEtDefi.tsx')), 'la tuile à onglets s’en va avec ses onglets')
  assert.doesNotMatch(readFileSync(client('components/Onglets.tsx'), 'utf8'), /onglet-point|point\?:/, 'son point d’or n’avait pas d’autre lecteur')
  assert.doesNotMatch(feuille(), /\.jour-defi|\.onglet-point/)

  // Une soirée où l'on joue déjà passe toujours devant tout, hors des cartes ; la ligne du lendemain reste dessous.
  const enSoiree = await accueil({ ...LEA, enCours: [{ nom: 'Hugo', slug: 'chez-hugo' }], lendemain: React.createElement('p', { className: 'lendemain' }, 'Chez Hugo') })
  assert.match(enSoiree, /^<div class="accueil-gestes"><a class="gros-bouton gros-principal" href="\/chez-hugo">/)
  assert.ok(enSoiree.indexOf('Revenir chez Hugo') < enSoiree.indexOf('id="jouer-seul"'))
  assert.match(enSoiree, /<\/section><p class="lendemain">Chez Hugo<\/p><\/div>$/)

  // Les lignes se partagent la hauteur de l'écran : chaque section en prend la part de ses lignes, « Entre amis » un peu
  // plus d'une — sans le Cabinet, une ligne de moins.
  assert.match(html, /aria-labelledby="jouer-seul" style="--jouer-part:5">/)
  assert.match(html, /aria-labelledby="jouer-amis" style="--jouer-part:1\.2">/)
  assert.match(await accueil({ ...LEA, cabinet: false }), /aria-labelledby="jouer-seul" style="--jouer-part:4">/)
})

test('un gros bouton dit l’essentiel sur sa ligne, et la suite là où la rangée a la place', async () => {
  const { GrosBouton } = await import(client('components/Pieces.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bouton = (props: object) => renderToStaticMarkup(React.createElement(GrosBouton, { icone: null, titre: 'Les duels', href: '/duels', ...props }))
  // Sans suite, la ligne d'avant, telle quelle : le profil et le Cabinet posent les mêmes boutons.
  assert.match(bouton({ detail: 'Défie qui tu veux' }), /<b>Les duels<\/b><span class="gros-detail">Défie qui tu veux<\/span><\/span>/)
  assert.match(bouton({ detail: 'Défie qui tu veux', suite: [] }), /<span class="gros-detail">Défie qui tu veux<\/span>/)
  // Avec : l'essentiel d'abord, puis chaque morceau à part — la feuille n'en montre que ceux qui tiennent entiers, et le
  // lecteur d'écran lit toute la phrase.
  assert.match(
    bouton({ detail: 'Ligue d’or · cote 1084', suite: [' · encore 3 duels pour ta récompense'] }),
    /<span class="gros-detail gros-a-suite"><span class="gros-essentiel">Ligue d’or · cote 1084<\/span><span class="gros-suite"> · encore 3 duels pour ta récompense<\/span><\/span>/,
  )
  assert.match(bouton({ detail: 'Défie qui tu veux', suite: [', ou Automate', ' : monte de ligue'] }), /<span class="gros-suite">, ou Automate<\/span><span class="gros-suite"> : monte de ligue<\/span><\/span>/)

  // Sur l'accueil, une ligne : coupée au bout plutôt que passée dessous, ses suites entières ou pas du tout.
  const css = feuille()
  assert.match(css, /\.accueil-gestes \.gros-detail \{[^}]*overflow: hidden;[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;[^}]*\}/)
  assert.match(css, /\.accueil-gestes \.gros-a-suite \{[^}]*display: flex;[^}]*flex-wrap: wrap;[^}]*height: 1\.25em;[^}]*\}/)
  assert.match(css, /\.accueil-gestes \.gros-essentiel \{[^}]*min-width: 0;[^}]*text-overflow: ellipsis;[^}]*\}/)
  assert.match(css, /\.accueil-gestes \.gros-suite \{[^}]*flex: none;[^}]*white-space: pre;[^}]*\}/)
})

test('la ligne de chaque bouton : ce qui l’attend en peu de mots, le reste à la suite', async () => {
  const { boutonDeLaCampagne, boutonDuJour, boutonDuDefi, boutonDesDuels, boutonDuCabinet } = await import(client('components/AccueilDesRoles.tsx').href)
  const ligne = (l: { detail: string; suite?: readonly string[] }) => [lisible(l.detail), ...(l.suite ?? []).map(lisible)]

  // La campagne : son palier, puis ses vies ; une épreuve laissée ou son carnet d'abord.
  const foret = { branche: 'foret', palier: 5, laissee: false }
  assert.deepEqual(ligne(boutonDeLaCampagne(undefined)), ['Une série sans fin, des portraits', ' à gagner'])
  assert.deepEqual(ligne(boutonDeLaCampagne({ vies: 12, avance: foret })), ['Palier 5 de la forêt', ' · 12 vies'])
  assert.deepEqual(ligne(boutonDeLaCampagne({ vies: 0, avance: foret })), ['Palier 5 de la forêt', ' · plus de vie', ' avant minuit'])
  assert.deepEqual(ligne(boutonDeLaCampagne({ vies: 1, avance: { branche: 'espace', palier: 13, laissee: true } })), ['Épreuve en cours', ' · 1 vie', ' · palier de maître de l’espace'])
  assert.deepEqual(ligne(boutonDeLaCampagne({ vies: 12, avance: foret, aRevoir: 7 })), ['7 questions de ton carnet', ' t’attendent', ' : revois-les pour les apprendre'])
  assert.deepEqual(ligne(boutonDeLaCampagne({ vies: 12, avance: null, aRevoir: 1 })), ['Une question de ton carnet', ' t’attend', ' : revois-la pour l’apprendre'])
  // Un nombre ne quitte pas son mot : « palier 5 », « 12 vies ».
  assert.equal(boutonDeLaCampagne({ vies: 12, avance: foret }).detail, 'Palier 5 de la forêt')
  assert.deepEqual(boutonDeLaCampagne({ vies: 12, avance: foret }).suite, [' · 12 vies'])

  // Le quiz du jour : sa série d'abord — c'est elle qu'on vient tenir.
  assert.deepEqual(ligne(boutonDuJour({ joue: false, serie: 12 })), ['Série de 12 jours'])
  assert.deepEqual(ligne(boutonDuJour({ joue: false, serie: 1 })), ['Dix questions pour tous'])
  assert.deepEqual(ligne(boutonDuJour({ joue: true, serie: 13 })), ['Joué · série de 13 jours'])
  assert.deepEqual(ligne(boutonDuJour({ joue: true, serie: 0 })), ['Joué aujourd’hui'])
  assert.deepEqual(ligne(boutonDuJour({ joue: false, serie: 12, fete: { emoji: '🎃' } })), ['🎃 Un timbre à gagner', ' · série de 12 jours'])
  assert.deepEqual(ligne(boutonDuJour({ joue: false, serie: 0, fete: { emoji: '🎃' } })), ['🎃 Un timbre à gagner'])

  // Le défi de la semaine : qui l'a relevé, le sien à reprendre, sa place.
  assert.deepEqual(ligne(boutonDuDefi(undefined)), ['La même série pour tous', ', jusqu’à dimanche'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 9 })), ['9 joueurs l’ont relevé', ' · jusqu’à dimanche'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 1 })), ['Un joueur l’a relevé', ' · jusqu’à dimanche'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 0 })), ['À toi d’ouvrir le bal', ' · jusqu’à dimanche'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 3, enCours: { justes: 4 } })), ['4 bonnes réponses', ' : reprends-le'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 3, enCours: { justes: 0 } })), ['Ton défi t’attend', ' : reprends-le'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 10, releve: { justes: 8, rang: 4 } })), ['Relevé · 4ᵉ place sur 10', ' · 8 bonnes réponses'])
  assert.deepEqual(ligne(boutonDuDefi({ joueurs: 10, releve: { justes: 2, rang: 9 } })), ['Relevé : 2 bonnes réponses'])

  // Les duels : ce qu'on lui a envoyé d'abord, puis sa ligue et sa cote — et ce que sa semaine attend encore, à la suite.
  const habituee = { cote: 1084, ligue: 'or', joues: 14, semaine: { duels: 0, ligue: 'or' } }
  assert.deepEqual(ligne(boutonDesDuels(undefined)), ['Défie qui tu veux', ', ou Automate', ' : monte de ligue'])
  // Ce que sa semaine attend encore passe devant sa ligue et sa cote : à leur suite, « · encore 3 duels pour ta récompense »
  // ne tenait sur aucun téléphone — 58 caractères pour une quarantaine —, et ne se lisait que sur une tablette (le
  // 10 novembre 2026). Son blason dit déjà sa ligue. Sa récompense acquise, sa ligue et sa cote reprennent la ligne.
  assert.deepEqual(ligne(boutonDesDuels(habituee)), ['Encore 3 duels pour ta récompense', ' · ligue d’or', ' · cote 1084'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, semaine: { duels: 2, ligue: 'or' } })), ['Encore 1 duel pour ta récompense', ' · ligue d’or', ' · cote 1084'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, semaine: { duels: 3, ligue: 'or' } })), ['Ligue d’or · cote 1084', ' · +30 confettis lundi'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, semainePassee: { ligue: 'or', confettis: 30 } })), ['+30 confettis pour ta semaine', ' en ligue d’or', ' · encore 3 duels pour la prochaine'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, enCours: { nom: 'Tom' } })), ['Ton duel contre Tom', ' t’attend'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, defisRecus: { n: 3, de: 'Hugo' } })), ['Hugo te défie, et 2 autres', ' : à toi de jouer'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, resultats: { n: 1, de: 'Hugo', code: 'K7M2QX' } })), ['Hugo a joué ton duel'])
  assert.deepEqual(ligne(boutonDesDuels({ ...habituee, resultats: { n: 3, de: 'Hugo', code: 'K7M2QX' } })), ['Hugo et 2 autres ont joué', ' tes duels'])

  // Le Cabinet : ce qu'on y gagne, ou sa traversée en route.
  assert.deepEqual(ligne(boutonDuCabinet(undefined)), ['Un légendaire au bout', ' · trois actes, trois gardiens'])
  assert.deepEqual(ligne(boutonDuCabinet({ acte: 2, coeurs: 4 })), ['Acte 2 sur 3 · 4 cœurs'])

  // La phrase reste une phrase, pour qui l'écoute : l'essentiel et ses suites se lisent d'un trait.
  assert.equal(phrase(boutonDesDuels(habituee)), 'Encore 3 duels pour ta récompense · ligue d’or · cote 1084')
  assert.equal(phrase(boutonDesDuels(undefined)), 'Défie qui tu veux, ou Automate : monte de ligue')
  assert.equal(phrase(boutonDuDefi({ joueurs: 3, enCours: { justes: 4 } })), '4 bonnes réponses : reprends-le')

  // L'essentiel tient à côté d'une pastille en 360 de large : une trentaine de caractères — au-delà, il serait coupé au
  // bout sur le petit téléphone. Mesuré au navigateur (`rendu-accueil.ts`) ; ici, la borne qui retient une phrase de trop.
  const essentiels = [
    boutonDeLaCampagne(undefined),
    boutonDeLaCampagne({ vies: 12, avance: { branche: 'mythes', palier: 12, laissee: false } }),
    boutonDeLaCampagne({ vies: 12, avance: foret, aRevoir: 24 }),
    boutonDuJour({ joue: true, serie: 365 }),
    boutonDuJour({ joue: false, serie: 0, fete: { emoji: '🎃' } }),
    boutonDuDefi(undefined),
    boutonDuDefi({ joueurs: 128 }),
    boutonDuDefi({ joueurs: 128, releve: { justes: 18, rang: 12 } }),
    boutonDesDuels(undefined),
    boutonDesDuels(habituee),
    boutonDesDuels({ ...habituee, ligue: 'diamant', cote: 2140, semaine: { duels: 3, ligue: 'diamant' } }),
    boutonDesDuels({ ...habituee, semainePassee: { ligue: 'or', confettis: 120 } }),
    boutonDuCabinet(undefined),
    boutonDuCabinet({ acte: 3, coeurs: 5 }),
  ]
  for (const l of essentiels) assert.ok([...l.detail].length <= 33, `« ${l.detail} » : ${[...l.detail].length} caractères`)
})

test('la feuille : la page tient entre le haut de l’écran et la barre du menu, ses lignes partent de 48 px et se partagent le reste', () => {
  const css = feuille()
  const bloc = (selecteur: string) => css.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?()[\]]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? ''
  // `min-height: 100dvh`, sous le retrait que la barre pose sur le corps, faisait toujours défiler la page de la hauteur de
  // la barre : l'accueil prend l'écran moins elle (et moins le bandeau du service, s'il y en a un), jusqu'à son plafond.
  // En `svh` — la barre d'adresse du navigateur dépliée, tout tient encore —, écrit sous `@supports` : en seconde
  // déclaration, le navigateur qui ne le connaît pas ne retombait pas sur le `vh` d'au-dessus (une déclaration qui lit
  // une variable se jette au calcul), et l'accueil n'avait plus de hauteur du tout.
  assert.match(bloc('body.avec-menu .accueil'), /min-height: min\(calc\(100vh - 72px - env\(safe-area-inset-bottom\) - var\(--haut-du-bandeau, 0px\)\), var\(--accueil-plafond\)\);/)
  assert.doesNotMatch(bloc('body.avec-menu .accueil'), /svh/)
  assert.match(
    css,
    /@supports \(min-height: 100svh\) \{\n  body\.avec-menu \.accueil \{ min-height: min\(calc\(100svh - 72px - env\(safe-area-inset-bottom\) - var\(--haut-du-bandeau, 0px\)\), var\(--accueil-plafond\)\); \}\n\}/,
  )
  // Une ligne ne descend pas sous 48 px, une cible de doigt ; elle part de là et grandit avec les autres.
  assert.match(bloc('.accueil'), /--accueil-rang: 48px;/)
  assert.match(bloc('.accueil-gestes .gros-bouton'), /min-height: var\(--accueil-rang\);/)
  assert.match(bloc('.jouer-carte > .gros-bouton'), /flex: 1 0 auto;/)
  assert.match(bloc('.accueil-gestes > .jouer-section'), /flex: var\(--jouer-part, 1\) 0 auto;/)
  // Trois pas de hauteur : le petit téléphone, un écran moyen, un grand — où le haut reprend ses tailles d'avant.
  const pas = [...css.matchAll(/@media \(min-height: (\d+)px\) \{\n  \.accueil \{([^}]*)\}/g)].map(m => ({ haut: Number(m[1]), rang: Number(m[2].match(/--accueil-rang: (\d+)px;/)?.[1]) }))
  assert.deepEqual(pas, [{ haut: 720, rang: 50 }, { haut: 820, rang: 54 }])
  assert.match(css, /\.accueil:not\(:has\(\.gros-principal, \.lendemain, \.installer, \.annonces-admin, \.affiche\)\) \{[^}]*--accueil-une: 5rem;[^}]*--accueil-missions: 3\.75rem;/)
  // La place gardée du haut suit ses trois tailles : rien ne saute quand « À la une » et les missions arrivent.
  assert.match(bloc('.accueil .haut-en-chemin'), /height: calc\(var\(--accueil-une\) \+ var\(--accueil-haut-ecart\) \+ var\(--accueil-missions\)\);/)
  assert.match(bloc('.accueil .haut-en-chemin.sans-une'), /height: var\(--accueil-missions\);/)
  assert.match(bloc('.accueil .une'), /height: var\(--accueil-une\);/)
  assert.match(bloc('.accueil .missions-ligne'), /min-height: var\(--accueil-missions\);/)
  // Aucun texte sous le plus petit de l'application (`--t-label`, 0,6875 rem), à aucun pas.
  const tailles = [...css.matchAll(/--accueil-(?:[a-z-]*-)?(?:titre|detail|nom): ([\d.]+)rem;/g)].map(m => Number(m[1]))
  assert.ok(tailles.length >= 12, `${tailles.length} tailles lues`)
  assert.ok(Math.min(...tailles) >= 0.6875, `la plus petite : ${Math.min(...tailles)} rem`)
  // Dans la carte, le compteur rouge se pose sur l'épaule de la pastille ronde, comme celui de « Profil » dans le menu : à
  // cheval sur le coin, il passerait sur la ligne du dessus. Et la ligne allumée garde son or, sans le halo qui mordrait
  // sur ses voisines.
  assert.match(bloc('.jouer-carte .gros-compteur'), /top: calc\(50% - var\(--accueil-icone\) \/ 2 - 6px\); right: auto; left: /)
  assert.match(bloc('.jouer-carte > .gros-bouton.gros-allume'), /animation: none;/)
  // Une soirée où revenir, sur le petit téléphone : sa ligne prend la place d'« À la une » le temps de la soirée — sans
  // elle, le bas de « Entre amis » passait sous le menu.
  assert.match(css, /@media \(max-height: 719px\) \{\n  \.accueil:has\(\.gros-principal\) \.une-cadre \{ display: none; \}\n  \.accueil:has\(\.gros-principal\) \.haut-en-chemin \{ height: var\(--accueil-missions\); \}\n\}/)
})

// La page des duels et ses écrans, rendus (les maquettes choisies par le
// propriétaire le 12 octobre 2026 — A1, C2, C5 — : « trop de texte en bas »,
// « on voit le nombre de bonnes réponses de l'adversaire avant d'avoir fait le
// quiz », « on ne sait pas si on a gagné ») : ce qu'il a en cours, dans
// l'ordre où il l'attend ; son historique, sans le résultat qu'il n'a pas
// encore vu ; sa cote sur le cadran ; la carte du verdict, scellée ou ouverte,
// et dite en une phrase ; les deux cartes d'un duel reçu, le score d'en face
// écrit nulle part.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/duels', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

/** Un duel ouvert : sa semaine entière devant lui. */
const OUVERT = 7 * 24 * 60

test('« En cours » : les résultats qu’il n’a pas vus d’abord, puis ce qui est à lui de jouer, puis ce qui attend l’autre', async () => {
  const { lignesEnCours } = await import(client('views/Duels.tsx').href)
  const duel = (code: string, nom: string, plus: object) => ({
    code,
    contre: { profileId: nom, nom, avatar: '🐻', ligue: 'or' },
    lance: true,
    categories: ['Histoire'],
    justes: null,
    sesJustes: null,
    minutesRestantes: OUVERT,
    ...plus,
  })
  const contre = [
    duel('ATTEND', 'Hugo', { justes: 6 }),
    duel('ATOI', 'Tom', { lance: false }),
    duel('VU', 'Zoé', { justes: 6, sesJustes: 4, ecart: 12, le: 1 }),
    duel('NEUF', 'Inès', { justes: 6, sesJustes: 8, ecart: -10, le: 2, nouveau: true }),
  ]
  // Le duel de Tom est aussi parmi les défis reçus : il n'y paraît qu'une fois. Celui de Léa, un défi entre amis d'avant.
  const recus = [
    { code: 'ATOI', auteur: { nom: 'Tom', avatar: '🐻' }, categories: ['Histoire'], minutesRestantes: OUVERT, classe: true },
    { code: 'AMIS', auteur: { nom: 'Léa', avatar: '🦊' }, minutesRestantes: OUVERT },
  ]
  const enCours = { serie: { id: 's', vies: 3, justes: 2, total: 4, finie: false, question: { index: 4 } }, adversaire: { nom: 'Max', avatar: '🦉' }, sesJustes: 3 }
  const lignes = lignesEnCours({ contre, enCours }, recus)
  assert.deepEqual(
    lignes.map((l: { sorte: string; nom: string; quoi: string }) => [l.sorte, l.nom, l.quoi]),
    [
      ['resultat', 'Inès', 'Histoire'],
      ['a-toi', 'Tom', 'Histoire'],
      ['a-toi', 'Léa', 'Défi entre amis'],
      ['a-toi', 'Max', 'Au hasard'],
      ['attente', 'Hugo', 'Histoire'],
    ],
    'joué des deux côtés et vu, un duel est dans l’historique',
  )
  assert.equal(lignes[0].ligue, 'or', 'l’anneau de son avatar à la couleur de sa ligue')
  assert.equal(lignes[3].code, undefined, 'le duel au hasard laissé en route se reprend : il n’a pas de page')
  assert.equal(lignes[4].reste, OUVERT, 'chez l’autre : le temps qui reste')
  assert.deepEqual(lignesEnCours({ contre: [], enCours: null }, []), [])
})

test('l’historique mêle ses duels au hasard et contre quelqu’un, du plus récent au plus ancien — sans le résultat qu’il n’a pas vu', async () => {
  const { histoireDesDuels } = await import(client('views/Duels.tsx').href)
  const rencontre = (serie: string, le: number, ecart?: number) => ({ serie, adversaire: { nom: 'Max', avatar: '🦉', justes: 8 }, justes: 9, issue: 'gagnee', le, ...(ecart !== undefined && { ecart }) })
  const contre = [
    // Pas encore vu : sa carte se retourne d'abord dans sa page — l'historique le lui soufflerait.
    { code: 'NEUF', contre: { profileId: 'i', nom: 'Inès', avatar: '🐙' }, lance: true, justes: 6, sesJustes: 8, ecart: -10, le: 50, nouveau: true, minutesRestantes: 0 },
    { code: 'VU', contre: { profileId: 'z', nom: 'Zoé', avatar: '🐯' }, lance: false, justes: 7, sesJustes: 5, ecart: 15, le: 30, minutesRestantes: 0 },
    { code: 'ROUTE', contre: { profileId: 'h', nom: 'Hugo', avatar: '🐼' }, lance: true, justes: 6, sesJustes: null, minutesRestantes: 60 },
  ]
  const h = histoireDesDuels({ dernieres: [rencontre('a', 40, 24), rencontre('b', 20, 22), { ...rencontre('c', 10), issue: null }], contre })
  assert.deepEqual(
    h.map((d: { nom: string; le: number; ecart: number; code?: string }) => [d.nom, d.le, d.ecart, d.code]),
    [
      ['Max', 40, 24, undefined],
      ['Zoé', 30, 15, 'VU'],
      ['Max', 20, 22, undefined],
    ],
  )
  assert.equal(histoireDesDuels({ dernieres: Array.from({ length: 12 }, (_, i) => rencontre(`r${i}`, i, 5)), contre: [] }).length, 10, 'ses dix derniers')
})

test('le cadran : chaque ligue ses trente degrés, la bronze depuis la cote de départ, les maîtres sur cent points', async () => {
  const { angleDeLaCote } = await import(client('views/Duels.tsx').href)
  assert.equal(angleDeLaCote(1000), 1)
  assert.equal(angleDeLaCote(850), 1, 'sous la cote de départ : au pied du cadran')
  assert.equal(angleDeLaCote(1100), 31, 'l’argent commence où la bronze finit, un degré de jour entre elles')
  assert.equal(angleDeLaCote(1150), 45)
  assert.ok(Math.abs(angleDeLaCote(1499) - 148.72) < 1e-9)
  assert.equal(angleDeLaCote(1650), 179, 'tout en haut : au bout de l’arc')
  const { resteCourt } = await import(client('views/Duel.tsx').href)
  assert.deepEqual(
    [resteCourt(5), resteCourt(90), resteCourt(6 * 24 * 60 + 30)].map((t: string) => t.replace(/\s/g, ' ')),
    ['5 min', '1 h', '6 j'],
  )
})

test('la carte du verdict : scellée quand il découvre le résultat, ouverte quand il le revoit — et dite en une phrase', async () => {
  const { VerdictDuDuel, phraseDuVerdict } = await import(client('views/Duel.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const verdict = {
    quoi: 'Cinéma',
    toi: { avatar: '🦊', justes: 8 },
    lui: { nom: 'Hugo', avatar: '🐼', justes: 6, ligue: 'platine' },
    ecart: 25,
    apres: { cote: 1146, ligue: 'argent', rang: 10 },
    semaine: { duels: 2, ligue: 'argent', confettis: 0, minutesRestantes: 600 },
  }
  const carte = (aRetourner: boolean, plus: object = {}) => renderToStaticMarkup(React.createElement(VerdictDuDuel, { verdict, dos: 'Hugo a joué', aRetourner, onFermer() {}, ...plus }))
  const scellee = carte(true, { suite: { texte: 'Revanche', icone: 'rotate', onClick() {} }, onReponses() {} })
  assert.match(scellee, /<span class="duels-carte3d">/, 'scellée : elle se retourne d’elle-même devant lui')
  assert.match(carte(false), /<span class="duels-carte3d ouverte">/, 'revue : ouverte')
  assert.match(scellee, /<p class="duels-surtitre">Duel terminé · Cinéma<\/p>/)
  assert.match(scellee, /<span class="num duels-face-titre">Victoire<\/span>/)
  assert.match(scellee, /<span class="num duels-face-score devant">8<\/span><span class="duels-face-nom">Toi<\/span>/)
  assert.match(scellee, /<span class="duels-face-avatar ligue-platine">🐼<\/span><span class="num duels-face-score">6<\/span><span class="duels-face-nom">Hugo<\/span>/)
  assert.match(scellee, /<span class="num duels-face-ecart">\+25<\/span><span class="duels-face-cote"><b class="num">1146<\/b><span>Argent · 10ᵉ<\/span><\/span>/)
  assert.match(scellee, /<span class="num duels-dos-titre">Hugo a joué<\/span><span class="duels-dos-aide">Touche pour retourner<\/span>/)
  // Sa semaine sous la carte, en losanges : deux joués, le dernier qui luit.
  assert.match(scellee, /<span class="duels-losanges" role="img" aria-label="2 duels sur 3 cette semaine"><i class="joue"><\/i><i class="joue dernier"><\/i><i><\/i><\/span>/)
  // Ce qui suit : le geste d'or, l'accueil, ses réponses ; la croix ramène à ses duels.
  assert.match(
    scellee,
    /<\/svg>Revanche<\/button><div class="duels-gestes-paire"><a class="btn duels-contour" href="\/"><svg[^>]*>.*?<\/svg>Accueil<\/a><button type="button" class="btn duels-contour"><svg[^>]*>.*?<\/svg>Réponses<\/button>/,
  )
  assert.match(scellee, /aria-label="Fermer : mes duels"/)
  assert.doesNotMatch(carte(false), /Réponses/, 'ses réponses ouvertes, le bouton s’en va')
  // Pour qui ne voit pas la carte : la phrase entière, avant elle.
  assert.match(scellee, /<p class="sr-only">Victoire/)
  assert.match(phraseDuVerdict(verdict), /^Victoire\s: 8 à 6 contre Hugo\. Ta cote\s: \+25, 1146, ligue d’argent, 10ᵉ au classement\.$/)
  // Une ligue gagnée : sa flèche sur la carte, et la phrase le dit — comme la fin d'un duel le disait.
  const promu = { ...verdict, ecart: 18, apres: { cote: 1104, ligue: 'argent', rang: 4 } }
  assert.match(renderToStaticMarkup(React.createElement(VerdictDuDuel, { verdict: promu, dos: 'x', aRetourner: false, onFermer() {} })), /<span class="duels-plus">▲ <\/span>Argent · 4ᵉ/)
  assert.match(phraseDuVerdict(promu), /Tu montes en ligue d’argent\s!$/)
  const perdu = { ...verdict, toi: { avatar: '🦊', justes: 5 }, ecart: -20, apres: { cote: 1090, ligue: 'bronze' } }
  assert.match(phraseDuVerdict(perdu), /^Défaite\s: 5 à 6 contre Hugo\. Ta cote\s: −20, 1090, ligue de bronze\. Tu redescends en ligue de bronze\.$/)
  assert.match(renderToStaticMarkup(React.createElement(VerdictDuDuel, { verdict: perdu, dos: 'x', aRetourner: false, onFermer() {} })), /<span class="duels-face-bande moins">/)
})

test('un duel reçu : sa carte face cachée — son score écrit nulle part avant sa dernière réponse —, la tienne à jouer, ce qui se joue', async () => {
  const { DuelFaceCachee } = await import(client('views/Duel.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const enjeu = { cote: 1121, gagne: 15, egalite: -1, perdu: -17 }
  const recu = {
    code: 'K7M2QX',
    auteur: { nom: 'Tom', avatar: '🐻', ligue: 'or' },
    contre: { nom: 'Léa', avatar: '🦊', toi: true, ligue: 'argent' },
    categories: ['Histoire'],
    minutesRestantes: 6 * 24 * 60 + 5,
    tentative: null,
    enjeu,
    joueurs: 0,
    lignes: [],
  }
  const rendre = (duel: object) => renderToStaticMarkup(React.createElement(DuelFaceCachee, { duel, busy: false, erreur: '', onRelever() {}, onRetour() {} }))
  // Même si une page d'avant recevait son score, la carte ne l'écrit pas.
  const html = rendre({ ...recu, aBattre: 7 })
  assert.match(html, /<p class="duels-surtitre or">Duel classé · Histoire<\/p>/)
  assert.match(
    html,
    /<span class="duels-carte-nom"><span aria-hidden="true">🐻<\/span><span>Tom<\/span><\/span><span class="num duels-carte-mystere" aria-hidden="true">\?<\/span><span class="duels-carte-sceau" role="img" aria-label="Score caché">/,
  )
  assert.doesNotMatch(html, />7</, 'son score n’est écrit nulle part')
  assert.match(html, /<span class="duels-carte duels-carte-toi ligue-argent">.*<span class="duels-carte-case">à jouer<\/span>/)
  assert.match(html, /Sa carte se retourne à ta dernière réponse\./)
  assert.match(html, /<b class="num">\+15<\/b><span>victoire<\/span>.*<b class="num">−17<\/b><span>défaite<\/span>/)
  assert.match(html, /<span class="sr-only">trois vies<\/span>.*sans chrono.*<span aria-hidden="true">6\sj<\/span><span class="sr-only">Ferme dans 6\sjours<\/span>/)
  assert.match(html, /<\/svg>Relever le duel<\/button>/)
  // Laissé en route : il le reprend, rien n'est perdu.
  assert.match(rendre({ ...recu, tentative: { id: 's', vies: 2, justes: 3, total: 5, finie: false } }), /<span class="duels-carte-case">en cours<\/span>.*Reprendre le duel<\/button>/)
  // Lancé et joué : sa carte dit son score, celle de Tom un sablier — il n'a encore rien joué —, et le verdict attend Tom.
  const lance = {
    ...recu,
    auteur: { nom: 'Léa', avatar: '🦊', toi: true, ligue: 'argent' },
    contre: { nom: 'Tom', avatar: '🐻', ligue: 'or' },
    enjeu: undefined,
    tentative: { id: 's', vies: 0, justes: 6, total: 9, finie: true },
  }
  const attend = rendre(lance)
  assert.match(attend, /<span class="duels-carte-case joue"><b class="num">6<\/b>/)
  assert.doesNotMatch(attend, /duels-carte-sceau|Relever|Reprendre|duels-jetons/)
  assert.match(attend, /Chez Tom, ton score caché\./)
  assert.match(attend, /<\/svg>Verdict quand Tom aura joué<\/p>/)
  // Fermé sans avoir été joué : il ne compte plus, rien à relever.
  assert.match(rendre({ ...recu, minutesRestantes: 0, enjeu: undefined }), /Ce duel est fermé : il ne compte plus\.|Ce duel est fermé\s: il ne compte plus\./)
})

// Le retour du propriétaire du 13 octobre 2026 : « dans le classement, j'ai
// un emoji et non mon avatar légendaire ». Partout sur les écrans des duels,
// l'avatar se porte comme au classement entier : son légendaire ou son
// portrait, sa finition, son Éclat — sans sa bordure dans un anneau, qui dit
// déjà sa ligue.
test('ce qu’il porte, partout sur la page des duels : son légendaire, pas l’emoji d’en dessous', async () => {
  const { ceQuIlPorte } = await import(client('views/Rencontre.tsx').href)
  assert.deepEqual(ceQuIlPorte({ legendaire: 'lg:phenix', finition: 'or', eclat: true, bordure: { ligue: 'or', crans: 3 } }), { finition: 'or', legendaire: 'lg:phenix', eclat: true })
  assert.equal(ceQuIlPorte({ finition: 'mat' }), undefined, 'un emoji mat : rien à porter')
  assert.equal(ceQuIlPorte(undefined), undefined)

  const { lignesEnCours, histoireDesDuels } = await import(client('views/Duels.tsx').href)
  const contre = [{ code: 'ATOI', contre: { profileId: 'tom', nom: 'Tom', avatar: '🐻', legendaire: 'br:blaireau' }, lance: false, justes: null, sesJustes: null, minutesRestantes: OUVERT }]
  const recus = [{ code: 'AMIS', auteur: { nom: 'Léa', avatar: '🦊', finition: 'or' }, minutesRestantes: OUVERT }]
  const enCours = { serie: { id: 's', vies: 3, justes: 2, total: 4, finie: false, question: { index: 4 } }, adversaire: { nom: 'Max', avatar: '🦉', legendaire: 'lg:phenix' }, sesJustes: 3 }
  assert.deepEqual(
    lignesEnCours({ contre, enCours }, recus).map((l: { apparence?: object }) => l.apparence),
    [{ legendaire: 'br:blaireau' }, { finition: 'or' }, { legendaire: 'lg:phenix' }],
  )
  const joue = [{ ...contre[0], code: 'JOUE', justes: 6, sesJustes: 4, ecart: 12, le: 1 }]
  assert.deepEqual(histoireDesDuels({ contre: joue, dernieres: [] })[0].apparence, { legendaire: 'br:blaireau' })

  // L'anneau pose l'avatar tel qu'il se porte (`Visage`) ; sans rien porté, l'emoji seul, comme avant.
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Anneau } = await import(client('views/Duel.tsx').href)
  assert.equal(renderToStaticMarkup(React.createElement(Anneau, { avatar: '🐻', apparence: { finition: 'or' } })), '<span class="duels-anneau" aria-hidden="true"><span class="av av-or"><span class="av-emoji">🐻</span></span></span>')
  assert.equal(renderToStaticMarkup(React.createElement(Anneau, { avatar: '🐻' })), '<span class="duels-anneau" aria-hidden="true">🐻</span>')

  // L'onglet du classement : chaque ligne comme au classement entier, sa bordure comprise ; le podium, ce qu'il porte.
  const page = readFileSync(client('views/Duels.tsx'), 'utf8')
  assert.match(page, /<Avatar className="duels-rang-avatar" avatar=\{l\.avatar\} finition=\{l\.finition\} legendaire=\{l\.legendaire\} eclat=\{l\.eclat\} bordure=\{l\.bordure\} \/>/)
  assert.match(page, /<Anneau key=\{l\.profileId\} avatar=\{l\.avatar\} apparence=\{ceQuIlPorte\(l\)\} ligue=\{l\.ligue\} petit \/>/)
  // La carte du verdict, les cartes d'un duel reçu, la partie elle-même : jamais l'emoji nu de qui porte quelque chose.
  const duel = readFileSync(client('views/Duel.tsx'), 'utf8')
  assert.doesNotMatch(duel, />\s*\{(v\.toi|v\.lui|enFace|moi)\.avatar\}\s*</)
  assert.doesNotMatch(readFileSync(client('views/CampagneApp.tsx'), 'utf8'), />\s*\{ecran\.(rencontre\.adversaire|contre)\.avatar\}\s*</)
})

// Les souhaits du propriétaire du 13 octobre 2026 pour l'onglet du
// classement : on le regardait sans pouvoir en rien faire. Son échelle — ceux
// à sa portée, ce qu'il gagnerait à les battre, « Défier » —, les places
// depuis lundi sur chaque ligne, et sa place parmi ses amis — ses deux places
// côte à côte, chacune l'onglet de sa liste : deux pastilles « Tous » et
// « Mes amis » au-dessus « sortaient un peu de nulle part ».
test('le classement : ses deux places, parmi tous et entre amis ; son échelle — ceux à sa portée, ce qu’il gagnerait, « Défier », un duel déjà en cours — ; les places depuis lundi', async () => {
  const { PanneauClassement, ClassementDesAmis } = await import(client('views/Duels.tsx').href)
  const { ecartSigne, siTuPerds } = await import(client('views/Rencontre.tsx').href)
  const { enjeuContre } = await import('../../shared/duels')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const ligne = (nom: string, rang: number, cote: number, plus: object = {}) => ({ profileId: nom.toLowerCase(), nom, avatar: '🐻', niveau: 3, cote, ligue: cote >= 1200 ? 'or' : 'argent', rang, duels: 12, ...plus })
  const lea = ligne('Léa', 12, 1150, { progression: 3 })
  const classement = {
    joueurs: 34,
    lignes: [ligne('Inès', 1, 1500), ligne('Hugo', 2, 1450), ligne('Zoé', 3, 1400)],
    moi: lea,
    sienne: 'léa',
    autour: [ligne('Max', 11, 1160), lea, ligne('Noé', 13, 1140)],
    progression: 3,
    aPortee: [ligne('Max', 11, 1160, { progression: -2 }), ligne('Tom', 10, 1185), ligne('Jade', 9, 1210, { progression: 1 })],
  }
  // Un duel l'attend déjà chez Tom : un seul ouvert entre eux.
  const contre = [{ code: 'TOM1', contre: { profileId: 'tom', nom: 'Tom', avatar: '🐻' }, lance: true, justes: 6, sesJustes: null, minutesRestantes: 600 }]
  const props = { maCote: { cote: 1150, joues: 30 }, contre, amis: null, onOuvrir() {}, onToutVoir() {}, onDefier() {}, onOuvrirDuel() {}, onAmis() {} }
  const html = renderToStaticMarkup(React.createElement(PanneauClassement, { classement, ...props }))
  // Ses deux places, chacune l'onglet de sa liste : parmi tous — sur combien, ses places depuis lundi, dites à
  // l'oreille —, puis entre amis, qui arrivent encore ; plus de pastilles au-dessus.
  assert.match(html, /<div class="duels-places" role="tablist" aria-label="Quel classement">/)
  assert.match(
    html,
    /<button id="duels-qui-tous" type="button" role="tab" aria-selected="true" aria-controls="duels-qui-tous-panneau" tabindex="0" class="duels-place actif" aria-label="Parmi tous : 12e sur 34, 3 places gagnées depuis lundi"><span class="duels-place-titre">Parmi tous<\/span><span class="duels-place-rang"><b class="num">12<sup>e<\/sup><\/b><span class="duels-mouvement duels-plus" aria-hidden="true">▲3<\/span><\/span><span class="duels-place-sous">sur 34<\/span><\/button>/,
  )
  assert.match(html, /<button id="duels-qui-amis" type="button" role="tab" aria-selected="false" tabindex="-1" class="duels-place" aria-label="Entre amis : chargement…">/)
  assert.match(html, /<div id="duels-qui-tous-panneau" class="duels-places-panneau" role="tabpanel" aria-labelledby="duels-qui-tous">/)
  assert.doesNotMatch(html, />(Tous|Mes amis)<\/button>/)
  // De haut en bas : ceux qu'il va chercher, le plus haut d'abord, lui, celui qui le suit.
  assert.deepEqual(
    [...html.matchAll(/<span class="duels-echelon-texte"><b>([^<]+)<\/b>/g)].map(m => m[1]),
    ['Jade', 'Tom', 'Max', 'Toi', 'Noé'],
  )
  assert.match(html, />À ta portée<\/h3>/)
  // Chacun ce qu'il gagnerait à le battre — contre sa cote, et sa part de lanceur, comme la préparation le dira —, ce
  // qu'une défaite lui ferait (le 14 octobre 2026, `duels-enjeu.test.ts`), et « Défier ».
  for (const [nom, cote] of [
    ['Jade', 1210],
    ['Max', 1160],
  ] as const) {
    const enjeu = enjeuContre({ cote: 1150 }, cote, true)
    const gain = ecartSigne(enjeu.gagne)
    assert.match(html, new RegExp(`aria-label="Défier ${nom} : \\${gain} si tu gagnes, ${siTuPerds(enjeu.perdu).replace('+', '\\+')}"`))
    assert.match(html, new RegExp(`<span class="duels-echelon-gain">\\${gain} si tu gagnes</span>`))
  }
  assert.match(html, /aria-label="Ton duel contre Tom, en cours"/, 'déjà défié : son duel, pas un second')
  assert.equal(html.match(/class="duels-echelon-geste"/g)?.length, 2, 'ni lui ni celui qui le suit ne se défient d’ici')
  // Les places depuis lundi, sur chaque ligne qui en a bougé — et dites à l'oreille.
  assert.match(html, /<span class="duels-mouvement duels-moins" aria-hidden="true">▼2<\/span>/)
  assert.match(html, /<span class="duels-mouvement duels-plus" aria-hidden="true">▲1<\/span>/)
  assert.match(html, /aria-label="La carte de Max — rang 11, ligue d’argent, cote 1160, 2 places perdues depuis lundi"/)
  // En tête : ceux qui le talonnent.
  const tete = renderToStaticMarkup(
    React.createElement(PanneauClassement, {
      classement: { ...classement, moi: undefined, sienne: 'inès', autour: [classement.lignes[0], classement.lignes[1]], progression: 0, aPortee: [classement.lignes[1], classement.lignes[2]], enTete: true },
      ...props,
    }),
  )
  assert.match(tete, />Ils te talonnent<\/h3>/)
  assert.match(tete, /aria-label="Parmi tous : 1re sur 34"><span class="duels-place-titre">Parmi tous<\/span><span class="duels-place-rang"><b class="num">1<sup>re<\/sup><\/b><\/span>/)
  assert.deepEqual(
    [...tete.matchAll(/<span class="duels-echelon-texte"><b>([^<]+)<\/b>/g)].map(m => m[1]),
    ['Toi', 'Hugo', 'Zoé'],
  )
  // Pas encore classé, sa cote au-dessus de tous : ceux qui le suivent, le plus proche en haut — à l'envers, l'échelle
  // montait —, et sa place dit pourquoi elle manque.
  const neuf = renderToStaticMarkup(
    React.createElement(PanneauClassement, {
      classement: { joueurs: 2, lignes: [ligne('Noé', 1, 990), ligne('Zoé', 2, 980)], aPortee: [ligne('Noé', 1, 990), ligne('Zoé', 2, 980)] },
      ...props,
      maCote: { cote: 1000, joues: 0 },
    }),
  )
  assert.deepEqual(
    [...neuf.matchAll(/<span class="duels-echelon-texte"><b>([^<]+)<\/b>/g)].map(m => m[1]),
    ['Noé', 'Zoé'],
  )
  assert.match(neuf, /aria-label="Parmi tous : pas encore classé"><span class="duels-place-titre">Parmi tous<\/span><span class="duels-place-rang"><b class="num">–<\/b><\/span><span class="duels-place-sous">pas encore classé<\/span>/)

  // Parmi ses amis classés : rang partagé (invariant 15), sans les flèches du classement de tous — sa place dans la
  // carte, leurs lignes comme son échelle, sans « Défier » : sa carte le porte.
  const amis = {
    amis: [
      { profileId: 'tom', nom: 'Tom', avatar: '🐻', cote: 1185, ligue: 'argent', rang: 10 },
      { profileId: 'max', nom: 'Max', avatar: '🦉', cote: 1150, ligue: 'argent', rang: 12 },
      { profileId: 'ines', nom: 'Inès', avatar: '🐙' },
    ],
    recus: [],
  }
  assert.match(
    renderToStaticMarkup(React.createElement(PanneauClassement, { classement, ...props, amis })),
    /aria-label="Entre amis : 2e sur 3"><span class="duels-place-titre">Entre amis<\/span><span class="duels-place-rang"><b class="num">2<sup>e<\/sup><\/b><\/span><span class="duels-place-sous">sur 3<\/span>/,
  )
  const entreAmis = renderToStaticMarkup(React.createElement(ClassementDesAmis, { amis, sienne: lea, onOuvrir() {}, onAmis() {} }))
  assert.deepEqual(
    [...entreAmis.matchAll(/<span class="num duels-rang-place">(\d+)<\/span>.*?<span class="duels-echelon-texte"><b>([^<]+)<\/b>/g)].map(m => [Number(m[1]), m[2]]),
    [
      [1, 'Tom'],
      [2, 'Toi'],
      [2, 'Max'],
    ],
  )
  assert.doesNotMatch(entreAmis, /duels-mouvement|duels-echelon-geste/)
  assert.match(entreAmis, /Et un qui n’a pas joué de duel ces quatre dernières semaines\./)
  // Sans ami : sa place le dit, et sa liste comment en ajouter.
  assert.match(renderToStaticMarkup(React.createElement(PanneauClassement, { classement, ...props, amis: { amis: [], recus: [] } })), /aria-label="Entre amis : aucun ami"/)
  assert.match(renderToStaticMarkup(React.createElement(ClassementDesAmis, { amis: { amis: [], recus: [] }, sienne: lea, onOuvrir() {}, onAmis() {} })), /Ajouter des amis<\/button>/)
})

// Le retour du propriétaire du 15 octobre 2026 : « on peut défier nos amis /
// global depuis la carte, mais potentiellement on a déjà un duel engagé et ça
// ne nous prévient pas » ; « dans le classement, quand on ouvre le classement
// complet, c'est pareil : on n'a pas d'indication si on les combat ». La carte
// disait « Défier », et le refus d'un second duel ne tombait qu'au bout de la
// préparation (`duels-contre.test.ts`, la règle côté serveur).
test('un duel déjà ouvert entre eux : sa carte le dit à la place de « Défier » et le rouvre ; le classement entier et ses amis le marquent', async () => {
  const { GestesVue } = await import(client('components/GestesDuJoueur.tsx').href)
  const { FeuilleDuClassement, ClassementDesAmis, PanneauClassement, duelEnRouteAvec } = await import(client('views/Duels.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const tom = { profileId: 'tom', nom: 'Tom', avatar: '🐻', cote: 1185, ligue: 'argent', rang: 10 }
  const ouverts: string[] = []
  const carte = (enCours?: object, joueur: object = tom) =>
    renderToStaticMarkup(
      React.createElement(GestesVue, {
        joueur,
        enjeu: { cote: 1150, gagne: 19, egalite: 8, perdu: 2 },
        enCours,
        aConfirmer: false,
        busy: false,
        erreur: '',
        onDefier() {},
        onOuvrirDuel: (code: string) => ouverts.push(code),
        onAjouter() {},
        onRetirer() {},
        onConfirmer() {},
        onGarder() {},
      }),
    )

  // Aucun duel entre eux : « Défier », et ce qu'il mettrait en jeu.
  assert.match(carte(), /<span class="carte-gestes-nom">Défier Tom<\/span>/)
  assert.match(carte(), /En jeu/)
  // Un duel ouvert : où il en est d'abord, puis ce qui le rouvre — à lui de jouer, en grand ; chez Tom, en retrait. Ni un
  // second « Défier », que le serveur refuserait au bout de la préparation, ni l'enjeu d'un duel qui ne se lancera pas.
  for (const [enCours, phrase, bouton] of [
    [{ ou: 'a-finir', code: 'K7M2QX' }, 'Un duel est en cours entre vous : il partira à Tom à ta dernière réponse.', '<button type="button" class="btn btn-primary btn-block"><svg[^>]*>.*?</svg>Reprendre ton duel</button>'],
    [{ ou: 'chez-l-autre', code: 'K7M2QX' }, 'Un duel est en cours entre vous : il attend que Tom le joue.', '<button type="button" class="btn btn-block"><svg[^>]*>.*?</svg>Voir ton duel</button>'],
    [{ ou: 'a-relever', code: 'K7M2QX' }, 'Tom te défie : à toi de jouer.', '<button type="button" class="btn btn-primary btn-block"><svg[^>]*>.*?</svg>Relever son duel</button>'],
  ] as const) {
    const html = carte(enCours)
    assert.match(html, new RegExp(`<footer class="carte-gestes"><p class="small carte-gestes-duel">${phrase}</p>${bouton}`), enCours.ou)
    assert.doesNotMatch(html, /Défier Tom|En jeu/, enCours.ou)
    assert.match(html, /Ajouter à mes amis/, 'l’ajouter reste là')
  }
  // Pas encore parti, ou retenu : il n'est pas à lui — sans code, rien à rouvrir ; la phrase dit quoi faire.
  const aVenir = carte({ ou: 'a-venir' })
  assert.match(aVenir, /<footer class="carte-gestes"><p class="small carte-gestes-duel">Tom te défie : son duel t’arrivera à sa dernière réponse\.<\/p><button type="button" class="btn btn-block"><svg[^>]*>.*?<\/svg>Ajouter à mes amis<\/button><\/footer>/)
  assert.match(carte({ ou: 'retenu' }), /<p class="small carte-gestes-duel">Tom te défie : remets ce profil dans tes amis pour recevoir son duel\.<\/p><button type="button" class="btn btn-block"><svg[^>]*>.*?<\/svg>Ajouter à mes amis<\/button>/)
  // Au présent : « t'a défié » accordait le participe à qui lit la carte, sans rien savoir de lui.
  assert.doesNotMatch(aVenir, /t’a défié/)
  // Un état qu'elle ne connaît pas (un serveur plus récent) : « Défier », et le serveur dira le refus.
  assert.match(carte({ ou: 'inconnu', code: 'K7M2QX' }), /Défier Tom/)
  // La carte le rouvre par son code : la page des duels ici même, sinon son adresse.
  const gestes = readFileSync(client('components/GestesDuJoueur.tsx'), 'utf8')
  assert.match(gestes, /onClick=\{\(\) => onOuvrirDuel\?\.\(code\)\}/)
  assert.match(gestes, /if \(gestes\.onOuvrirDuel\) \{\s*onFermer\(\)\s*gestes\.onOuvrirDuel\(code\)\s*return\s*\}\s*window\.location\.assign\(`\$\{PAGE_DES_DUELS\}\$\{adresseDuDuel\(code\)\}`\)/)
  // Retenu, le remettre dans ses amis le lui fait parvenir : la carte se relit, pour le rouvrir d'ici.
  assert.match(gestes, /if \(ajouter && enCours\?\.ou === 'retenu'\) \{\s*void api\.duels\s*\.joueur\(joueur\.profileId\)\s*\.then\(setFace\)/)
  assert.match(readFileSync(client('views/Amis.tsx'), 'utf8'), /useCarteDUnProfil\(\{\s*onDefier,\s*onOuvrirDuel,/, 'de la feuille des amis aussi')

  // Le classement entier : un sablier après le nom de qui il affronte déjà, dit à l'oreille — et sous la liste.
  const ligne = (nom: string, rang: number, cote: number) => ({ profileId: nom.toLowerCase(), nom, avatar: '🐻', niveau: 3, cote, ligue: cote >= 1200 ? 'or' : 'argent', rang, duels: 12 })
  const classement = { joueurs: 3, lignes: [ligne('Inès', 1, 1500), ligne('Tom', 2, 1240), ligne('Léa', 3, 1150)], sienne: 'léa' }
  const duel = (code: string, profileId: string, plus: object = {}) => ({ code, contre: { profileId, nom: profileId, avatar: '🐻' }, lance: true, justes: 6, sesJustes: null, minutesRestantes: 600, ...plus })
  const feuille = (contre?: object[]) => renderToStaticMarkup(React.createElement(FeuilleDuClassement, { classement, ...(contre && { contre }), onOuvrir() {}, onFermer() {} }))
  const avecTom = feuille([duel('TOM1', 'tom')])
  assert.match(
    avecTom,
    /<button type="button" class="lb-row lb-ouvrable duels-ligne" aria-label="La carte de Tom — rang 2, ligue d’or, cote 1240, un duel en cours entre vous">.*?<span class="lb-name">Tom<\/span><span class="duels-ligne-en-cours" aria-hidden="true"><svg/,
  )
  assert.equal(avecTom.match(/duels-ligne-en-cours/g)?.length, 1, 'Inès, qu’il n’affronte pas, rien')
  assert.match(avecTom, /<p class="muted small duels-legende-en-cours"><svg[^>]*>.*?<\/svg>un duel en cours entre vous : sa carte le rouvre<\/p>/)
  // Joué des deux côtés, ou fermé : plus en cours — ni sablier ni légende ; sans ses duels (une page d'avant), rien.
  for (const sans of [feuille([duel('TOM1', 'tom', { sesJustes: 4 })]), feuille([duel('TOM1', 'tom', { minutesRestantes: 0 })]), feuille()]) {
    assert.doesNotMatch(sans, /duels-ligne-en-cours|duels-legende-en-cours|un duel en cours/)
  }
  // À lui de jouer aussi : celui qu'on lui a lancé, ou le sien laissé en route.
  assert.equal(duelEnRouteAvec([duel('TOM1', 'tom', { lance: false, justes: null })], 'tom')?.code, 'TOM1')
  assert.equal(duelEnRouteAvec([duel('TOM1', 'tom')], 'ines'), undefined)

  // Entre amis : « En cours » sur l'ami qu'il affronte déjà, qui le rouvre — comme son échelle ; les autres, rien.
  const amis = { amis: [{ ...tom, cote: 1240, ligue: 'or', rang: 2 }, { profileId: 'max', nom: 'Max', avatar: '🦉', cote: 1100, ligue: 'argent', rang: 4 }], recus: [] }
  const entreAmis = renderToStaticMarkup(React.createElement(ClassementDesAmis, { amis, sienne: ligne('Léa', 3, 1150), contre: [duel('TOM1', 'tom')], onOuvrir() {}, onOuvrirDuel() {}, onAmis() {} }))
  assert.match(entreAmis, /<button type="button" class="duels-echelon-geste en-cours" aria-label="Ton duel contre Tom, en cours"><svg[^>]*>.*?<\/svg>En cours<\/button>/)
  assert.equal(entreAmis.match(/duels-echelon-geste/g)?.length, 1, 'ni Max ni lui')
  // Parmi tous : celui qui le suit aussi — on ne le défie pas d'ici, mais on le voit.
  const lea = ligne('Léa', 12, 1150)
  const parmiTous = renderToStaticMarkup(
    React.createElement(PanneauClassement, {
      classement: { joueurs: 34, lignes: [ligne('Inès', 1, 1500)], moi: lea, sienne: 'léa', autour: [ligne('Max', 11, 1160), lea, ligne('Noé', 13, 1140)], aPortee: [ligne('Max', 11, 1160)] },
      maCote: { cote: 1150, joues: 30 },
      contre: [duel('NOE1', 'noé', { lance: false, justes: null })],
      amis: null,
      onOuvrir() {},
      onToutVoir() {},
      onDefier() {},
      onOuvrirDuel() {},
      onAmis() {},
    }),
  )
  assert.match(parmiTous, /aria-label="Ton duel contre Noé, en cours"/)
  assert.match(parmiTous, /aria-label="Défier Max : /, 'Max, à sa portée, se défie toujours')

  // La page passe ses duels à la feuille du classement, et rouvre un duel touché sur une carte.
  const page = readFileSync(client('views/Duels.tsx'), 'utf8')
  assert.match(page, /<FeuilleDuClassement classement=\{etat\.classement\} contre=\{etat\.contre\} /)
  assert.match(page, /<ClassementDesAmis amis=\{amis\} sienne=\{sienne\} contre=\{contre\} onOuvrir=\{onOuvrir\} onOuvrirDuel=\{onOuvrirDuel\} onAmis=\{onAmis\} \/>/)
  assert.deepEqual(ouverts, [], 'rendre la carte ne rouvre rien')

  // La préparation : « Choisir » un ami qu'il affronte déjà, ou l'ouvrir à son adresse, menait au refus du serveur après
  // « Jouer le duel ». Le duel se dit sous lui, à la place des jetons d'un second, et « Jouer le duel » attend.
  const { LancerUnDefi } = await import(client('views/LancerUnDefi.tsx').href)
  const preparer = (enCours?: object | null) =>
    renderToStaticMarkup(
      React.createElement(LancerUnDefi, {
        amis: [],
        categoriesJouables: ['Histoire'],
        sujets: [],
        depart: { categories: [], sujet: null, adversaire: tom, moi: { cote: 1150, joues: 30 }, ...(enCours !== undefined && { enCours }) },
        busy: false,
        erreur: '',
        onLancer() {},
        onOuvrirDuel() {},
        onRetour() {},
      }),
    )
  const dejaChezTom = preparer({ ou: 'chez-l-autre', code: 'K7M2QX' })
  assert.match(dejaChezTom, /<div class="defier-deja"><p class="small">Un duel est en cours entre vous : il attend que Tom le joue\.<\/p><button type="button" class="btn btn-small"><svg[^>]*>.*?<\/svg>Voir ton duel<\/button><\/div>/)
  assert.doesNotMatch(dejaChezTom, /duels-jetons/, 'ni ce qu’un second duel mettrait en jeu')
  assert.match(dejaChezTom, /<button type="button" class="btn btn-primary btn-big btn-block" aria-disabled="true">/)
  assert.match(dejaChezTom, /Un seul duel à la fois entre vous : choisis quelqu’un d’autre, ou attends que celui-ci soit joué\./)
  // À lui de jouer : le geste en or ; pas encore parti, rien à rouvrir : la phrase seule.
  assert.match(preparer({ ou: 'a-relever', code: 'K7M2QX' }), /<button type="button" class="btn btn-primary btn-small"><svg[^>]*>.*?<\/svg>Relever son duel<\/button>/)
  assert.match(preparer({ ou: 'a-venir' }), /<div class="defier-deja"><p class="small">Tom te défie : son duel t’arrivera à sa dernière réponse\.<\/p><\/div>/)
  // Aucun — lu, ou pas encore lu : les jetons, et « Jouer le duel » se touche.
  for (const libre of [preparer(null), preparer()]) {
    assert.match(libre, /duels-jetons/)
    assert.doesNotMatch(libre, /defier-deja|class="btn btn-primary btn-big btn-block" aria-disabled="true"/)
  }
  // Chacun qu'il choisit se lit — son duel ouvert avec, et sa cote s'il ne l'a pas ; la page le lit avec sa cote à son
  // adresse, et rouvre le duel ici même.
  const campagne = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(campagne, /<laPreparation\.LancerUnDefi(?:(?!\/>)[\s\S])*?onOuvrirDuel=\{code => void ouvrirLeDuel\(code\)\}/)
})

// Les souhaits du propriétaire du 13 octobre 2026 : le dé « tout le temps
// disponible » — il ne paraissait que s'il restait une série d'un autre à
// affronter —, puis contre Automate seulement — la série d'un ami qui n'était
// pas là, sous son profil, « c'est trompeur ». Il se dit pour ce qu'il est.
test('le dé est toujours là, à côté de « Défier », et se dit contre Automate', async () => {
  const page = readFileSync(client('views/Duels.tsx'), 'utf8')
  assert.match(page, /Défier\s*<\/button>\s*<button\s+type="button"\s+className=\{'duels-hasard' \+ \(roule \? ' roule' : ''\)\}/, 'jamais sous une condition')
  assert.doesNotMatch(readFileSync(client('../../shared/duels.ts'), 'utf8'), /auHasard/)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { DuelsEnChemin, CommentCaMarche } = await import(client('views/Duels.tsx').href)
  assert.match(renderToStaticMarkup(React.createElement(DuelsEnChemin)), /class="duels-hasard" aria-label="Un duel contre Automate"/)
  // Ce qu'il est se dit : un adversaire simulé, de son niveau — dans les règles, pendant la partie, après elle.
  // Et ce qu'il apprend : il joue comme qui le lance, tel que ses réponses de campagne le disent (le modèle du savoir).
  const regles = renderToStaticMarkup(React.createElement(CommentCaMarche))
  // Sur ce qu'on choisit, à chances égales, depuis le 16 octobre 2026 (`duels-de.test.ts`).
  assert.match(regles, /Pressé\s\? Le dé\s: Automate, tout de suite, sur ce que tu choisis — un adversaire simulé de ton niveau, qui apprend de tes réponses de campagne et rate où tu rates\. Un duel à chances égales/)
  assert.doesNotMatch(regles, /la série d’un joueur|Toutes affrontées/, 'plus la série d’un autre')
  const partie = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(partie, /ecran\.rencontre\.adversaire\.simule && <span className="muted small">simulé, de ton niveau<\/span>/)
  assert.match(partie, /\{ texte: 'Un autre duel', icone: 'dice', onClick: \(\) => setDeOuvert\(true\) \}/)
  assert.doesNotMatch(partie + page, /Un autre adversaire|Un adversaire au hasard/)
})

// Les choix du propriétaire du 17 octobre 2026 : « je veux aussi ne pas
// pouvoir retomber en or en platine et à partir de platine c'est là que ça
// commence vraiment » ; puis un bronze qui ne coûte plus « −19 » en platine.
// Les règles l'écrivent en toutes lettres : chaque ligue gardée
// (`LIGUES_GARDEES`), qu'un joueur plus bas compte comme s'il y était
// (`apresLeDuel`), et celle où commence l'ELO (`LIGUE_DE_L_ELO`).
test('les règles disent les ligues qui ne se perdent plus, ce que vaut un joueur plus bas, et où l’ELO commence', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { CommentCaMarche } = await import(client('views/Duels.tsx').href)
  const { LIGUES_GARDEES, LIGUE_DE_L_ELO, ligueParCle } = await import('../../shared/duels')
  const regles = renderToStaticMarkup(React.createElement(CommentCaMarche))
  assert.match(regles, /En or, chaque duel rapporte \+1, et à chances égales, une défaite coûte moins qu’une victoire ne rapporte\./)
  const phrase =
    /L’argent, l’or et la platine, une fois atteints, ne se perdent plus\s; contre un joueur plus bas, tu joues comme s’il y était aussi — sa cote dit qu’il a peu joué, pas qu’il joue moins bien\. À partir de la platine, c’est ton niveau qui parle\s: une défaite coûte à peu près ce qu’une victoire rapporte\./.exec(
      regles,
    )
  assert.ok(phrase, 'les ligues gardées, puis l’ELO')
  for (const cle of LIGUES_GARDEES) assert.match(phrase[0], new RegExp(`l’${ligueParCle(cle).court}|la ${ligueParCle(cle).court}`, 'i'))
  assert.match(phrase[0], new RegExp(`à partir de la ${ligueParCle(LIGUE_DE_L_ELO).court}`, 'i'))
})

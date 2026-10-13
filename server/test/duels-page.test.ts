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

// Les mots du jeu solo (l'experte du jeu solo, le 11 octobre 2026 :
// `retours/2026-10-11/experts/nouveautes-solo.md`, « Les mots qu'un joueur ne
// comprend pas ») : « Bérénice s'était arrêté avant », « plus que 1 vie », un
// « Tour du monde » qui est aussi le sentier de la culture générale, « Ma
// carte », qui n'existe plus, une vitrine « décernée à la fin de chaque
// soirée » à qui ne joue qu'en solo, un défi « relevé » par son propre auteur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const source = (f: string) => readFileSync(client(f), 'utf8')

test('après une faute : « plus qu’une vie », jamais « plus que 1 vie »', async () => {
  const { viesApresUneFaute } = await import(client('views/CampagneApp.tsx').href)
  assert.equal(viesApresUneFaute(2), 'plus que 2 vies')
  assert.equal(viesApresUneFaute(1), 'plus qu’une vie')
  assert.equal(viesApresUneFaute(0), 'c’était ta dernière vie')
})

test('« le haut fait du Tour du monde », jamais le Tour du monde seul : c’est aussi le sentier de la culture générale', async () => {
  const { RecordsParCategorie } = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const categories = ['Histoire', 'Sport', 'Cuisine']
  const records = (r: { categorie: string; record: number }[]) => renderToStaticMarkup(React.createElement(RecordsParCategorie, { records: r, categories }))
  const un = records([{ categorie: 'Histoire', record: 12 }])
  assert.match(un, />haut fait du Tour du monde : 1 sur 3</)
  assert.match(un, /et le haut fait du Tour du monde est à toi\./)
  assert.match(records([{ categorie: 'Histoire', record: 12 }, { categorie: 'Sport', record: 10 }]), />haut fait du Tour du monde : 2 sur 3</)
  assert.match(records(categories.map(categorie => ({ categorie, record: 10 }))), />le haut fait du Tour du monde est à toi</)
  assert.doesNotMatch(source('views/CampagneApp.tsx'), /`Tour du monde : /, 'plus de « Tour du monde : 1 sur 3 » seul')
})

test('une série laissée avant sa première bonne réponse se reprend, sans « · 0 bonne »', () => {
  assert.match(
    source('views/CampagneApp.tsx'),
    /etat\.enCours\.justes > 0 \? `Reprendre ma série · \$\{etat\.enCours\.justes\} bonne\$\{etat\.enCours\.justes > 1 \? 's' : ''\}` : 'Reprendre ma série'/,
  )
})

test('un prénom ne dit pas « il » ou « elle » : la rencontre, les duels, les notifications', async () => {
  const campagne = source('views/CampagneApp.tsx')
  assert.match(campagne, /\$\{ecran\.rencontre\.adversaire\.nom\} n’avait pas joué celle-ci\./)
  assert.doesNotMatch(campagne, /s’était arrêté avant/)
  // Le duel qu'il a lancé, qui attend l'autre : son prénom, jamais « il » (la maquette C2 du 12 octobre 2026).
  const duel = source('views/Duel.tsx')
  assert.match(duel, /`Chez \$\{enFace\.nom\}, ton score caché\.`/)
  assert.match(duel, /`Verdict quand \$\{enFace\.nom\} aura joué`/)
  assert.match(duel, /`Tu joues d’abord : le duel part à \$\{enFace\.nom\} à ta dernière réponse\.`/)
  assert.doesNotMatch(duel, /quand il l’aura joué|quand il aura joué/)
  // « Comment ça marche ? » des duels : « quelqu'un », puis plus de « il ».
  const { CommentCaMarche } = await import(client('views/Duels.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const regles = renderToStaticMarkup(React.createElement(CommentCaMarche))
  assert.match(regles, /Tu joues d’abord, le duel lui part à ta dernière réponse/)
  assert.match(regles, /À ta dernière réponse, le duel part dans ses duels, et son accueil le lui dit/)
  assert.match(regles, /Le duel joué des deux côtés, vos deux cotes bougent/)
  // Plus de notification pour les duels (le 13 octobre 2026) : les règles n'en promettent pas.
  assert.doesNotMatch(regles, /s’il a activé|Quand il l’a joué|il reçoit le duel|téléphone|notification/)
  assert.doesNotMatch(source('views/Duels.tsx'), /il reçoit le duel/)
})

test('son propre défi se joue, il ne se relève pas : la page compte ceux qui l’ont joué', () => {
  const duel = source('views/Duel.tsx')
  assert.match(duel, /duel\.joueurs === 0 \? 'personne ne l’a joué' : duel\.joueurs > 1 \? 'joueurs l’ont joué' : 'joueur l’a joué'/)
  assert.doesNotMatch(duel, /'joueur l’a relevé'/, '« 1 joueur l’a relevé » : l’auteur seul')
})

test('ce qui se porte se règle sous « M’habiller » ; la vitrine se gagne aussi en solo', () => {
  const collection = source('components/Collection.tsx')
  assert.match(collection, /ce qui est à toi se porte depuis « M’habiller », sur ton profil\./)
  assert.doesNotMatch(collection, /se porte dans « Mon avatar », « Ma carte »/, '« Ma carte » n’existe plus : chaque pièce a sa page')
  const atlas = source('components/TropheesAtlas.tsx')
  assert.match(atlas, /Ils se gagnent en soirée, au quiz du jour et en campagne, et certains réveillent un légendaire\./)
  assert.doesNotMatch(atlas, /se décernent à la fin de chaque soirée/)
})

test('le carnet reprend « à la question 2 » : une position, pas des bonnes réponses', () => {
  const carnet = source('views/Carnet.tsx')
  assert.match(carnet, /`Reprendre à la question \$\{enCours\.question!\.index \+ 1\}`/)
  assert.doesNotMatch(carnet, /`Reprendre · \$\{/, '« Reprendre · 2 sur 10 » se lisait comme les « 5 bonnes sur 6 » du sentier')
})

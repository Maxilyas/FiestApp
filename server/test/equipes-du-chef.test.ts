// Les équipes au téléphone du chef (la remarque du propriétaire du dépôt, le
// 4 octobre 2026) : « on ne peut pas créer d'équipe facilement » — « Ajouter
// une équipe » dans « ⋯ » de sa barre, qui ouvre une feuille pour son nom et
// son emoji ; une équipe se renomme d'un toucher ; et rien sous les équipes
// au choix d'équipe, sobre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, { React })
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const rendu = async (fichier: string, nom: string, props: object) => {
  const module = await import(client(fichier).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[nom], props))
}
const equipe = (id: string, name: string, emoji: string, memberCount = 0) =>
  ({ id, name, emoji, position: 0, memberCount, total: 0, average: 0, bonus: 0 })
const rien = () => {}

test('« Nouvelle équipe » : un nom, un emoji qu’aucune ne porte encore, et rien qui parte sans nom', async () => {
  const html = await rendu('components/FeuilleDEquipe.tsx', 'FeuilleDEquipe', {
    equipes: [equipe('a', 'Les Salseras', '💃')],
    onCreer: rien,
    onModifier: rien,
    onRetirer: rien,
    onFermer: rien,
  })
  assert.match(html, /aria-label="Nouvelle équipe"/)
  assert.match(html, /<input class="input" maxLength="20" placeholder="Les Renards" value=""\/>/)
  assert.doesNotMatch(html, /autofocus/i, 'le clavier cacherait l’aperçu')
  assert.match(html, /class="equipe-emoji active" aria-pressed="true">🕺</, 'le premier emoji libre, pas celui des Salseras')
  assert.match(html, /<button type="submit" form="feuille-equipe" class="btn btn-primary btn-block" disabled="">Créer l’équipe<\/button>/)
  assert.doesNotMatch(html, /Supprimer/)
})

test('renommer une équipe : son nom et son emoji d’abord, et de quoi la supprimer', async () => {
  const html = await rendu('components/FeuilleDEquipe.tsx', 'FeuilleDEquipe', {
    equipe: equipe('a', 'Les Licornes', '🦄'),
    equipes: [equipe('a', 'Les Licornes', '🦄')],
    onCreer: rien,
    onModifier: rien,
    onRetirer: rien,
    onFermer: rien,
  })
  assert.match(html, /aria-label="L’équipe"/)
  assert.match(html, /value="Les Licornes"/)
  assert.match(html, /class="equipe-emoji active" aria-pressed="true">🦄</, 'son emoji, même hors de la palette')
  assert.match(html, />Enregistrer<\/button>/)
  assert.match(html, /geste-qui-defait[\s\S]*Supprimer l’équipe/)
})

test('la barre du chef : ses équipes dans « ⋯ », un toucher pour renommer, « Ajouter une équipe » — et deux par défaut', () => {
  const barre = readFileSync(client('components/BarreDuChef.tsx'), 'utf8')
  assert.match(barre, /\(reglages\.equipes \|\| c\.snapshot\.teams\.length > 0\) && \(\s*<section className="equipes-du-chef"/)
  assert.match(barre, /aria-label=\{`Renommer \$\{t\.name\}`\}/)
  assert.match(barre, /c\.snapshot\.teams\.length < MAX_EQUIPES && \([\s\S]*?Ajouter une équipe/)
  assert.match(barre, /onCreer=\{creerEquipe\}\s*onModifier=\{modifierEquipe\}\s*onRetirer=\{retirerEquipe\}/)
  const liaison = readFileSync(client('socketDuChef.ts'), 'utf8')
  assert.match(liaison, /socket\?\.emit\('host:seedTeams', \{ count: 2 \}\)/, 'deux équipes d’office, pas six')
  assert.match(liaison, /socket\?\.emit\('host:createTeam', \{ name, emoji \}\)/)
  assert.match(liaison, /socket\?\.emit\('host:updateTeam', \{ teamId, name, emoji \}\)/)
  assert.match(liaison, /socket\?\.emit\('host:removeTeam', \{ teamId \}\)/)
})

test('le choix d’équipe : l’emoji, le nom, les avatars de ceux qui y sont — et pas une ligne de texte dessous', async () => {
  const players = [
    { id: 's', name: 'Sofia', avatar: '🐼', score: 0, teamId: 'a' },
    { id: 'h', name: 'Hugo', avatar: '🦊', score: 0, teamId: 'a' },
    { id: 'c', name: 'Camille', nomAffiche: 'Camille (2)', avatar: '🐸', score: 0, teamId: null },
  ]
  const html = await rendu('components/TeamPicker.tsx', 'TeamPicker', {
    teams: [equipe('a', 'Les Aigles', '🦅', 2), equipe('z', 'Les Zèbres', '🦓', 0)],
    value: 'a',
    onPick: rien,
    players,
  })
  const visible = html.replace(/<span class="sr-only">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  assert.equal(visible, '🦅 Les Aigles 🐼 🦊 🦓 Les Zèbres', 'ni « personne », ni « 2 joueurs », ni les prénoms à lire')
  assert.match(html, /<span class="sr-only">, avec Sofia, Hugo<\/span>/, 'l’oreille sait qui y est')
  assert.match(html, /title="Sofia, Hugo"/)
  assert.match(html, /team-btn selected[\s\S]*team-btn-check/, 'la choisie porte sa coche')
})

// La tablée du 9 novembre 2026 : la télé branchée avait ouvert la salle avant
// « Ouvrir le salon », quatre invités sur six étaient entrés avant les
// équipes, et rien ne les invitait à en choisir une — une carte de plus sous
// le classement, un bouton discret, puis plus rien une fois le quiz parti.
test('des équipes formées après son entrée : la salle d’attente invite à choisir la sienne, tant que rien n’est joué', async () => {
  const { choixDEquipeOuvert } = await import('../../shared/teams')
  const avantLeQuiz = { equipes: 2, aUneEquipe: false, quizEnCours: false, horsClassement: false, soireeCommencee: false }
  assert.equal(choixDEquipeOuvert(avantLeQuiz), true, 'le choix s’ouvre de lui-même')
  assert.equal(choixDEquipeOuvert({ ...avantLeQuiz, equipes: 0 }), false, 'pas d’équipes, rien à choisir')
  assert.equal(choixDEquipeOuvert({ ...avantLeQuiz, aUneEquipe: true }), false, 'qui a la sienne garde « Changer »')
  assert.equal(choixDEquipeOuvert({ ...avantLeQuiz, quizEnCours: true }), false, 'on ne change pas de camp en plein quiz')
  assert.equal(choixDEquipeOuvert({ ...avantLeQuiz, horsClassement: true }), false, 'le chef qui anime seulement ne compte pour personne')
  // Une fois des points marqués, le choix ne s'ouvre plus seul : rejoindre
  // une équipe après un podium retournait le vainqueur annoncé. Le bouton reste.
  assert.equal(choixDEquipeOuvert({ ...avantLeQuiz, soireeCommencee: true }), false)

  const page = readFileSync(client('views/PlayerApp.tsx'), 'utf8')
  assert.ok(
    /const invite = choixDEquipeOuvert\(\{\s*equipes: teams\.length,\s*aUneEquipe: !!myTeam,\s*quizEnCours: !!session,\s*horsClassement: !!me\?\.horsClassement,\s*soireeCommencee: snap\.players\.some\(p => p\.score > 0\),?\s*\}\)/.test(page),
    'la salle d’attente lit la règle',
  )
  // Invité, il la trouve en tête de sa salle d'attente, le choix déjà ouvert — pas sous le classement.
  assert.ok(page.indexOf('{invite && carteDesEquipes}') > 0 && page.indexOf('{invite && carteDesEquipes}') < page.indexOf('id="place-invitation"'), 'en tête, avant l’invitation du salon')
  assert.ok(page.includes('{!invite && carteDesEquipes}'), 'sinon à sa place d’avant')
  assert.ok(page.includes('{switching || invite ? ('), 'le choix ouvert sans toucher')
})

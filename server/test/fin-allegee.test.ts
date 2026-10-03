// La fin de soirée, allégée sans rien perdre.
//
// Trois étages : l'essentiel sans défiler — sa place, ce qu'on porte, ce que
// la soirée rapporte en une ligne —, puis « Nouveau » en trois lignes et le
// reste déplié sur place, puis les gestes. Ce qui sert à la suite plutôt
// qu'à ce soir — ce qu'on approche, le quiz du jour, les coups du sort —
// attend replié sous les gestes, son résumé sur sa ligne : on ne s'y perd
// pas, et rien ne disparaît.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import type { FinDeSoiree } from '../../shared/fin'

Object.assign(globalThis, { React })

const SLUG = 'chez-nadia'
const soiree = { id: '2026-09-27-k7x2q', titre: 'La soirée de Nadia', slug: SLUG }

const FIN: FinDeSoiree = {
  soiree,
  joueurId: 'p1',
  nom: 'Jeanne',
  avatar: '🦊',
  rang: 1,
  points: 1200,
  joueurs: 6,
  aJoue: true,
  prix: [
    { key: 'eclair', emoji: '⚡', title: 'L’Éclair', detail: '2,7 s de moyenne' },
    { key: 'mouton', emoji: '🐑', title: 'Le Mouton', detail: '13 fois avec la majorité' },
  ],
  hautsFaits: [
    { key: 'hf:foudre', emoji: '🌩️', title: 'La Foudre', ton: 'eclat' },
    { key: 'hf:flair', emoji: '🔮', title: 'Le Flair', ton: 'eclat' },
    { key: 'hf:kamikaze', emoji: '💥', title: 'Le Kamikaze', ton: 'ombre' },
  ],
  profil: {
    xp: 238,
    xpPaliers: 24,
    niveauAvant: 9,
    niveauApres: 9,
    paliers: [{ key: 'hf:bavard:2', emoji: '💬', title: 'Le Bavard · Argent', ton: 'eclat' }],
    legendaires: [],
    divins: [],
    finitions: [],
    records: [{ key: 'serie', valeur: 11, avant: 9 }],
    approches: [
      { key: 'hf:encyclopedie:2', acquis: 284, requis: 300, ceSoir: 41 },
      { key: 'lg:tigre', acquis: 7, requis: 10, ceSoir: 1 },
    ],
    collection: { nouveaux: ['mouton'], eus: 10, total: 20 },
    jour: { serie: 4, aJoue: false },
    confettis: { gagnes: 13, solde: 314, abordables: 10, vise: { theme: 'licorne', manque: 86 } },
  },
}

async function rendu(fin: FinDeSoiree): Promise<string> {
  Object.assign(globalThis, { window: { location: { pathname: `/${SLUG}`, search: '', hash: '' } } })
  const module = await import(new URL('../../client/src/components/FinDeSoiree.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.FinDeSoiree, { fin, profil: null, onSuivante: () => {} }))
}

test('la fin en trois étages : l’essentiel, « Nouveau », les gestes — puis la suite, repliée', async () => {
  const html = await rendu(FIN)
  const ou = (marque: string) => {
    const i = html.indexOf(marque)
    assert.ok(i >= 0, marque)
    return i
  }
  const ordre = ['class="card fin-moi"', 'class="card fin-gain"', 'class="card fin-nouveautes"', 'class="fin-actions"', 'class="card fin-suite"'].map(ou)
  assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), 'dans cet ordre')
  // Ce que la soirée rapporte, en une ligne : l'expérience de la soirée (sans les paliers, qui ont la leur) et les confettis.
  assert.match(html, /<p class="fin-gains-chiffres"><span><b>\+214<\/b> XP<\/span><span><b>\+13<\/b> <span aria-hidden="true">🎊<\/span><span class="sr-only"> confettis<\/span><\/span><\/p>/)
  assert.match(html, /\+24 XP de paliers de carrière/)
  assert.match(html, /<a href="\/boutique">La boutique des thèmes<\/a>/)
})

test('« Nouveau » montre trois nouveautés, la plus durable d’abord, et déplie le reste sur place', async () => {
  const html = await rendu(FIN)
  const bloc = html.slice(html.indexOf('class="card fin-nouveautes"'), html.indexOf('class="fin-actions"'))
  const titres = [...bloc.matchAll(/<span class="nouveaute-texte"><b>([^<]+)<\/b>/g)].map(m => m[1])
  // Le palier, le record, les prix, puis les exploits ; jamais un coup du sort.
  assert.deepEqual(titres, ['Le Bavard · Argent', 'Record battu', 'L’Éclair', 'Le Mouton', 'La Foudre', 'Le Flair'])
  const avantLeReste = bloc.slice(0, bloc.indexOf('<details class="nouveautes-reste">'))
  assert.equal(avantLeReste.match(/<li>/g)?.length, 3, 'trois tiennent au-dessus des boutons')
  // Le reste se déplie sans quitter la fin : replié, mais là.
  assert.match(bloc, /<details class="nouveautes-reste"><summary>Et 3 autres/)
  assert.match(bloc, /11 bonnes réponses d’affilée · ton record était de 9/)
  assert.match(bloc, /Il rejoint ta collection : 10 prix sur 20/)
  assert.doesNotMatch(bloc, /Kamikaze/)
})

test('« Pour la suite » : replié, il dit ce qu’il garde — ce qu’on approche, le quiz du jour, les coups du sort', async () => {
  const html = await rendu(FIN)
  const suite = html.slice(html.indexOf('<details class="card fin-suite">'))
  assert.ok(suite.length > 0)
  assert.doesNotMatch(suite.slice(0, 40), /open/, 'replié à l’ouverture : les gestes restent en vue')
  assert.match(suite, /<b>Pour la suite<\/b><span class="muted small">2 objectifs en vue · le quiz du jour t’attend · 1 coup du sort<\/span>/)
  // Tout y est encore.
  assert.match(suite, /Tu t’en approches/)
  assert.match(suite, /\+41 ce soir/)
  assert.match(suite, /<a class="link-inline" href="\/jour">Jouer celui d’aujourd’hui<\/a>/)
  assert.match(suite, /Le Kamikaze/)
})

test('une fin sans rien à suivre ni de nouveau ne garde ni « Nouveau » ni « Pour la suite »', async () => {
  const html = await rendu({ ...FIN, prix: [], hautsFaits: [], profil: undefined })
  assert.doesNotMatch(html, /fin-nouveautes|fin-suite/)
})

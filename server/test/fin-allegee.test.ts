// La fin de soirée, épurée sans rien perdre (la remarque du propriétaire du
// 3 octobre 2026 : « trop gros, des blocs trop compliqués, deux fois Retour
// à l'accueil »).
//
// L'essentiel sans défiler, dans le cadre du tableau de bord : qui, sa
// place, ses points, l'expérience et les confettis en cadrans ; puis trois
// nouveautés ; puis deux boutons, « Mon bilan » et « Accueil ». Tout le
// reste — le souvenir, les nouveautés d'après la troisième, ce qu'on
// approche, le quiz du jour, les coups du sort — attend sous « Plus »,
// replié, son résumé sur sa ligne : rien ne disparaît.
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

test('la fin en trois étages : le tableau de bord, « Nouveau », deux boutons — puis « Plus », replié', async () => {
  const html = await rendu(FIN)
  const ou = (marque: string) => {
    const i = html.indexOf(marque)
    assert.ok(i >= 0, marque)
    return i
  }
  const ordre = ['class="admin-hud fin-hud"', 'class="fin-nouveautes"', 'class="fin-actions fin-duo"', 'class="fin-plus"'].map(ou)
  assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), 'dans cet ordre')
  // Plus de cartes empilées : la place, les points, ce que la soirée rapporte, en cadrans.
  assert.doesNotMatch(html, /class="card fin-(moi|gain|nouveautes|suite)"/)
  const cadrans = [...html.matchAll(/<span class="admin-cadran-chiffre num">([^<]+)<\/span><span class="admin-cadran-nom">([^<]+)<\/span>/g)].map(m => `${m[1]} ${m[2]}`)
  // L'expérience de la soirée, sans les paliers, qui ont leur ligne dans « Plus ».
  // (Le séparateur des milliers dépend de l'ICU de Node : on ne le lit pas.)
  assert.deepEqual(
    cadrans.map(c => c.replace(/\s(?=\d{3}\b)/g, '')),
    ['1ʳᵉ sur 6', '1200 points', '+214 XP', '+13 confettis'],
  )
  // Deux boutons, un seul « Accueil ».
  const actions = html.slice(ou('class="fin-actions fin-duo"'), ou('class="fin-plus"'))
  assert.equal([...actions.matchAll(/<a class="btn[^"]*"/g)].length, 2)
  assert.match(actions, /Mon bilan<\/a>/)
  assert.match(actions, /<a class="btn" href="\/">.*Accueil<\/a>/)
  assert.equal(html.match(/Accueil<\/a>/g)?.length, 1, 'un seul retour à l’accueil')
})

test('« Nouveau » montre trois nouveautés, la plus durable d’abord ; le reste attend sous « Plus »', async () => {
  const html = await rendu(FIN)
  const titres = (bloc: string) => [...bloc.matchAll(/<span class="nouveaute-texte"><b>([^<]+)<\/b>/g)].map(m => m[1])
  const nouveau = html.slice(html.indexOf('class="fin-nouveautes"'), html.indexOf('class="fin-actions fin-duo"'))
  const plus = html.slice(html.indexOf('class="fin-plus"'))
  // Le palier, le record, les prix, puis les exploits ; jamais un coup du sort.
  assert.deepEqual(titres(nouveau), ['Le Bavard · Argent', 'Record battu', 'L’Éclair'], 'trois tiennent au-dessus des boutons')
  assert.deepEqual(titres(plus), ['Le Mouton', 'La Foudre', 'Le Flair'])
  assert.match(nouveau, /11 bonnes réponses d’affilée · ton record était de 9/)
  assert.match(nouveau, /Il rejoint ta collection : 10 prix sur 20/)
  assert.doesNotMatch(nouveau, /Kamikaze/)
})

test('« Plus » : replié, il dit ce qu’il garde — les nouveautés d’après, ce qu’on approche, le quiz du jour, les coups du sort', async () => {
  const html = await rendu(FIN)
  const plus = html.slice(html.indexOf('<details class="fin-plus">'))
  assert.ok(plus.length > 0)
  assert.doesNotMatch(plus.slice(0, 30), /open/, 'replié à l’ouverture : les boutons restent en vue')
  assert.match(plus, /<b>Plus<\/b><span class="muted small">3 nouveautés · 2 objectifs en vue · le quiz du jour t’attend · 1 coup du sort<\/span>/)
  // Tout y est encore.
  assert.match(plus, /Revoir la soirée<\/a>/)
  assert.match(plus, /<a class="link-inline" href="\/boutique">La boutique des thèmes<\/a>/)
  assert.match(plus, /\+24 XP de paliers de carrière/)
  assert.match(plus, /Tu t’en approches/)
  assert.match(plus, /\+41 ce soir/)
  assert.match(plus, /<a class="link-inline" href="\/jour">Jouer celui d’aujourd’hui<\/a>/)
  assert.match(plus, /Le Kamikaze/)
})

test('une fin sans rien de nouveau ni à suivre ne garde ni « Nouveau » ni de quoi déplier', async () => {
  const sans = { ...FIN, prix: [], hautsFaits: [], profil: undefined }
  assert.doesNotMatch(await rendu(sans), /fin-nouveautes/)
  // L'invité qui n'a pas joué : ni bilan, ni souvenir à revoir sous « Plus » — rien à déplier.
  assert.doesNotMatch(await rendu({ ...sans, joueurId: undefined, aJoue: false }), /fin-plus/)
})

test('au chef : « Terminer la soirée » sur le dernier podium, sans échéance — et rien ne se décompte dans la salle', async () => {
  // Le podium s'enlevait tout seul, trente secondes après : c'est le chef
  // qui l'enlève (le propriétaire du dépôt, le 4 octobre 2026).
  const { readFileSync } = await import('node:fs')
  const source = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')
  const barre = source('components/BarreDuChef.tsx')
  assert.match(barre, /barre-chef-terminer" onClick=\{clore\}>\s*<Icon name="flag" \/>\s*Terminer la soirée\s*<\/button>/)
  assert.match(barre, /c\.snapshot\.finDuProgramme && \(!v \|\| v\.phase === 'finished'\)/)
  assert.doesNotMatch(barre, />\s*Maintenant\s*</)
  assert.doesNotMatch(barre, /barre-chef-echeance|seule dans/)
  assert.doesNotMatch(source('views/PlayerApp.tsx'), /ClotureQuiVient|clotureAuto/)
})

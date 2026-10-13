// La fin de soirée, épurée sans rien perdre (la remarque du propriétaire du
// 3 octobre 2026 : « trop gros, des blocs trop compliqués, deux fois Retour
// à l'accueil »), puis au format de toutes les fins (l'écran A, choisi le
// 13 octobre 2026 : « c'est très confus, les trophées que les gens gagnent »).
//
// L'essentiel sans défiler, dans le cadre du tableau de bord : qui, sa place,
// ses points, ses records ; puis « Ce que tu gagnes » — l'expérience en un
// total, ce qui la fait, les confettis, le niveau — ; les nouveaux trophées,
// trois en vue, les plus rares d'abord ; deux boutons, « Mon bilan » et
// « Accueil ». Le reste — le souvenir, ce qu'on approche, le quiz du jour —
// attend sous « Plus », replié, son résumé sur sa ligne : rien ne disparaît.
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

async function rendu(fin: FinDeSoiree, profil: object | null = null): Promise<string> {
  Object.assign(globalThis, { window: { location: { pathname: `/${SLUG}`, search: '', hash: '' } } })
  const module = await import(new URL('../../client/src/components/FinDeSoiree.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.FinDeSoiree, { fin, profil, onSuivante: () => {} }))
}

const PROFIL = { id: 'p', name: 'Jeanne', avatar: '🦊', niveau: 9, acquis: 120, requis: 400, legendaire: null }

test('la fin en étages : le tableau de bord, ce que tu gagnes, les trophées, deux boutons — puis « Plus », replié', async () => {
  const html = await rendu(FIN)
  const ou = (marque: string) => {
    const i = html.indexOf(marque)
    assert.ok(i >= 0, marque)
    return i
  }
  const ordre = ['class="admin-hud fin-hud"', 'class="card gains"', 'class="card gains-trophees"', 'class="fin-actions fin-duo"', 'class="fin-plus"'].map(ou)
  assert.deepEqual(ordre, [...ordre].sort((a, b) => a - b), 'dans cet ordre')
  // Plus de cartes empilées pour la soirée : sa place et ses points en cadrans.
  assert.doesNotMatch(html, /class="card fin-(moi|gain|nouveautes|suite)"/)
  const cadrans = [...html.matchAll(/<span class="admin-cadran-chiffre num">([^<]+)<\/span><span class="admin-cadran-nom">([^<]+)<\/span>/g)].map(m => `${m[1]} ${m[2]}`)
  // (Le séparateur des milliers dépend de l'ICU de Node : on ne le lit pas.)
  assert.deepEqual(
    cadrans.map(c => c.replace(/\s(?=\d{3}\b)/g, '')),
    ['1ʳᵉ sur 6', '1200 points'],
  )
  // Ses records, avec sa place : le score de la soirée.
  const hud = html.slice(ou('class="admin-hud fin-hud"'), ou('class="card gains"'))
  assert.match(hud, /<b>Record battu<\/b> · 11 bonnes réponses d’affilée · ton record était de 9/)
  // Deux boutons, un seul « Accueil ».
  const actions = html.slice(ou('class="fin-actions fin-duo"'), ou('class="fin-plus"'))
  assert.equal([...actions.matchAll(/<a class="btn[^"]*"/g)].length, 2)
  assert.match(actions, /Mon bilan<\/a>/)
  assert.match(actions, /<a class="btn" href="\/">.*Accueil<\/a>/)
  assert.equal(html.match(/Accueil<\/a>/g)?.length, 1, 'un seul retour à l’accueil')
})

test('ce que tu gagnes : un total, et ce qui le fait — la soirée, que « Mes soirées » lui compte, et ses pistes, payées à part', async () => {
  const html = await rendu(FIN)
  const gains = html.slice(html.indexOf('class="card gains"'), html.indexOf('class="card gains-trophees"'))
  // Toute l'expérience de la soirée, pistes comprises : celle que la barre vient de prendre.
  assert.match(gains, /<b class="num">\+238 XP<\/b>/)
  assert.match(gains, /🎊<\/span> \+13 confettis/)
  // « Mes soirées » ne compte que la soirée — ses exploits compris — : la fin dit les deux.
  assert.match(gains, /ta soirée \+214 · tes pistes \+24/)
  // Un invité anonyme n'a rien de tout ça, sans rien qui le lui reproche.
  assert.doesNotMatch(await rendu({ ...FIN, profil: undefined }), /class="card gains"|Ce que tu gagnes/)
})

test('les nouveaux trophées : trois en vue, les plus rares d’abord — les coups du sort derrière —, le reste d’un toucher', async () => {
  const html = await rendu(FIN)
  const trophees = html.slice(html.indexOf('class="card gains-trophees"'), html.indexOf('class="fin-actions fin-duo"'))
  const titres = [...trophees.matchAll(/<span class="trophee-tombe-titre"><b>([^<]+)<\/b>/g)].map(m => m[1])
  // Les prix d'abord — un sur six joueurs —, puis les trophées que le moins de joueurs ont ; le Kamikaze attend.
  assert.deepEqual(titres, ['L’Éclair', 'Le Mouton', 'Le Bavard · Argent'], 'trois tiennent au-dessus des boutons')
  assert.match(trophees, /2,7 s de moyenne · un prix du palmarès/)
  assert.match(trophees, /500 réponses envoyées · \+100 XP/)
  assert.match(trophees, /<button type="button" class="link-inline small gains-reste">Et 3 autres<\/button>/)
  assert.match(trophees, /Il rejoint ta collection : 10 prix sur 20/)
  // Sans profil, pas d'album où les retrouver : des lignes, pas des liens.
  assert.doesNotMatch(trophees, /<a class="trophee-tombe"|Ma collection<\/a>/)
  // Avec un profil, chacun mène à sa page de l'album.
  const avecProfil = await rendu(FIN, PROFIL)
  assert.match(avecProfil, /<a class="trophee-tombe" href="\/profil#collection-trophees-soiree"/)
  assert.match(avecProfil, /<a class="link-inline small" href="\/profil#collection-trophees-soiree">Ma collection<\/a>/)
  // Le niveau relu, sous le total : où il en est dans le suivant.
  assert.match(avecProfil, /Niveau 9 · 120 \/ 400 XP vers le niveau 10/)
})

test('« Plus » : replié, il dit ce qu’il garde — ce qu’on approche, le quiz du jour —, et le souvenir, la boutique', async () => {
  const html = await rendu(FIN)
  const plus = html.slice(html.indexOf('<details class="fin-plus">'))
  assert.ok(plus.length > 0)
  assert.doesNotMatch(plus.slice(0, 30), /open/, 'replié à l’ouverture : les boutons restent en vue')
  assert.match(plus, /<b>Plus<\/b><span class="muted small">2 objectifs en vue · le quiz du jour t’attend<\/span>/)
  // Tout y est encore.
  assert.match(plus, /Revoir la soirée<\/a>/)
  assert.match(plus, /<a class="link-inline" href="\/boutique">La boutique des thèmes<\/a>/)
  assert.match(plus, /Tu t’en approches/)
  assert.match(plus, /\+41 ce soir/)
  assert.match(plus, /<a class="link-inline" href="\/jour">Jouer celui d’aujourd’hui<\/a>/)
})

test('une fin sans rien de nouveau ni à suivre ne garde ni trophées ni de quoi déplier', async () => {
  const sans = { ...FIN, prix: [], hautsFaits: [], profil: undefined }
  assert.doesNotMatch(await rendu(sans), /gains-trophees|Nouveaux trophées/)
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

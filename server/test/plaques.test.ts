// Les plaques de nom (le 10 novembre 2026, la maquette validée par le
// propriétaire, `retours/2026-11-10/plaques/`) : la ligne d'un joueur dans
// les classements, aux couleurs d'un thème qu'il possède. Un thème ne se
// voyait que sur le téléphone de qui le porte — six de vendus en production,
// pour seize compagnons — : la plaque est sa part visible. Ses règles sont
// pures (`shared/plaques.ts`), ses couleurs celles de son thème. Depuis le
// 18 novembre 2026 (`retours/2026-11-18/plaques/`), deux formes : le paraphe
// partout — un trait de plume sous le prénom, son emblème après lui —, la
// plaque entière au podium ; et rien ne passe jamais sous un texte. Et, le
// même jour, la grande plaque des duels : à un contre un, chaque carte à la
// plaque de son joueur, chacun sur son socle au verdict.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { contraste, teinte, themesDuClient } from './teintes'
import { AUCUNE_PLAQUE, choixDePlaque, plaqueDuTheme, plaquePortee, plaquesOuvertes } from '../../shared/plaques'
import { THEMES } from '../../shared/themes'
import { avecLEssai, essayer, lignesDeLEssai } from '../../shared/loge'
import { jourDe } from '../../shared/jour'
import { CATEGORIES } from '../../shared/categories'
import { CONTRASTE_D_UN_EMBLEME, DEBUT, EMBLEMES, FIN, auPire, couleursDesPlaques, feuilleAJour, fondsDesThemes } from '../scripts/emblemes-des-plaques'

const CLIENT = new URL('../../client/src/', import.meta.url)
const lu = (chemin: string) => readFileSync(new URL(chemin, CLIENT), 'utf8')
const CSS = lu('styles.css')

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

test('une plaque par thème, sauf Velours ; sans choix, celle du thème porté', () => {
  // Velours, le thème de tous, n'a pas de plaque : sa ligne est celle d'aujourd'hui.
  assert.equal(plaqueDuTheme('velours'), null)
  assert.equal(plaqueDuTheme('kintsugi'), 'kintsugi')
  assert.equal(plaqueDuTheme('n-existe-pas'), null)
  assert.equal(plaqueDuTheme(null), null)
  for (const t of THEMES) assert.equal(plaqueDuTheme(t.key), t.key === 'velours' ? null : t.key, t.key)

  // La colonne : null, `auto` ; `aucune` ; la clé d'un thème. Un thème retiré du catalogue revient à `auto`.
  assert.equal(choixDePlaque(null), 'auto')
  assert.equal(choixDePlaque(AUCUNE_PLAQUE), AUCUNE_PLAQUE)
  assert.equal(choixDePlaque('ocean'), 'ocean')
  assert.equal(choixDePlaque('velours'), 'auto')
  assert.equal(choixDePlaque('disparu'), 'auto')

  // Sans choix, elle suit le thème porté — rien sous le Velours.
  assert.equal(plaquePortee(null, null), null)
  assert.equal(plaquePortee(null, 'velours'), null)
  assert.equal(plaquePortee(null, 'ciel'), 'ciel')
  // Choisie, elle ne suit plus : on joue sous le Ciel et l'on se montre en Kintsugi.
  assert.equal(plaquePortee('kintsugi', 'ciel'), 'kintsugi')
  assert.equal(plaquePortee('kintsugi', null), 'kintsugi')
  // Aucune : sa ligne reste celle de tous, quel que soit son thème.
  assert.equal(plaquePortee(AUCUNE_PLAQUE, 'ciel'), null)

  // Celles qu'il peut porter : une par thème à lui, l'Ivoire offert compris.
  assert.deepEqual(plaquesOuvertes(['velours', 'ivoire']), ['ivoire'])
  assert.deepEqual(plaquesOuvertes(['velours', 'ivoire', 'ocean', 'kintsugi']), ['ivoire', 'ocean', 'kintsugi'])
})

test('la classe d’une plaque ne prend qu’une clé de thème, et sa vitrine au podium', async () => {
  // Un composant du client : chargé par son adresse, le serveur ne compile pas de JSX.
  const { classeDeLaPlaque, enVitrine, PLACES_EN_VITRINE } = (await import(new URL('components/Plaque.tsx', CLIENT).href)) as {
    classeDeLaPlaque: (p: unknown, rang?: number) => string
    enVitrine: (rang?: number) => boolean
    PLACES_EN_VITRINE: number
  }
  assert.equal(classeDeLaPlaque('kintsugi'), ' plaque plaque-kintsugi')
  assert.equal(classeDeLaPlaque(null), '')
  assert.equal(classeDeLaPlaque(undefined), '')
  // Ce qui n'a pas la forme d'une clé n'entre pas dans une classe.
  for (const k of ['', 'a b', 'x"y', 'Kintsugi', 'plaque me', 'a-b']) assert.equal(classeDeLaPlaque(k), '', k)

  // Le podium montre la plaque entière, ex æquo compris : tous ceux qui partagent le troisième rang sont troisièmes.
  assert.equal(PLACES_EN_VITRINE, 3)
  assert.equal(classeDeLaPlaque('kintsugi', 1), ' plaque plaque-kintsugi vitrine')
  assert.equal(classeDeLaPlaque('kintsugi', 3), ' plaque plaque-kintsugi vitrine')
  assert.equal(classeDeLaPlaque('kintsugi', 4), ' plaque plaque-kintsugi', 'hors du podium, le paraphe')
  assert.equal(classeDeLaPlaque(null, 1), '', 'sans plaque, rien — même au podium')
  for (const r of [undefined, 0, -1, 4, 12]) assert.equal(enVitrine(r), false, String(r))
})

test('la feuille : chaque plaque porte les couleurs de son thème, lisibles, et son motif', () => {
  const regles = new Map([...CSS.matchAll(/^\.plaque-([a-z]+) \{([^}]*--p-bg[^}]*)\}/gm)].map(m => [m[1], m[2]] as [string, string]))
  const attendues = THEMES.filter(t => t.key !== 'velours').map(t => t.key)
  assert.deepEqual([...regles.keys()].sort(), [...attendues].sort(), 'une règle de couleurs par thème, et aucune pour un thème qui n’existe pas')

  const themes = new Map(themesDuClient().map(t => [t.cle, t.jetons]))
  for (const cle of attendues) {
    const jetons = themes.get(cle)
    assert.ok(jetons, `${cle} a sa feuille`)
    const lue = new Map([...regles.get(cle)!.matchAll(/(--p-[a-z]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2].toLowerCase()] as [string, string]))
    // Ses cinq couleurs sont celles de son thème : un thème qui change les siennes les change ici.
    const paires: [string, string][] = [
      ['--p-bg', '--bg'],
      ['--p-ink', '--ink'],
      ['--p-muted', '--muted'],
      ['--p-or', '--accent-text'],
      ['--p-trait', '--accent'],
    ]
    for (const [p, j] of paires) assert.equal(lue.get(p), teinte(jetons, j).toLowerCase(), `${cle} : ${p} est le ${j} de son thème`)
    // Ce qui s'écrit sur la plaque se lit : le prénom, le rang, le score.
    for (const p of ['--p-ink', '--p-muted', '--p-or']) {
      const c = contraste(lue.get(p)!, lue.get('--p-bg')!)
      assert.ok(c >= 4.5, `${cle} : ${p} sur son fond, ${c.toFixed(2)}:1`)
    }
  }

  // La vitrine du podium est plus forte que la ligne d'un thème, « la mienne » comprise : les thèmes repeignent `.lb-row`
  // et `.lb-row.me`.
  assert.match(CSS, /:root body \.lb-row\.plaque\.vitrine:not\(\.team-row\) \{[^}]*background:[^;]*var\(--p-bg\);/)
  for (const t of themesDuClient()) {
    for (const m of t.css.matchAll(/^:root\[data-theme='[a-z]+'\] ([^{]*\.lb-row[^{]*)\{/gm)) {
      const classes = (m[1].match(/\./g) ?? []).length
      assert.ok(classes <= 2, `${t.cle} : « ${m[1].trim()} » resterait plus fort que la plaque`)
    }
  }
  // Elle redit les jetons que la ligne lit : le rang, le prénom et le score suivent sans rien savoir.
  const ligne = /:root body \.lb-row\.plaque\.vitrine:not\(\.team-row\) \{([^}]*)\}/.exec(CSS)![1]
  for (const j of ['--ink: var(--p-ink)', '--muted: var(--p-muted)', '--accent-text: var(--p-or)']) assert.ok(ligne.includes(j), j)
})

test('chaque plaque a son emblème, en deux tons qui se lisent sur tout thème et sur elle-même', () => {
  // Écrits par leur script, jamais à la main : la feuille est celle qu'il écrirait.
  assert.equal(feuilleAJour(CSS), CSS, 'npx tsx scripts/emblemes-des-plaques.ts --ecrire')
  const bloc = CSS.slice(CSS.indexOf(DEBUT), CSS.indexOf(FIN))
  const attendues = THEMES.filter(t => t.key !== 'velours').map(t => t.key)
  assert.deepEqual(Object.keys(EMBLEMES).sort(), [...attendues].sort(), 'un dessin par plaque, et aucun pour un thème qui n’existe pas')
  const tons = new Map(
    [...bloc.matchAll(/^\.plaque-([a-z]+) \{ --p-clair: (#[0-9a-f]{6}); --p-sombre: (#[0-9a-f]{6}); --p-embleme: url\("data:image\/svg\+xml,[^"]+"\); \}$/gm)].map(
      m => [m[1], { clair: m[2], sombre: m[3] }] as const,
    ),
  )
  assert.deepEqual([...tons.keys()].sort(), [...attendues].sort(), 'chaque plaque, ses deux tons et son emblème')

  // Le clair se lit sur chaque thème sombre, le sombre sur chaque thème clair (3:1, ce qui n'est pas du texte) ; et sur
  // sa propre plaque, au podium, le ton qui la contraste.
  const fonds = fondsDesThemes()
  const couleurs = couleursDesPlaques(CSS)
  const clairs = new Map(THEMES.map(t => [t.key, t.clair]))
  for (const [cle, { clair, sombre }] of tons) {
    assert.ok(auPire(clair, fonds.sombres) >= CONTRASTE_D_UN_EMBLEME, `${cle} : son clair sur les thèmes sombres`)
    assert.ok(auPire(sombre, fonds.clairs) >= CONTRASTE_D_UN_EMBLEME, `${cle} : son sombre sur les thèmes clairs`)
    const surElle = clairs.get(cle) ? sombre : clair
    assert.ok(auPire(surElle, [couleurs.get(cle)!.bg]) >= CONTRASTE_D_UN_EMBLEME, `${cle} : son emblème sur sa plaque`)
  }
  // Le paraphe prend le sombre sous chaque thème clair du catalogue, et seulement sous eux.
  const sousLeClair = /^:root:is\(([^)]+)\) \.lb-row\.plaque \{ --p-plume: var\(--p-sombre\); \}$/m.exec(bloc)
  assert.ok(sousLeClair, 'la règle du paraphe sous un thème clair')
  const listes = [...sousLeClair[1].matchAll(/\[data-theme='([a-z]+)'\]/g)].map(m => m[1]).sort()
  assert.deepEqual(listes, THEMES.filter(t => t.clair).map(t => t.key).sort())
})

test('le paraphe et l’emblème : des pièces de la ligne, jamais un fond sous le texte', () => {
  // Ni masque, ni filtre, ni mouvement : dans une liste, rien ne garde un calque (règle css.md). Les emblèmes sont des
  // images, leurs couleurs écrites dedans ; leur bloc, écrit par son script, se lit à part (le test d'avant).
  const tout = CSS.slice(CSS.indexOf('/* ── Les plaques de nom'), CSS.indexOf('/* ── Écran commun'))
  const bloc = (tout.slice(0, tout.indexOf(DEBUT)) + tout.slice(tout.indexOf(FIN))).replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(bloc.length > 1000, 'le bloc des plaques se trouve')
  assert.doesNotMatch(bloc, /mask|filter|animation:(?!\s*none)|transform/, 'ni masque, ni filtre, ni mouvement')
  // Le paraphe : un trait sous le prénom, au ton que le fond laisse lire — hors du podium seulement.
  assert.match(bloc, /\.lb-row\.plaque \{ --p-plume: var\(--p-clair\); \}/)
  assert.match(bloc, /\.lb-row\.plaque:not\(\.vitrine\) > \.lb-name::after \{[^}]*border-bottom: 2px solid var\(--p-plume\);/)
  // L'emblème : une pièce après le prénom, qui cède avant lui ; `--p-embleme` ne se lit que dans ses pièces.
  assert.match(bloc, /\.lb-row\.plaque > \.plaque-embleme \{[^}]*flex: 0 1000 20px;[^}]*background: var\(--p-embleme\)/)
  assert.deepEqual(
    [...bloc.matchAll(/([^{}]+)\{[^}]*var\(--p-embleme\)/g)].map(m => m[1].trim()),
    ['.lb-row.plaque > .plaque-embleme'],
    'la ligne même ne prend jamais l’emblème en fond',
  )

  // Les trois classements la posent de la même façon : la classe et le rang sur la ligne, l'emblème juste après le prénom.
  for (const [fichier, n] of [
    ['views/JourApp.tsx', 1],
    ['views/Defi.tsx', 2],
    ['views/Duels.tsx', 1],
  ] as const) {
    const source = lu(fichier)
    assert.equal((source.match(/classeDeLaPlaque\(l\.plaque, l\.rang\)/g) ?? []).length, n, `${fichier} : la classe de la plaque et son rang sur sa ligne`)
    assert.match(source, /<\/span>\s*<EmblemeDeLaPlaque plaque=\{l\.plaque\} \/>/, `${fichier} : l’emblème après le prénom`)
  }
})

test('la loge : la plaque s’essaie comme le reste, et se compare à son choix', () => {
  const porte = { avatar: '🦊', legendaire: null, finitionChoisie: 'auto', titre: null, vitrineChoisie: null, fond: null, theme: 'ciel', gerbe: 'confettis', bordureChoisie: 'auto', plaqueChoisie: 'auto' } as const
  assert.deepEqual(essayer({}, { plaque: 'kintsugi' }, porte), { plaque: 'kintsugi' })
  // Revenir à son choix retire l'essai.
  assert.deepEqual(essayer({ plaque: 'kintsugi' }, { plaque: 'auto' }, porte), {})
  // « Comme mon thème » et le thème lui-même sont deux choix : sous le Ciel, sa plaque du Ciel choisie reste un essai.
  assert.deepEqual(essayer({}, { plaque: 'ciel' }, porte), { plaque: 'ciel' })
  // Un profil d'un serveur d'avant, sans choix dit : `auto`.
  const { plaqueChoisie: _, ...avant } = porte
  assert.deepEqual(essayer({}, { plaque: 'auto' }, avant), {})

  assert.deepEqual(
    lignesDeLEssai({ plaque: 'kintsugi' }, { niveau: 1 }).map(l => [l.piece, l.nom, l.detail]),
    [['theme', 'Kintsugi', 'Plaque']],
  )
  assert.equal(lignesDeLEssai({ plaque: 'auto' }, { niveau: 1 })[0].nom, 'Comme ton thème')
  assert.equal(lignesDeLEssai({ plaque: AUCUNE_PLAQUE }, { niveau: 1 })[0].nom, 'Sans plaque')
  assert.equal(avecLEssai({ ...porte, finition: 'mat', niveau: 1 }, { plaque: 'ocean' }).plaqueChoisie, 'ocean')

  // Elle se choisit dans la pièce de ses thèmes — son onglet, à côté d'eux, depuis le 17 novembre 2026 : sous eux, à
  // 1180 px du haut, personne ne la trouvait —, et la fiche d'un thème la montre à la boutique.
  const boutique = lu('components/Boutique.tsx')
  assert.match(boutique, /<MaPlaque profil=\{profil\} essai=\{essai\} essayer=\{essayer\} neufs=\{neufs\} \/>/)
  assert.match(boutique, /\{vue === 'themes' \? \([\s\S]*?\) : \(\s*<MaPlaque /)
  assert.match(lu('components/Presentoir.tsx'), /plaqueDuTheme\(t\.key\) && \([\s\S]{0,200}<LigneDePlaque profil=\{profil\} plaque=\{t\.key\} \/>/)
  // Un toucher essaie, rien ne s'enregistre d'ici.
  const piece = lu('components/MaPlaque.tsx')
  assert.match(piece, /onClick=\{\(\) => essayer\(\{ plaque: c\.cle \}\)\}/)
  assert.doesNotMatch(piece, /enregistrer|api\./)
})

test('l’onglet « Ma plaque » : sa ligne une fois, puis une petite plaque par choix, qui prend les couleurs de la sienne', async () => {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { MaPlaque } = await import(new URL('components/MaPlaque.tsx', CLIENT).href)
  const lea = {
    name: 'Léa',
    avatar: '🦊',
    finition: 'mat',
    legendaire: null,
    eclats: [],
    bordures: [],
    theme: 'ocean',
    plaqueChoisie: 'auto',
    boutique: { confettis: { gagnes: 0, depenses: 0, solde: 0 }, possedes: ['velours', 'ivoire', 'ocean', 'neige'], porte: null, jour: '2026-11-17' },
  }
  const html = renderToStaticMarkup(React.createElement(MaPlaque, { profil: lea, essai: { plaque: 'neige' }, essayer: () => {}, neufs: new Set(['neige']) }))
  // Sa ligne de classement une seule fois, sous la plaque que la page montre — sa forme du podium, la plus entière : une
  // ligne entière par choix faisait commencer la plaque à 1180 px en 360 × 640.
  assert.equal(html.match(/class="lb-row /g)?.length, 1)
  assert.match(html, /^<div class="lb-row plaque-apercu plaque plaque-neige vitrine" role="img" aria-label="Ta ligne aux classements, sous la plaque Neige">/)
  // Puis les choix en vignettes, dans l'ordre : d'office, aucune, puis une par thème à lui — Velours n'en a pas.
  const vignettes = [...html.matchAll(/<button type="button" class="loge-vignette([^"]*)" aria-pressed="(true|false)" aria-label="([^"]+)">/g)].map(m => [m[3], m[2], m[1].trim()])
  assert.deepEqual(vignettes, [
    ['Plaque Comme mon thème, portée', 'false', 'porte'],
    ['Plaque Aucune', 'false', ''],
    ['Plaque Ivoire', 'false', ''],
    ['Plaque Océan', 'false', ''],
    // À l'essai, et neuve avec son thème : le rouge mène jusqu'à elle.
    ['Plaque Neige, à l’essai, nouvelle', 'true', 'selected essaye neuve'],
  ])
  // Chaque vignette, un échantillon à ses couleurs : sa classe de plaque, qui lui donne ses jetons ; « Comme mon thème »
  // suit le thème porté ; « Aucune », la ligne de tous.
  const echantillons = [...html.matchAll(/<span class="loge-plaque-echantillon([^"]*)" aria-hidden="true"><span class="loge-plaque-texte">([^<]+)<\/span>/g)].map(m => [m[2], m[1].trim()])
  assert.deepEqual(echantillons, [
    ['Comme mon thème', 'plaque plaque-ocean'],
    ['Aucune', ''],
    ['Ivoire', 'plaque plaque-ivoire'],
    ['Océan', 'plaque plaque-ocean'],
    ['Neige', 'plaque plaque-neige'],
  ])
  // Ce n'est pas une ligne `.lb-row` : il lit lui-même les jetons de sa plaque, et son emblème est une pièce après son nom.
  assert.match(CSS, /\.loge-plaque-echantillon\.plaque \{[^}]*border-color: var\(--p-trait\);[^}]*background:[^;]*var\(--p-bg\);[^}]*color: var\(--p-ink\);/)
  assert.match(CSS, /\.loge-plaque-echantillon > \.plaque-embleme \{[^}]*var\(--p-embleme\)/)
  // La pièce est sous « Toi seul », mais sa plaque est vue des autres : un petit œil sur l'onglet, dit à l'oreille, sans
  // phrase — la ligne « qui le voit » est partie avec les autres (le 17 novembre 2026).
  const { MesThemes } = await import(new URL('components/Boutique.tsx', CLIENT).href)
  const onglets = renderToStaticMarkup(React.createElement(MesThemes, { profil: lea, essai: {}, essayer: () => {}, neufs: new Set() }))
  assert.match(onglets, /Ma plaque<svg class="icon loge-theme-oeil"[^>]*>.*?<\/svg><span class="sr-only">, [^<]*, les autres la voient<\/span>/)
  assert.doesNotMatch(onglets, /loge-entete-consigne|Toi seul vois/)
})

test('au banc : elle se choisit parmi ses thèmes, suit le thème porté, et part dans le classement', async () => {
  const banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom')
    const porter = (corps: Record<string, unknown>, qui = lea) => ecrire(banc.url, '/api/joueur/moi', corps, qui, 'PUT')
    const profil = async (qui = lea) => (await lire(banc, qui, '/api/joueur/moi?leger')).corps.profile

    // Un profil neuf, en Velours : aucune plaque, et le choix d'office.
    assert.equal((await profil()).plaque, null)
    assert.equal((await profil()).plaqueChoisie, 'auto')

    // L'Ivoire, offert : sa plaque suit, sans rien choisir.
    assert.equal((await porter({ theme: 'ivoire' })).status, 200)
    assert.equal((await profil()).plaque, 'ivoire')
    // Aucune, puis de nouveau comme son thème.
    assert.equal((await porter({ plaque: AUCUNE_PLAQUE })).status, 200)
    assert.deepEqual([(await profil()).plaque, (await profil()).plaqueChoisie], [null, AUCUNE_PLAQUE])
    assert.equal((await porter({ plaque: 'auto' })).status, 200)
    assert.deepEqual([(await profil()).plaque, (await profil()).plaqueChoisie], ['ivoire', 'auto'])

    // Une plaque vient avec son thème, jamais sans lui : le refus dit comment l'avoir.
    const pasAchete = await porter({ plaque: 'kintsugi' })
    assert.equal(pasAchete.status, 400)
    assert.match(((await pasAchete.json()) as any).error, /Kintsugi s’achète d’abord/)
    const pasGagne = await porter({ plaque: 'babel' })
    assert.equal(pasGagne.status, 400)
    assert.match(((await pasGagne.json()) as any).error, /Babel se gagne/)
    for (const k of ['velours', 'n-existe-pas', 42]) {
      const refus = await porter({ plaque: k })
      assert.equal(refus.status, 400, String(k))
      assert.match(((await refus.json()) as any).error, /Cette plaque n’existe pas/)
    }
    assert.equal((await profil()).plaque, 'ivoire', 'un refus n’a rien changé')

    // Le Kintsugi acheté, et les deux joués hier : la plaque se choisit à part du thème porté.
    const hier = jourDe(Date.now() - 24 * 3600_000)
    base(banc, db => {
      const idDe = (login: string) => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
      db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 1000, 1)').run(idDe('lea'), 'kintsugi')
      db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(hier, JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))))
      const partie = db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, 8, ?, 0)`)
      const midi = Date.now() - 20 * 3600_000
      partie.run(idDe('lea'), hier, midi, 1400, midi + 120_000)
      partie.run(idDe('tom'), hier, midi, 900, midi + 120_000)
    })
    await banc.redemarrer()
    assert.equal((await porter({ plaque: 'kintsugi' })).status, 200)
    const apres = await profil()
    assert.deepEqual([apres.theme, apres.plaque, apres.plaqueChoisie], ['ivoire', 'kintsugi', 'kintsugi'])

    // Tom la voit sur la ligne de Léa ; la sienne, sans plaque, ne dit rien.
    const classement = (await lire(banc, tom, `/api/jour/classement?jour=${hier}`)).corps
    assert.deepEqual(
      classement.lignes.map((l: any) => [l.nom, l.plaque]),
      [
        ['Léa', 'kintsugi'],
        ['Tom', undefined],
      ],
    )
    assert.ok(!('plaque' in classement.lignes[1]), 'absente plutôt que nulle, comme la bordure')

    // Elle tient après un redémarrage : c'est une colonne du profil.
    await banc.redemarrer()
    assert.equal((await profil()).plaque, 'kintsugi')
    // Un thème changé ne touche pas une plaque choisie ; rendue à `auto`, elle le suit.
    assert.equal((await porter({ theme: null })).status, 200)
    assert.equal((await profil()).plaque, 'kintsugi')
    assert.equal((await porter({ plaque: null })).status, 200)
    assert.equal((await profil()).plaque, null, 'sous le Velours, pas de plaque')
  } finally {
    await banc.close()
  }
})

// ── La grande plaque des duels ────────────────────────────────────────────

test('la grande plaque des duels : chaque carte à la plaque de son joueur, chacun sur son socle, son nom sur sa plaque', async () => {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const { renderToStaticMarkup } = await import('react-dom/server')
  // Les écrans d'un duel lisent leur adresse en se chargeant : un navigateur de façade le temps de l'import, comme
  // `duels-page.test.ts`, rendu ensuite — les autres épreuves du fichier n'en ont pas.
  const avant = { window: (globalThis as any).window, document: (globalThis as any).document }
  Object.assign(globalThis, {
    window: { location: { pathname: '/duels', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
    document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  })
  const { DuelFaceCachee, VerdictDuDuel } = await import(new URL('views/Duel.tsx', CLIENT).href).finally(() => Object.assign(globalThis, avant))
  const EMBLEME = '<span class="plaque-embleme" aria-hidden="true"></span>'

  // Le duel que Léa a lancé, chez Tom : la carte d'en face à la plaque de Léa, son nom écrit dessus ; la sienne à la sienne.
  const recu = {
    code: 'K7M2QX',
    auteur: { nom: 'Léa', avatar: '🦊', plaque: 'kintsugi' },
    contre: { nom: 'Tom', avatar: '🐻', toi: true, ligue: 'argent', plaque: 'guinguette' },
    categories: ['Histoire'],
    minutesRestantes: 600,
    tentative: null,
    joueurs: 0,
    lignes: [],
  }
  const cartes = (duel: object) => renderToStaticMarkup(React.createElement(DuelFaceCachee, { duel, busy: false, erreur: '', onRelever() {}, onRetour() {} }))
  const habillees = cartes(recu)
  assert.match(habillees, /<span class="duels-carte duels-carte-dos plaque plaque-kintsugi"><span class="duels-balaye"><\/span>/)
  assert.match(habillees, new RegExp(`<span class="duels-carte-son-nom">Léa${EMBLEME}</span>`))
  assert.match(habillees, /<span class="duels-carte duels-carte-toi ligue-argent plaque plaque-guinguette">/)
  // Sans plaque — un invité qui n'en porte pas, un masqué, une page d'avant —, la carte d'avant, au caractère près.
  const nues = cartes({ ...recu, auteur: { nom: 'Léa', avatar: '🦊' }, contre: { ...recu.contre, plaque: undefined } })
  assert.match(nues, /<span class="duels-carte duels-carte-dos"><span class="duels-balaye"><\/span>/)
  assert.match(nues, /<span class="duels-carte-son-nom">Léa<\/span>/)
  assert.doesNotMatch(nues, /plaque/)
  // Ce qui n'a pas la forme d'une clé n'entre pas dans une classe.
  assert.doesNotMatch(cartes({ ...recu, auteur: { ...recu.auteur, plaque: 'a b' }, contre: { ...recu.contre, plaque: 'x"y' } }), /plaque/)

  // Au verdict, chacun sur son socle : la colonne de chacun à sa plaque, son nom dessus, son emblème au bout.
  const verdict = {
    quoi: 'Histoire',
    toi: { avatar: '🐻', justes: 7, plaque: 'guinguette' },
    lui: { nom: 'Léa', avatar: '🦊', justes: 6, plaque: 'kintsugi' },
    ecart: 17,
    apres: { cote: 1119, ligue: 'argent', rang: 3 },
    semaine: { duels: 1, ligue: 'argent', confettis: 0, minutesRestantes: 600 },
  }
  const carte = (v: object) => renderToStaticMarkup(React.createElement(VerdictDuDuel, { verdict: v, dos: 'Léa a joué', aRetourner: false, onFermer() {} }))
  const socles = carte(verdict)
  assert.match(
    socles,
    new RegExp(`<span class="duels-face-joueur plaque plaque-guinguette"><span class="duels-face-avatar toi">🐻</span><span class="num duels-face-score devant">7</span><span class="duels-face-nom">Toi${EMBLEME}</span></span>`),
  )
  assert.match(
    socles,
    new RegExp(`<span class="duels-face-joueur plaque plaque-kintsugi"><span class="duels-face-avatar">🦊</span><span class="num duels-face-score">6</span><span class="duels-face-nom">Léa${EMBLEME}</span></span>`),
  )
  // Automate n'a pas de plaque : son côté reste celui de tous, le sien monte seul sur son socle.
  const contreAutomate = carte({ ...verdict, lui: { nom: 'Automate', avatar: '🤖', justes: 6 } })
  assert.match(contreAutomate, /<span class="duels-face-joueur plaque plaque-guinguette">/)
  assert.match(contreAutomate, /<span class="duels-face-joueur"><span class="duels-face-avatar">🤖<\/span><span class="num duels-face-score">6<\/span><span class="duels-face-nom">Automate<\/span><\/span>/)
  assert.doesNotMatch(carte({ ...verdict, toi: { avatar: '🐻', justes: 7 }, lui: { nom: 'Léa', avatar: '🦊', justes: 6 } }), /plaque/)

  // Les deux écrans de la campagne la passent : la page d'un duel lit celle de chacun, la fin d'une partie la sienne et
  // celle d'en face.
  const duel = lu('views/Duel.tsx')
  assert.match(duel, /toi: \{ avatar: moi\.avatar, justes: t\.justes, apparence: ceQuIlPorte\(moi\), \.\.\.\(moi\.plaque && \{ plaque: moi\.plaque \}\) \}/)
  assert.match(duel, /\.\.\.\(enFace\.plaque && \{ plaque: enFace\.plaque \}\)/)
  const campagne = lu('views/CampagneApp.tsx')
  assert.match(campagne, /\.\.\.\(profil\?\.plaque && \{ plaque: profil\.plaque \}\)/)
  assert.match(campagne, /\.\.\.\(adversaire\.plaque && \{ plaque: adversaire\.plaque \}\)/)
})

test('la grande plaque des duels se lit sur tout ce qu’elle pose : le semis, le reflet, le socle', () => {
  const debut = CSS.indexOf('/* La grande plaque des duels')
  const bloc = CSS.slice(debut, CSS.indexOf('/* L\'accueil, quand un duel', debut))
  assert.ok(debut > 0 && bloc.length > 1000, 'le bloc de la grande plaque se trouve')
  const regles = bloc.replace(/\/\*[\s\S]*?\*\//g, '')
  // Ni masque, ni filtre, ni mouvement : des images aux couleurs écrites dedans (règle css.md).
  assert.doesNotMatch(regles, /mask|filter|animation|transform/)
  // `.carte-plaque` est la plaque du compagnon sur la carte d'un joueur, en absolu : la maquette l'avait empruntée.
  assert.doesNotMatch(regles, /carte-plaque/)
  const regle = (selecteur: string) => {
    const m = new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(regles)
    assert.ok(m, `la règle ${selecteur}`)
    return m![1]
  }
  const alpha = (corps: string, rgb: string) => Number(new RegExp(`rgba\\(${rgb}, (0\\.\\d+)\\)`).exec(corps)?.[1] ?? 0)

  // Le semis : le premier de la carte, peint sous ce qu'elle porte ; la case, qui écrit en petit, a son sol plein.
  const semis = regle('.duels-carte.plaque::before')
  assert.match(semis, /background: var\(--p-embleme\)/)
  const dosage = Number(/opacity: (0\.\d+);/.exec(semis)?.[1])
  assert.match(regle('.duels-carte.plaque .duels-carte-case'), /background: var\(--p-bg\);[^]*color: var\(--p-muted\);/)
  const reflet = alpha(regle('.duels-carte.plaque'), '255, 255, 255')
  const plaqueDuNom = regle('.duels-carte.plaque .duels-carte-son-nom,\n.duels-face-joueur.plaque > .duels-face-nom')
  const socle = regle('.duels-face-joueur.plaque')
  assert.ok(dosage > 0 && reflet > 0, `${dosage} · ${reflet}`)

  const tons = new Map([...CSS.matchAll(/\.plaque-([a-z]+) \{ --p-clair: (#[0-9a-f]{6}); --p-sombre: (#[0-9a-f]{6});/g)].map(m => [m[1], [m[2], m[3]]]))
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const melange = (a: string, b: string, t: number) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')
  const auPireSur = (couleur: string, fonds: string[]) => Math.min(...fonds.map(f => contraste(couleur, f)))
  const plaques = couleursDesPlaques(CSS)
  assert.equal(plaques.size, THEMES.length - 1)
  for (const [cle, c] of plaques) {
    const [clair, sombre] = tons.get(cle) ?? assert.fail(`${cle} : ses deux tons`)
    // La carte : son reflet en haut, le semis de ses deux tons par-dessus. L'encre y écrit « Toi » ; l'or, le « ? », le
    // sablier, le cadenas et son score — en grand : 3:1 (WCAG, un texte large).
    const carte = [c.bg, melange(c.bg, '#ffffff', reflet)].flatMap(f => [f, melange(f, clair, dosage), melange(f, sombre, dosage)])
    assert.ok(auPireSur(c.ink, carte) >= 4.5, `${cle} : l’encre sur la carte, ${auPireSur(c.ink, carte).toFixed(2)}`)
    assert.ok(auPireSur(c.or, carte) >= 3, `${cle} : l’or sur la carte, ${auPireSur(c.or, carte).toFixed(2)}`)
    // Le score joué de sa carte, à l'or, sur la case teintée d'or.
    assert.ok(contraste(c.or, melange(c.bg, c.or, 0.1)) >= 3, `${cle} : son score joué`)
    // La plaque du nom : son reflet en haut, son ombre en bas.
    const nom = [melange(c.bg, '#ffffff', alpha(plaqueDuNom, '255, 255, 255')), melange(c.bg, '#000000', alpha(plaqueDuNom, '0, 0, 0'))]
    assert.ok(auPireSur(c.ink, nom) >= 4.5, `${cle} : le nom sur sa plaque, ${auPireSur(c.ink, nom).toFixed(2)}`)
    // Le socle : les deux scores, en grand.
    const fondDuSocle = [melange(c.bg, '#ffffff', alpha(socle, '255, 255, 255')), melange(c.bg, '#000000', alpha(socle, '0, 0, 0'))]
    for (const [quoi, couleur] of [
      ['l’encre atténuée', c.muted],
      ['l’or', c.or],
    ] as const)
      assert.ok(auPireSur(couleur, fondDuSocle) >= 3, `${cle} : ${quoi} du score sur le socle, ${auPireSur(couleur, fondDuSocle).toFixed(2)}`)
  }
})

test('au banc : un duel classé dit la plaque de chacun — à sa carte, à la fin, au verdict —, jamais celle d’un masqué', async () => {
  const banc = await demarrer({ baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
    const [deLea, deTom] = base(banc, db => ['lea', 'tom'].map(login => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id))
    base(banc, db => {
      const achat = db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
      achat.run(deLea, 'kintsugi')
      achat.run(deTom, 'guinguette')
    })
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { plaque: 'kintsugi' }, lea, 'PUT')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { plaque: 'guinguette' }, tom, 'PUT')).status, 200)
    /** Une tentative jouée jusqu'au bout : `justes` bonnes réponses, puis des fautes. */
    const jouer = async (cookie: string, serie: string, justes: number) => {
      const qs = base(banc, db => JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie) as { questions: string }).questions)) as { bonne: number; reponses: string[] }[]
      let derniere: any = null
      for (let i = 0; i < qs.length; i++) {
        const r = await poster(banc, cookie, `/api/campagne/serie/${serie}/reponse`, { index: i, choix: i < justes ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length })
        assert.equal(r.status, 200, r.corps.error)
        derniere = r.corps
        if (r.corps.finie) break
      }
      return derniere
    }

    // Léa défie Tom et joue : chez Tom, la carte d'en face à la plaque de Léa, la sienne à la sienne.
    const lance = await poster(banc, lea, '/api/campagne/duel', { adversaire: deTom })
    assert.equal(lance.status, 200, lance.corps.error)
    const code: string = lance.corps.code
    await jouer(lea, lance.corps.serie.id, 4)
    const chezTom = (await lire(banc, tom, `/api/campagne/duel/${code}`)).corps
    assert.equal(chezTom.auteur.plaque, 'kintsugi')
    assert.equal(chezTom.contre.plaque, 'guinguette')
    assert.equal(chezTom.contre.toi, true)

    // Tom le relève et gagne : sa fin dit Léa avec sa plaque — son socle au verdict.
    const tentative = await poster(banc, tom, `/api/campagne/duel/${code}`)
    assert.equal(tentative.status, 200, tentative.corps.error)
    const fin = await jouer(tom, tentative.corps.id, 6)
    assert.equal(fin.finie, true)
    assert.deepEqual([fin.contre.nom, fin.contre.plaque], ['Léa', 'kintsugi'])
    // Chez Léa, la page du duel joué : Tom à la sienne, elle à la sienne.
    const chezLea = (await lire(banc, lea, `/api/campagne/duel/${code}`)).corps
    assert.deepEqual([chezLea.auteur.plaque, chezLea.contre.plaque], ['kintsugi', 'guinguette'])

    // Masquée au quiz du jour, Léa ne se nomme plus chez Tom, sa plaque non plus ; chez elle, si.
    const admin = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/admin/jour/masquer', { profileId: deLea, masque: true }, admin)).status, 200)
    const masquee = (await lire(banc, tom, `/api/campagne/duel/${code}`)).corps.auteur
    assert.equal(masquee.nom, 'Un joueur')
    assert.ok(!('plaque' in masquee), JSON.stringify(masquee))
    assert.equal((await lire(banc, lea, `/api/campagne/duel/${code}`)).corps.auteur.plaque, 'kintsugi')
    // Sans plaque, rien : absente plutôt que nulle.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { plaque: AUCUNE_PLAQUE }, tom, 'PUT')).status, 200)
    assert.ok(!('plaque' in (await lire(banc, lea, `/api/campagne/duel/${code}`)).corps.contre))
  } finally {
    await banc.close()
  }
})

// Les plaques de nom (le 10 novembre 2026, la maquette validée par le
// propriétaire, `retours/2026-11-10/plaques/`) : la ligne d'un joueur dans
// les classements, aux couleurs d'un thème qu'il possède. Un thème ne se
// voyait que sur le téléphone de qui le porte — six de vendus en production,
// pour seize compagnons — : la plaque est sa part visible. Ses règles sont
// pures (`shared/plaques.ts`), ses couleurs celles de son thème, et son motif
// ne passe jamais sous un texte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { contraste, teinte, themesDuClient } from './teintes'
import { AUCUNE_PLAQUE, choixDePlaque, plaqueDuTheme, plaquePortee, plaquesOuvertes } from '../../shared/plaques'
import { THEMES } from '../../shared/themes'
import { avecLEssai, essayer, lignesDeLEssai } from '../../shared/loge'
import { jourDe } from '../../shared/jour'

const CLIENT = new URL('../../client/src/', import.meta.url)
const lu = (chemin: string) => readFileSync(new URL(chemin, CLIENT), 'utf8')
const CSS = lu('styles.css')

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

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

test('la classe d’une plaque ne prend qu’une clé de thème', async () => {
  // Un composant du client : chargé par son adresse, le serveur ne compile pas de JSX.
  const { classeDeLaPlaque } = (await import(new URL('components/Plaque.tsx', CLIENT).href)) as { classeDeLaPlaque: (p: unknown) => string }
  assert.equal(classeDeLaPlaque('kintsugi'), ' plaque plaque-kintsugi')
  assert.equal(classeDeLaPlaque(null), '')
  assert.equal(classeDeLaPlaque(undefined), '')
  // Ce qui n'a pas la forme d'une clé n'entre pas dans une classe.
  for (const k of ['', 'a b', 'x"y', 'Kintsugi', 'plaque me', 'a-b']) assert.equal(classeDeLaPlaque(k), '', k)
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

  // Chaque plaque a un motif, et un seul.
  const motifs = [...CSS.matchAll(/^((?:\.plaque-[a-z]+,?\s*)+)\{\s*--p-motif:/gm)].flatMap(m => [...m[1].matchAll(/\.plaque-([a-z]+)/g)].map(x => x[1]))
  assert.deepEqual([...motifs].sort(), [...attendues].sort(), 'chaque plaque a son motif, une fois')

  // Plus forte que la ligne d'un thème, « la mienne » comprise : les thèmes repeignent `.lb-row` et `.lb-row.me`.
  assert.match(CSS, /:root body \.lb-row\.plaque:not\(\.team-row\) \{[^}]*background: var\(--p-bg\)/)
  for (const t of themesDuClient()) {
    for (const m of t.css.matchAll(/^:root\[data-theme='[a-z]+'\] ([^{]*\.lb-row[^{]*)\{/gm)) {
      const classes = (m[1].match(/\./g) ?? []).length
      assert.ok(classes <= 2, `${t.cle} : « ${m[1].trim()} » resterait plus fort que la plaque`)
    }
  }
  // Elle redit les jetons que la ligne lit : le rang, le prénom et le score suivent sans rien savoir.
  const ligne = /:root body \.lb-row\.plaque:not\(\.team-row\) \{([^}]*)\}/.exec(CSS)![1]
  for (const j of ['--ink: var(--p-ink)', '--muted: var(--p-muted)', '--accent-text: var(--p-or)']) assert.ok(ligne.includes(j), j)
})

test('le motif est une pièce de la ligne, jamais un fond sous le texte', () => {
  // Fondu par un dégradé, pas par un masque : dans une liste, rien ne garde un calque (règle css.md).
  const bloc = CSS.slice(CSS.indexOf('/* ── Les plaques de nom'), CSS.indexOf('/* ── Écran commun'))
  assert.ok(bloc.length > 1000, 'le bloc des plaques se trouve')
  assert.doesNotMatch(bloc.replace(/\/\*[\s\S]*?\*\//g, ''), /mask|filter|animation:(?!\s*none)|transform/, 'ni masque, ni filtre, ni mouvement')
  assert.match(bloc, /\.lb-row\.plaque > \.plaque-motif \{[^}]*flex: 1 1 0[^}]*background:[^;]*var\(--p-motif\)/)
  // Le fond d'une plaque est uni : `--p-motif` ne se lit que dans la pièce du motif.
  assert.equal((bloc.replace(/\/\*[\s\S]*?\*\//g, '').match(/var\(--p-motif\)/g) ?? []).length, 1)

  // Les trois classements la posent de la même façon : la classe sur la ligne, le motif juste après le prénom.
  for (const [fichier, n] of [
    ['views/JourApp.tsx', 1],
    ['views/Defi.tsx', 2],
    ['views/Duels.tsx', 1],
  ] as const) {
    const source = lu(fichier)
    assert.equal((source.match(/classeDeLaPlaque\(l\.plaque\)/g) ?? []).length, n, `${fichier} : la classe de la plaque sur sa ligne`)
    assert.match(source, /<\/span>\s*<MotifDeLaPlaque plaque=\{l\.plaque\} \/>/, `${fichier} : le motif après le prénom`)
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

  // Elle se choisit sous ses thèmes, et la fiche d'un thème la montre à la boutique.
  assert.match(lu('components/Boutique.tsx'), /<MaPlaque profil=\{profil\} essai=\{essai\} essayer=\{essayer\} \/>/)
  assert.match(lu('components/Presentoir.tsx'), /plaqueDuTheme\(t\.key\) && \([\s\S]{0,200}<LigneDePlaque profil=\{profil\} plaque=\{t\.key\} \/>/)
  // Un toucher essaie, rien ne s'enregistre d'ici.
  const piece = lu('components/MaPlaque.tsx')
  assert.match(piece, /onClick=\{\(\) => essayer\(\{ plaque: c\.cle \}\)\}/)
  assert.doesNotMatch(piece, /enregistrer|api\./)
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

// Les écrans du profil, à la manière de la maquette du 5 octobre 2026.
//
// Ce qu'on porte, rangé par qui le voit : « Mon avatar » (la salle — sa
// finition comprise), « Ma carte » (qui touche son nom — titre, vitrine,
// fond), « Mon thème » (lui seul — sa gerbe comprise). Ces écrans ne
// montrent que ce qu'on a ; tout le reste, et où le gagner, vit dans « Ma
// collection », où les avatars se parcourent en atlas : un rail des douze
// branches, chacune un orbe dont l'anneau se remplit, puis la branche
// choisie en chemin ; les légendaires et les Divins en grilles de
// médaillons.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { BRANCHES, ouvertsDansLaBranche } from '../../shared/branches'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'
import { GERBES } from '../../shared/gerbes'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' },
})

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// La branche la plus avancée ouvre l'atlas : trois portraits sur six, au
// palier de son sentier qui ouvre le troisième.
const avancee = BRANCHES[2]
const paliers = { [avancee.key]: avancee.portraits[2].palier }

const profil = {
  id: 'p',
  login: 'lea',
  name: 'Léa',
  avatar: '🦊',
  finition: 'mat',
  finitionChoisie: 'auto',
  niveau: 3,
  acquis: 40,
  requis: 100,
  titre: null,
  fond: null,
  theme: null,
  laurier: false,
  legendaire: null,
  legendaires: [LEGENDAIRES[0].key],
  divins: [],
  eclats: [],
  eclatsEteints: [],
  hautsFaits: [],
  sentiers: paliers,
  boutique: { confettis: { solde: 12 } },
}
const rien = { busy: false, enregistrer: () => {} }

test('le savoir en atlas : douze orbes sur deux rangées, la branche la plus avancée en chemin', async () => {
  const html = await rendu('components/AtlasDesAvatars', 'AtlasDesAvatars', { profil, ...rien, onglet: 'savoir' })
  assert.match(html, /<div class="atlas-rail rail-compact" role="tablist" aria-label="Les douze branches">/)
  assert.equal(html.match(/class="atlas-orbe"/g)?.length, BRANCHES.length)
  // Chaque orbe dit où il en est, en chiffres : l'anneau seul ne se lit pas.
  for (const b of BRANCHES) assert.match(html, new RegExp(`${ouvertsDansLaBranche(b, paliers)}/${b.portraits.length}`), b.nom)
  // La branche ouverte d'abord est celle où l'on avance — trois portraits gagnés, le quatrième qui palpite.
  assert.match(html, /<section class="atlas-branche"/)
  assert.equal(html.match(/class="atlas-etape atlas-gagne"/g)?.length, 3)
  assert.equal(html.match(/class="atlas-etape atlas-prochain"/g)?.length, 1)
  assert.equal(html.match(/class="atlas-etape atlas-ferme"/g)?.length, 2)
  // On passe d'une branche à l'autre aux flèches, sans repasser par le rail.
  assert.match(html, /aria-label="Branche précédente"/)
  assert.match(html, /aria-label="Branche suivante"/)
})

test('les légendaires et les Divins en grilles de médaillons, le compte en tête', async () => {
  const html = await rendu('components/AtlasDesAvatars', 'AtlasDesAvatars', { profil, ...rien, onglet: 'legendaires' })
  assert.doesNotMatch(html, /atlas-rail/, 'les légendaires n’ont pas le rail des branches')
  assert.match(html, new RegExp(`1 sur ${LEGENDAIRES.length}`))
  assert.equal(html.match(/class="hud-case[^"]*"/g)?.length, LEGENDAIRES.length + DIVINS.length)
  assert.equal(html.match(/class="hud-case hud-gagne"/g)?.length, 1)
  // Un Divin verrouillé ne dit rien de lui, pas même son nom (invariant 21).
  assert.match(html, /<div class="hud-grille hud-grille-divins">/)
  for (const d of DIVINS) assert.doesNotMatch(html, new RegExp(`aria-label="${d.nom}`), d.nom)
  assert.match(html, /Ils ne disent pas comment/)
})

// ── Ce qu'on porte : trois écrans, rangés par qui le voit ──────────────

/** Un profil tel que sa page le reçoit : de quoi rendre les écrans qu'on porte. */
const complet = {
  ...profil,
  ouvertes: ['mat'],
  vitrine: [],
  vitrineChoisie: null,
  fonds: [],
  gerbes: ['confettis'],
  gerbe: null,
  titresDates: [],
  boutique: { confettis: { gagnes: 12, depenses: 0, solde: 12 }, possedes: ['velours', 'ivoire'], porte: null, jour: '2026-10-05' },
}

/** Les titres des cartes d'un écran, dans l'ordre : ce qu'on y règle. */
const cartes = (html: string) => [...html.matchAll(/<h3>(?:<svg[^>]*>.*?<\/svg>)?([^<]+)/g)].map(m => m[1].trim())

test('le profil : deux groupes de tuiles — ce qu’on porte, chacune dit qui le voit ; ce qu’on a et ce qu’on a fait', () => {
  const app = source('views/ProfilApp.tsx')
  const ecrans = [...app.matchAll(/\{ id: '(\w+)', nom: '([^']+)', groupe: '([^']+)'/g)].map(([, id, nom, groupe]) => `${groupe} › ${nom} (#${id})`)
  assert.deepEqual(ecrans, [
    'Me changer › Mon avatar (#avatar)',
    'Me changer › Ma carte (#carte)',
    'Me changer › Mon thème (#theme)',
    'Me retrouver › Ma collection (#collection)',
    'Me retrouver › Ma carrière (#carriere)',
    'Me retrouver › Mes soirées (#soirees)',
  ])
  // Chaque tuile de ce qu'on porte dit qui le voit, et son écran le redit en tête.
  for (const qui of ['la salle le voit', 'en touchant ton nom', 'toi seul le vois']) assert.match(app, new RegExp(`qui="${qui}"`), qui)
  assert.match(app, /<PieceTete piece=\{e\.groupe\} titre=\{e\.nom\}>\s*\{e\.qui && <p className="muted qui-le-voit">\{e\.qui\}<\/p>\}/)
  // Trois par rangée, puis la collection couchée sur la sienne.
  assert.match(app, /<div className="tuiles tuiles-trois">/)
  assert.match(source('styles.css'), /\.tuiles-trois \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/)
  // Chaque écran a son panneau, chargé à la demande.
  for (const [ecran, panneau] of [['avatar', 'PanneauMonAvatar'], ['carte', 'PanneauMaCarte'], ['theme', 'PanneauMonTheme'], ['collection', 'PanneauCollection']])
    assert.match(app, new RegExp(`\\{ecran === '${ecran}' && \\(pret \\? <pret\\.${panneau} `), ecran)
})

test('une tuile montre ce qu’on porte et qui le voit ; la collection se couche, son compte et sa jauge', async () => {
  const porte = await rendu('components/Pieces', 'Tuile', { apercu: React.createElement('i'), titre: 'Mon thème', detail: 'Velours', qui: 'toi seul le vois', onClick: () => {} })
  assert.match(porte, /^<button type="button" class="tuile tuile-a-apercu"><span class="tuile-apercu" aria-hidden="true"><i><\/i><\/span><b>Mon thème<\/b>/)
  assert.match(porte, /<span class="tuile-qui"><svg[^>]*>.*<\/svg>toi seul le vois<\/span><\/button>$/)
  const large = await rendu('components/Pieces', 'Tuile', { icone: 'award', titre: 'Ma collection', compte: '27 sur 308', jauge: 0.09, detail: 'Avatars', onClick: () => {} })
  assert.match(large, /^<button type="button" class="tuile tuile-large"><span class="gros-icone">/)
  assert.match(large, /<b>Ma collection<span class="tuile-compte">27 sur 308<\/span><\/b><span class="jauge-fine" aria-hidden="true"><span style="width:9%"><\/span><\/span>/)
  // Sans aperçu ni jauge : la tuile de toujours.
  assert.match(await rendu('components/Pieces', 'Tuile', { icone: 'book', titre: 'Mes soirées', onClick: () => {} }), /^<button type="button" class="tuile"><span class="gros-icone">/)
})

test('« Mon avatar » : sa carte collée en tête, la finition sur sa ligne, ses avatars à lui — le reste, dans la collection', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauMonAvatar', { profil: complet, ...rien })
  assert.match(html, /^<div class="identite-collante"><button type="button" class="identite"/, 'sa carte en tête : c’est elle qui change')
  // La finition se lit sur sa ligne et se déplie : dépliée d'office, ses huit
  // cases repoussaient les avatars de plus d'un écran.
  assert.match(html, /<button type="button" aria-expanded="false" aria-controls="mes-finitions">.*<span class="style-nom">Finition<\/span><span class="style-valeur">Auto · Mat<\/span>/)
  assert.doesNotMatch(html, /class="finitions"/)
  assert.ok(html.indexOf('Finition') < html.indexOf('Mes avatars'), 'la finition avant les avatars')
  // Seulement ce qu'il a : rien de fermé, et le compte dit « à toi ».
  assert.match(html, /Mes avatars <span class="muted small titre-compte">\d+ à toi<\/span>/)
  assert.doesNotMatch(html, /case-avatar[^"]* ferme/)
  // Ce qui reste, et où le gagner : un lien vers la collection, compté.
  const { compteDeLaCollection } = await import('../../shared/collection')
  const avatars = compteDeLaCollection(complet as any).familles.find(f => f.famille === 'avatars')!
  assert.match(html, new RegExp(`<a class="link-inline lien-boutique" href="#collection">.*${avatars.total - avatars.acquis} autres à gagner : où et comment, dans « Ma collection »</a>`))
  // La carte reste collée pendant qu'on choisit.
  assert.match(source('styles.css'), /\.identite-collante \{ position: sticky; top: 0;/)
})

test('« Ma carte » : son titre, sa vitrine et son fond — la vitrine a quitté les trophées', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauMaCarte', { profil: complet, ...rien })
  assert.match(html, /^<div class="identite-collante"><button type="button" class="identite"/)
  assert.deepEqual(cartes(html), ['Mon titre', 'Ma vitrine', 'Le fond de ma carte'])
  assert.match(html, /Le reste de ta carte se remplit tout seul : tes légendaires, tes écussons, tes chiffres, tes prix\./)
})

test('« Mon thème » : ses thèmes, deux liens vers ce qu’il n’a pas, puis sa gerbe', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauMonTheme', { profil: complet, ...rien })
  assert.ok(html.indexOf('class="mes-themes"') < html.indexOf('Ma gerbe'), 'le thème, puis la gerbe')
  // Ce qui s'achète à la boutique, ce qui se gagne dans la collection : pas sur l'écran où l'on choisit.
  assert.match(html, /<a class="link-inline lien-boutique" href="\/boutique"><svg[^>]*>.*?<\/svg>\d+ autres à la boutique<\/a>/)
  assert.match(html, /<a class="link-inline lien-boutique" href="#collection-themes"><svg[^>]*>.*?<\/svg>5 qui ne se vendent pas : où les gagner<\/a>/)
  // Seulement ceux qu'il a, dans leurs cartes : les autres se montrent dans la collection.
  assert.equal(html.match(/<button type="button" class="theme-vitrine/g)?.length, complet.boutique.possedes.length)
})

// « Les gerbes, à améliorer » (le 10 octobre 2026) : celles à gagner étaient
// fermées au doigt — on ne savait pas ce qu'on visait. Elles éclatent au
// toucher, sans se porter ; et « Aucune » se demande, puisque sans choix
// chacun porte les confettis.
test('« Ma gerbe » : celles à gagner se touchent pour se voir, sans se porter ; « Aucune » se demande', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauMonTheme', { profil: complet, ...rien })
  const gerbes = html.slice(html.indexOf('gerbes-choix'))
  assert.doesNotMatch(gerbes, /<button[^>]*disabled=""/, 'aucune gerbe ne se ferme au doigt')
  assert.equal(gerbes.match(/class="finition-btn gerbe-a-gagner"/g)?.length, GERBES.length - complet.gerbes.length)
  assert.match(gerbes, /, à gagner : touche-la pour la voir/)
  const APPARENCE = source('components/Apparence.tsx')
  assert.match(APPARENCE, /onClick=\{\(\) => enregistrer\(\{ gerbe: AUCUNE_GERBE \}\)\}/)
  assert.match(APPARENCE, /if \(ouverte && !choisie\) enregistrer\(\{ gerbe: g\.key \}\)/)
})

// ── Les trophées, la carrière, les soirées ─────────────────────────────

const releve = (qcm: number, justes: number, rang: number) => ({
  questions: qcm,
  reponses: qcm,
  qcm,
  justes,
  tempsJustesMs: justes * 3000,
  meilleurTempsMs: 1800,
  reflexes: 0,
  premiers: 0,
  meilleureSerie: 2,
  estimations: 0,
  estimationsExactes: 0,
  estimationsProches: 0,
  ecartRelatif: 0,
  estimationsComparees: 0,
  coupDOeil: 0,
  rang,
})

const vecu = {
  ...profil,
  vitrine: [],
  vitrineChoisie: null,
  fiche: {
    soirees: 2,
    reponses: 30,
    precision: 0.8,
    qcm: 20,
    justes: 16,
    coupDOeil: null,
    estimationsComparees: 0,
    reflexeMoyenMs: 2200,
    meilleurTempsMs: 1800,
    meilleureSerie: 6,
    quizGagnes: 1,
    podiumsQuiz: 2,
    estimationsExactes: 0,
    flair: null,
    hotes: 2,
  },
  categories: { Histoire: { questions: 10, justes: 9 }, Sciences: { questions: 10, justes: 7 } },
  soirees: [
    { soireeId: 's2', chez: 'Antoine', slug: 'chez-antoine', titre: 'Soirée jeux', joueurId: 'j2', xp: 214, gain: {}, releve: releve(10, 8, 1), at: Date.UTC(2026, 8, 29, 19) },
    { soireeId: 's1', chez: 'Hugo', slug: 'chez-hugo', titre: null, joueurId: null, xp: 120, gain: {}, releve: releve(10, 8, 4), at: Date.UTC(2025, 8, 20, 19) },
  ],
  prix: [{ key: 'prix:eclair', emoji: '⚡', title: 'L’Éclair', rule: 'Le plus rapide', fois: 1 }],
}

test('les trophées : sept collections qu’on déplie, une à la fois — la vitrine se règle dans « Ma carte »', async () => {
  const html = await rendu('components/TropheesAtlas', 'TropheesAtlas', { profil: vecu })
  assert.doesNotMatch(html, /vitrine/i, 'la vitrine a sa place dans « Ma carte »')
  const lignes = [...html.matchAll(/<span class="trophee-texte"><b>([^<]+)<\/b>/g)].map(([, nom]) => nom)
  // La campagne a la sienne depuis ses hauts faits de série (le 5 octobre 2026).
  assert.deepEqual(lignes, ['Hauts faits', 'Coups du sort', 'Paliers', 'Écussons', 'Prix', 'Quiz du jour', 'Campagne'])
  // Toutes repliées à l'ouverture : la page tient en un écran.
  assert.equal(html.match(/aria-expanded="false"/g)?.length, 7)
  assert.doesNotMatch(html, /trophee-contenu/)
  assert.match(html, /1\/1<span class="jauge-fine"/, 'les prix : un sur un')
  // Elles vivent dans « Ma collection », sous les avatars et le style.
  assert.match(source('components/Collection.tsx'), /f\.famille === 'trophees' \? <TropheesAtlas profil=\{profil\} \/>/)
})

test('la carrière : trois jauges jamais fondues, les chiffres en cases, quatre vues', async () => {
  const html = await rendu('components/CarriereAtlas', 'CarriereAtlas', { profil: vecu })
  const jauges = [...html.matchAll(/<span class="hud-jauge-valeur">([^<]+)<\/span><figcaption><b>([^<]+)<\/b>/g)].map(([, v, nom]) => `${nom} ${v}`)
  // Sans estimation comparée, le coup d'œil dit « — », jamais « 0 % ».
  assert.deepEqual(jauges, ['Précision 80 %', 'Coup d’œil —', 'Flair —'])
  assert.match(html, /16 sur 20 QCM/)
  assert.equal(html.match(/class="atlas-orbe"/g)?.length, 4)
  assert.match(html, /<div class="atlas-rail" role="tablist" aria-label="Ma carrière">/)
  // Tous les chiffres d'avant restent, en cases : rien ne se perd au passage.
  for (const mot of ['soirées', 'quiz gagnés', 'podiums', 'réflexe moyen', 'record de vitesse', 'meilleure série', 'réponses', 'estimations exactes', 'hôtes différents'])
    assert.match(html, new RegExp(`</b>${mot}</span>`), mot)
  assert.match(html, /Soirée après soirée/)
})

test('mes soirées : chez moi ou ailleurs, une carte chacune, le souvenir et son bilan d’un toucher', async () => {
  const html = await rendu('components/MesSoirees', 'MesSoirees', { profil: vecu, monEspace: 'chez-antoine' })
  const filtres = [...html.matchAll(/aria-pressed="(true|false)">([^<]+) <span class="rayon-compte">(\d+)<\/span>/g)].map(([, ici, nom, n]) => `${nom.trim()} ${n}${ici === 'true' ? ' (ici)' : ''}`)
  assert.deepEqual(filtres, ['Toutes 2 (ici)', 'Chez moi 1', 'Ailleurs 1'])
  assert.equal(html.match(/<li class="soiree-carte">/g)?.length, 2)
  // La soirée de son salon se reconnaît à sa date cerclée.
  assert.equal(html.match(/soiree-date soiree-chez-moi/g)?.length, 1)
  assert.match(html, /<a class="soiree-nom" href="\/chez-antoine\/soirees\/s2\/souvenir">Soirée jeux<\/a>/)
  assert.match(html, /href="\/chez-antoine\/soirees\/s2\/bilan#p=j2">Mon bilan<\/a>/)
  // L'année ne s'écrit que pour une soirée d'une autre année.
  assert.equal(html.match(/class="soiree-annee"/g)?.length, 1)
  // Sans salon à lui, pas de filtres : « Chez moi » n'y voudrait rien dire.
  const sansSalon = await rendu('components/MesSoirees', 'MesSoirees', { profil: vecu, monEspace: null })
  assert.doesNotMatch(sansSalon, /rayons-texte/)
  const app = source('views/ProfilApp.tsx')
  assert.match(app, /<pret\.PanneauSoirees profil=\{profil\} monEspace=\{espace\?\.slug\} \/>/)
  assert.match(app, /<pret\.PanneauCarriere profil=\{profil\} \/>/)
})

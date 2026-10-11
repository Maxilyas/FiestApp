// Les écrans du profil, à la manière de la maquette du 5 octobre 2026.
//
// Ce qu'on porte, une page par pièce, que sa place sur la carte ouvre (le
// vestiaire) : « Mon avatar » (la salle — sa finition comprise), « Mon
// titre », « Ma vitrine », « Mon fond de carte » (qui touche son nom), « Mon
// thème », « Ma gerbe » (lui seul). Ces pages ne montrent que ce qu'on a ;
// tout le reste, et où le gagner, vit dans « Ma collection », où les avatars
// se parcourent en atlas : un rail des douze branches, chacune un orbe dont
// l'anneau se remplit, puis la branche choisie en chemin ; les légendaires
// et les Divins en grilles de médaillons.
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

// ── Ce qu'on porte : une page par pièce ────────────────────────────────

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

test('le profil : ce qu’on porte en une image qu’on touche, puis ce qu’on a et ce qu’on a fait', () => {
  const app = source('views/ProfilApp.tsx')
  const ecrans = [...app.matchAll(/\{ id: '(\w+)', nom: '([^']+)', groupe: '([^']+)'/g)].map(([, id, nom, groupe]) => `${groupe} › ${nom} (#${id})`)
  assert.deepEqual(ecrans, [
    'Me changer › Mon avatar (#avatar)',
    'Me changer › Mon titre (#titre)',
    'Me changer › Ma vitrine (#vitrine)',
    'Me changer › Mon fond de carte (#fond)',
    'Me changer › Mon thème (#theme)',
    'Me changer › Ma gerbe (#gerbe)',
    'Me retrouver › Ma collection (#collection)',
    'Me retrouver › Ma carrière (#carriere)',
    'Me retrouver › Mes soirées (#soirees)',
  ])
  // Chaque page de ce qu'on porte a son icône, et redit en tête qui la voit, l'œil devant.
  assert.match(app, /<PieceTete piece=\{e\.groupe\} titre=\{e\.nom\} icone=\{e\.icone\}>\s*\{e\.qui && \(\s*<p className="muted qui-le-voit">\s*<Icon name="eye" \/>\s*\{e\.qui\}/)
  for (const [id, icone] of [['avatar', 'sparkles'], ['titre', 'star'], ['vitrine', 'award'], ['fond', 'image'], ['theme', 'palette'], ['gerbe', 'zap']])
    assert.match(app, new RegExp(`\\{ id: '${id}', nom: '[^']+', groupe: 'Me changer', icone: '${icone}', qui: '`), id)
  // « Me changer » : le vestiaire, qui ouvre les pages par la même porte que les tuiles.
  assert.match(app, /<Vestiaire profil=\{profil\} apercus=\{plus\} nomPorte=\{[^}]+\} onOuvrir=\{ouvrir\} \/>/)
  assert.doesNotMatch(app, /tuiles-trois/)
  // Plus de partie d'écran où faire défiler (`#carte-vitrine`) : une adresse, une page.
  assert.doesNotMatch(app, /h\.startsWith\(`\$\{e\.id\}-`\)/)
  // Chaque écran a son panneau, chargé à la demande.
  for (const [ecran, panneau] of [
    ['avatar', 'PanneauMonAvatar'],
    ['titre', 'PanneauMonTitre'],
    ['vitrine', 'PanneauMaVitrine'],
    ['fond', 'PanneauMonFond'],
    ['theme', 'PanneauMonTheme'],
    ['gerbe', 'PanneauMaGerbe'],
    ['collection', 'PanneauCollection'],
  ])
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

// Le souhait du propriétaire du 11 octobre 2026 : « quelque chose de visuel
// qui permettrait de cliquer sur les différents éléments ». Trois tuiles
// rangeaient ce qu'on porte par écran, et l'on devinait laquelle changeait
// son titre.
test('le vestiaire : sa carte telle que la salle la voit, chaque pièce un bouton qui dit qu’il se change, et qui le voit', async () => {
  const apercus = { vitrine: [{ emoji: '🔥', nom: 'Le Phénix' }], fond: 'Velours', gerbe: { nom: 'Les confettis', particules: ['🎊', '🎉'] }, apercuDuTheme: '/apercu.webp' }
  const html = await rendu('components/Vestiaire', 'Vestiaire', { profil: complet, apercus, nomPorte: 'ton emoji · Mat', onOuvrir: () => {} })
  for (const etiquette of [
    'Mon avatar, ton emoji · Mat : le changer',
    'Choisir un titre',
    'Ma vitrine, Le Phénix : la changer',
    'Le fond de ma carte, Velours : le changer',
    'Mon thème, Velours : le changer',
    'Ma gerbe, Les confettis : la changer',
  ])
    assert.match(html, new RegExp(`<button type="button" class="[^"]*" aria-label="${etiquette}"`), etiquette)
  // Chaque pièce porte le crayon de ce qui se change ; la vitrine garde ses trois cases, vides en pointillés.
  assert.equal(html.match(/<span class="vestiaire-case( vestiaire-vide)?">/g)?.length, 3)
  assert.equal(html.match(/class="vestiaire-case vestiaire-vide"/g)?.length, 2)
  // Qui voit quoi : la salle, l'avatar et la carte ; lui seul, son thème et sa gerbe.
  // (L'espace fine avant le point-virgule, l'insécable avant les deux-points : `espacesFines`.)
  assert.match(html, /La salle voit ton avatar ; ta carte s’ouvre quand on touche ton nom\./)
  assert.match(html, /Toi seul les vois : ton thème habille tes pages, ta gerbe éclate à tes bonnes réponses\./)
  // Le thème et la gerbe côte à côte, chacun son bouton : l'écran d'une question sous le thème, les particules de la gerbe.
  assert.match(html, /<div class="vestiaire-pour-moi"><button type="button" class="vestiaire-perso" aria-label="Mon thème, Velours : le changer"><span class="mini-theme" aria-hidden="true"><img src="\/apercu\.webp"/)
  assert.match(html, /<span class="mini-gerbe" aria-hidden="true"><span>🎊<\/span><span>🎉<\/span><\/span><b>Ma gerbe<\/b><span class="vestiaire-valeur">Les confettis<\/span>/)
  // Sa carte entière, d'un lien : comme la salle la voit.
  assert.match(html, /Voir ma carte en entier, comme la salle/)
  // Chaque pièce mène à sa page, et à rien d'autre : plus de partie d'un écran où défiler.
  const code = source('components/Vestiaire.tsx')
  for (const ecran of ['avatar', 'titre', 'vitrine', 'fond', 'theme', 'gerbe']) assert.match(code, new RegExp(`onOuvrir\\('${ecran}'\\)`), ecran)
  assert.doesNotMatch(code, /onOuvrir\('\w+', /)
  // Sans gerbe — il n'en veut aucune —, la place le dit, en pointillés.
  const sansGerbe = await rendu('components/Vestiaire', 'Vestiaire', { profil: complet, apercus: { ...apercus, gerbe: null }, nomPorte: 'ton emoji', onOuvrir: () => {} })
  assert.match(sansGerbe, /aria-label="Ma gerbe, Aucune : la changer"><span class="mini-gerbe mini-gerbe-vide" aria-hidden="true"><\/span>/)
  // Son titre porté s'y écrit, entre guillemets.
  const titre = await rendu('components/Vestiaire', 'Vestiaire', { profil: { ...complet, titre: 'hf:phenix' }, apercus, nomPorte: 'ton emoji', onOuvrir: () => {} })
  assert.match(titre, /aria-label="Mon titre, Le Phénix : le changer">« Le Phénix »/)
})

// Le souhait du propriétaire du 11 octobre 2026 : « il faudrait que chaque
// composant ait une page dédiée pour pas que lorsque l'on clique sur modifier
// on tombe au milieu d'une page », et les gerbes et les thèmes, « qui ne
// devraient pas être dans le même onglet ». « Ma carte » rangeait titre,
// vitrine et fond, et le vestiaire faisait défiler jusqu'à la pièce touchée ;
// « Mon thème » posait la gerbe sous les thèmes.
test('chaque pièce qu’on porte a sa page : sa carte en tête quand la salle la voit, et sa seule pièce', async () => {
  for (const [panneau, titres] of [
    ['PanneauMonTitre', ['Mes titres']],
    ['PanneauMaVitrine', ['Sur ta carte']],
    ['PanneauMonFond', ['Mes fonds']],
  ] as const) {
    const html = await rendu('components/PanneauxDuProfil', panneau, { profil: complet, ...rien })
    assert.match(html, /^<div class="identite-collante"><button type="button" class="identite"/, `${panneau} : sa carte en tête, qui change sous ses yeux`)
    assert.deepEqual(cartes(html), titres, panneau)
  }
  // Le reste de la carte se remplit tout seul : la page de la vitrine le dit.
  assert.match(await rendu('components/PanneauxDuProfil', 'PanneauMaVitrine', { profil: complet, ...rien }), /Le reste de ta carte se remplit tout seul : tes légendaires, tes écussons, tes chiffres, tes prix\./)
  // Le thème et la gerbe, chacun sa page, sans carte en tête : la salle n'en voit rien.
  const theme = await rendu('components/PanneauxDuProfil', 'PanneauMonTheme', { profil: complet, ...rien })
  assert.match(theme, /^<section class="mes-themes">/)
  assert.doesNotMatch(theme, /gerbes-choix|Mes gerbes/, 'la gerbe a sa page')
  const gerbe = await rendu('components/PanneauxDuProfil', 'PanneauMaGerbe', { profil: complet, ...rien })
  assert.match(gerbe, /^<section class="card"><h3>/)
  assert.deepEqual(cartes(gerbe), ['Mes gerbes'])
  assert.doesNotMatch(gerbe, /mes-themes|theme-vitrine/, 'les thèmes ont leur page')
  // Plus rien ne défile jusqu'à une partie : chaque page s'ouvre en haut.
  assert.doesNotMatch(source('components/PanneauxDuProfil.tsx'), /scrollIntoView|ancre-du-vestiaire|PanneauMaCarte/)
  assert.doesNotMatch(source('styles.css'), /\.ancre-du-vestiaire/)
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

test('« Mon thème » : ses thèmes, deux liens vers ce qu’il n’a pas — sa gerbe a sa page', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauMonTheme', { profil: complet, ...rien })
  assert.doesNotMatch(html, /Mes gerbes|gerbes-choix/, 'la gerbe a sa page')
  // Ce qui s'achète à la boutique, ce qui se gagne dans la collection : pas sur l'écran où l'on choisit.
  assert.match(html, /<a class="link-inline lien-boutique" href="\/boutique"><svg[^>]*>.*?<\/svg>\d+ autres à la boutique<\/a>/)
  assert.match(html, /<a class="link-inline lien-boutique" href="#collection-themes"><svg[^>]*>.*?<\/svg>5 qui ne se vendent pas : où les gagner<\/a>/)
  // Seulement ceux qu'il a, dans leurs cartes : les autres se montrent dans la collection.
  assert.equal(html.match(/<button type="button" class="theme-vitrine/g)?.length, complet.boutique.possedes.length)
})

// « Les gerbes, à améliorer » (le 10 octobre 2026) : celles à gagner étaient
// fermées au doigt — on ne savait pas ce qu'on visait. Elles éclatent au
// toucher, sans se porter ; et « Aucune » se demande, puisque sans choix
// chacun porte les confettis. Puis le 11 octobre 2026 : « que ça ne soit pas
// mélangé avec la collection » — « Ma gerbe » ne montre que les siennes, et
// celles à gagner éclatent dans sa collection.
test('« Ma gerbe » : les siennes seulement, « Aucune » se demande — celles à gagner éclatent dans la collection', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauMaGerbe', { profil: complet, ...rien })
  const gerbes = html.slice(html.indexOf('gerbes-choix'))
  assert.doesNotMatch(gerbes, /<button[^>]*disabled=""/, 'aucune gerbe ne se ferme au doigt')
  assert.doesNotMatch(gerbes, /gerbe-a-gagner/)
  assert.equal(gerbes.match(/class="finition-btn( selected)?"/g)?.length, 1 + complet.gerbes.length, 'Aucune, et les siennes')
  const reste = GERBES.length - complet.gerbes.length
  assert.match(gerbes, new RegExp(`<a class="link-inline lien-boutique" href="#collection-gerbes"><svg[^>]*>.*?</svg>${reste} autres gerbes à gagner : où et comment, dans « Ma collection »</a>`))
  const APPARENCE = source('components/Apparence.tsx')
  assert.match(APPARENCE, /onClick=\{\(\) => enregistrer\(\{ gerbe: AUCUNE_GERBE \}\)\}/)
  assert.match(APPARENCE, /if \(!choisie\) enregistrer\(\{ gerbe: g\.key \}\)/)
  // Le fond et la finition de même : ce qu'il a, puis le chemin de la collection.
  const carte = await rendu('components/PanneauxDuProfil', 'PanneauMonFond', { profil: complet, ...rien })
  assert.match(carte, /href="#collection-fonds"><svg[^>]*>.*?<\/svg>7 autres fonds à gagner : où et comment, dans « Ma collection »<\/a>/)
  assert.doesNotMatch(carte, /fonds-choix.*disabled=""/)
  const avatar = await rendu('components/Apparence', 'MesFinitions', { profil: complet, ...rien })
  assert.match(avatar, /href="#collection-finitions"><svg[^>]*>.*?<\/svg>6 autres finitions à gagner : où et comment, dans « Ma collection »<\/a>/)
  // Dans la collection, chaque gerbe se touche pour éclater, même à gagner.
  const COLLECTION = source('components/Collection.tsx')
  assert.match(COLLECTION, /onToucher=\{cle => setGerbeVue\(a => \(\{ cle, n: \(a\?\.n \?\? 0\) \+ 1 \}\)\)\}/)
  assert.match(COLLECTION, /\{gerbeVue && <GerbeDeJuste key=\{gerbeVue\.n\} cle=\{gerbeVue\.cle\} \/>\}/)
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

test('les trophées : dix collections qu’on déplie, une à la fois, rangées par où elles se gagnent — la vitrine se règle dans « Ma vitrine »', async () => {
  const html = await rendu('components/TropheesAtlas', 'TropheesAtlas', { profil: vecu })
  assert.doesNotMatch(html, /vitrine/i, 'la vitrine a sa page, « Ma vitrine »')
  const lignes = [...html.matchAll(/<span class="trophee-texte"><b>([^<]+)<\/b>/g)].map(([, nom]) => nom)
  // La campagne a les siennes depuis ses hauts faits de série (le 5 octobre
  // 2026) ; chacune dans la section de son lieu depuis le 10 octobre 2026.
  assert.deepEqual(lignes, [
    'Hauts faits',
    'Coups du sort',
    'Prix',
    'Paliers des soirées',
    'Hauts faits du jour',
    'Paliers du jour',
    'Hauts faits de campagne',
    'Paliers de campagne',
    'Écussons',
    'Paliers de toujours',
  ])
  // Toutes repliées à l'ouverture.
  assert.equal(html.match(/aria-expanded="false"/g)?.length, 10)
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

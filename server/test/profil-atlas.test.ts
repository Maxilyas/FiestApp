// Les écrans du profil, à la manière de la maquette du 5 octobre 2026.
//
// Ce qu'on porte, dans la loge (la maquette validée le 12 octobre 2026),
// derrière le bouton « M'habiller » du profil : ses six pièces — l'avatar
// (la salle — sa finition comprise), le titre, la vitrine, le fond, le
// thème, la gerbe (lui seul) —, sa carte en tête. La loge ne montre que ce qu'on a ;
// tout le reste, et où le gagner, vit dans « Ma collection », où les avatars
// se rangent en album, une page par rareté (la maquette 1 du 13 octobre 2026 ;
// un rail des douze branches et des grilles de légendaires l'avaient
// précédé). La loge elle-même : `loge.test.ts` ; l'album : `ma-collection.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { BRANCHES, ouvertsDansLaBranche } from '../../shared/branches'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'
import { COMPAGNONS } from '../../shared/compagnons'
import { GERBES } from '../../shared/gerbes'
import { FINITIONS } from '../../shared/profil'

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

// Une branche avancée : trois portraits sur six, au palier de son sentier qui
// ouvre le troisième.
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
/** Ce que reçoit une pièce de la loge : rien d'essayé encore. */
const loge = { ...rien, essai: {}, essayer: () => {} }
/** La loge ouverte sur une pièce. */
const laLoge = (piece: string, p: object = complet) =>
  rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: p, piece, onPiece: () => {}, busy: false, enregistrer: async () => true })

/** L'album des avatars de « Ma collection », ouvert sur une page. */
const album = (page: string, p: object = profil) => rendu('components/AlbumDesAvatars', 'AlbumDesAvatars', { profil: p, page, onPage: () => {} })

/** Les cases d'une page de l'album, par ce qu'elles disent à l'oreille. */
const casesDeLAlbum = (html: string) => [...html.matchAll(/class="album-case([^"]*)" aria-expanded="false" aria-label="([^"]+)"/g)].map(m => ({ aLui: !m[1].includes('album-manque'), nom: m[2] }))

test('le savoir dans l’album : chaque portrait sur la page de sa rareté — trois portraits d’une branche, trois pages qui s’allument', async () => {
  const { pageDuDebut } = await import('../../shared/album')
  // Rien de porté : l'album s'ouvre sur la première page où il reste à gagner.
  assert.equal(pageDuDebut(profil as any), 'commune')
  // Le visage, le deuxième et le troisième portrait de sa branche : en couleur, chacun sur sa page, en tête.
  for (const [page, rang] of [['commune', 0], ['peucommune', 1], ['rare', 2]] as const) {
    const cases = casesDeLAlbum(await album(page))
    assert.deepEqual(cases[0], { aLui: true, nom: `${avancee.portraits[rang].nom}, ${{ commune: 'commune', peucommune: 'peu commune', rare: 'rare' }[page]}, à toi` }, page)
  }
  // Les autres portraits de sa branche attendent sur leurs pages, en silhouette, et disent où se gagner —
  // à côté de la troisième forme de chaque compagnon.
  const epique = casesDeLAlbum(await album('epique'))
  assert.equal(epique.length, BRANCHES.length + COMPAGNONS.length)
  assert.equal(epique.filter(c => !c.aLui && c.nom.endsWith(', épique, à gagner sur les sentiers')).length, BRANCHES.length)
  // Chacun à son genre : « en la portant », pour la tortue.
  for (const c of COMPAGNONS) {
    assert.equal(epique.filter(x => !x.aLui && x.nom === `${c.formes[2].nom}, épique, à gagner en boutique, puis à 300 bonnes réponses en ${c.le} portant`).length, 1, c.key)
  }
  assert.ok(epique.some(x => x.nom === 'La tortue-bosquet, épique, à gagner en boutique, puis à 300 bonnes réponses en la portant'))
  // Chaque gemme dit où il en est, en chiffres : la couleur seule ne se lit pas.
  // Les compagnons y ont aussi leur forme, une par page : trois de plus.
  const html = await album('commune')
  assert.match(html, /aria-label="Rare, 1 sur 27"/)
  assert.match(html, new RegExp(`aria-label="Légendaire, 1 sur ${LEGENDAIRES.length + BRANCHES.length + COMPAGNONS.length}"`))
  assert.equal(ouvertsDansLaBranche(avancee, paliers), 3)
})

test('les légendaires et les Divins dans l’album, le compte en tête — un Divin voilé ne dit rien de lui', async () => {
  const html = await album('legendaire')
  assert.match(html, new RegExp(`<b>Légendaire · 1 sur ${LEGENDAIRES.length + BRANCHES.length + COMPAGNONS.length}\\.</b>`))
  const cases = casesDeLAlbum(html)
  assert.equal(cases.length, LEGENDAIRES.length + BRANCHES.length + COMPAGNONS.length)
  assert.deepEqual(cases.filter(c => c.aLui).map(c => c.nom), [`${LEGENDAIRES[0].nom}, légendaire, à toi`])
  // Un Divin verrouillé ne dit rien de lui, pas même son nom (invariant 21).
  const divins = await album('divin')
  assert.equal(casesDeLAlbum(divins).length, DIVINS.length)
  for (const d of DIVINS) assert.ok(!divins.includes(d.nom), d.nom)
  assert.match(divins, /Ils ne disent pas comment/)
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

// Le souhait du propriétaire du 12 octobre 2026 : « un bouton pour la loge…
// comme ça le profil est épuré, un bouton pour s'habiller, collection,
// soirée et carrière » — sans la carte, le thème ni la gerbe sur la page.
test('le profil épuré : qui l’on est, puis quatre boutons — la loge derrière « M’habiller »', async () => {
  const app = source('views/ProfilApp.tsx')
  const ecrans = [...app.matchAll(/\{ id: '(\w+)', nom: '([^']+)', groupe: '([^']+)'/g)].map(([, id, nom, groupe]) => `${groupe} › ${nom} (#${id})`)
  assert.deepEqual(ecrans, [
    'M’habiller › Mon avatar (#avatar)',
    'M’habiller › Mon titre (#titre)',
    'M’habiller › Ma vitrine (#vitrine)',
    'M’habiller › Mon fond de carte (#fond)',
    'M’habiller › Mon thème (#theme)',
    'M’habiller › Ma gerbe (#gerbe)',
    'Mon profil › Ma collection (#collection)',
    'Mon profil › Ma carrière (#carriere)',
    'Mon profil › Mes soirées (#soirees)',
  ])
  // Chaque pièce de la loge a son icône — celle de sa page d'avant —, et redit sous la rangée qui la voit, l'œil devant.
  const TETE = source('components/LogeTete.tsx')
  assert.match(TETE, /<p className="muted loge-qui">\s*<Icon name="eye" \/>\s*\{espacesFines\(pieceDuPanneau\.qui\)\}/)
  for (const [id, icone] of [['avatar', 'sparkles'], ['titre', 'star'], ['vitrine', 'award'], ['fond', 'image'], ['theme', 'palette'], ['gerbe', 'zap']])
    assert.match(TETE, new RegExp(`const ICONES: Record<PieceDeLaLoge, IconName> = \\{[^}]*\\b${id}: '${icone}'`), id)
  const PIECES = readFileSync(new URL('../../shared/piecesDeLaLoge.ts', import.meta.url), 'utf8')
  for (const id of ['avatar', 'titre', 'vitrine', 'fond', 'theme', 'gerbe']) assert.match(PIECES, new RegExp(`\\{ id: '${id}', nom: '[^']+', groupe: '(salle|moi)', qui: '`), id)

  // La page : soi-même en tête — un toucher ouvre sa carte, comme la salle —, puis quatre gros boutons, dans cet ordre.
  const page = app.slice(app.indexOf("// ── Le profil : qui l'on est, puis quatre boutons ──"), app.indexOf('/**\n * Un onglet qui arrive'))
  assert.match(page, /<IdentiteLigne profil=\{profil\} onCarte=\{\(\) => setCarteOuverte\(true\)\} \/>\s*\{carteOuverte && laCarte && laCarte !== 'perdu' && <laCarte\.CarteJoueur adresse="\/api\/joueur\/carte" onFermer=\{\(\) => setCarteOuverte\(false\)\} \/>\}/)
  const boutons = page.slice(page.indexOf('<div className="profil-boutons">'), page.indexOf('<Glossaire'))
  // « M'habiller » ouvre la loge sur la première pièce qui a du neuf, l'avatar d'office.
  const gestes = [...boutons.matchAll(/<GrosBouton\s+icone=\{<Icon name="([\w-]+)" \/>\}\s+titre="([^"]+)"[\s\S]*?onClick=\{\(\) => ouvrir\((?:pieceNeuve \?\? )?'(\w+)'\)\}/g)].map(
    ([, icone, titre, ecran]) => `${titre} (${icone}) → #${ecran}`,
  )
  assert.deepEqual(gestes, ['M’habiller (hanger) → #avatar', 'Ma collection (award) → #collection', 'Mes soirées (book) → #soirees', 'Ma carrière (bar-chart) → #carriere'])
  assert.match(page, /const pieceNeuve = plus \? premierePieceNeuve\(plus\.nouveautes\) : null/)
  // Sa collection : sa jauge et son compte, qui viennent avec les écrans.
  assert.match(boutons, /jauge=\{plus \? plus\.collection\.acquis \/ Math\.max\(1, plus\.collection\.total\) : 0\}\s*compte=\{plus && `\$\{formatNumber\(plus\.collection\.acquis\)\} sur \$\{formatNumber\(plus\.collection\.total\)\}`\}/)
  // Rien de ce qu'on porte sur la page : ni la loge, ni sa carte, ni le thème, ni la gerbe — ils sont derrière « M'habiller ».
  assert.doesNotMatch(page, /PanneauLoge|LogeEnChemin|CarteDeLaLoge|Vestiaire|apercuDuTheme|profil-groupe|<Tuile/)
  assert.doesNotMatch(app, /h\.startsWith\(`\$\{e\.id\}-`\)/, 'plus de partie d’écran où faire défiler (`#carte-vitrine`) : une adresse, une pièce')

  // La loge, sur son écran : « ← Mon profil », son titre, sa tête dès que le profil est lu — sa carte s'y ouvre déjà en
  // grand —, ses panneaux quand ils arrivent.
  assert.match(
    app,
    /if \(e\.groupe === 'M’habiller'\) \{[\s\S]*?<header className="loge-tete">\s*\{sortie\}\s*<h1>M’habiller<\/h1>\s*<\/header>[\s\S]*?\{pret \? \(\s*<pret\.PanneauLoge profil=\{profil\} piece=\{ecran as PieceDeLaLoge\} [^>]*\/>\s*\) : \(\s*<LogeEnChemin profil=\{profil\} piece=\{ecran as PieceDeLaLoge\} onPiece=\{changerDePiece\} onOuvrir=\{ouvrirLaCarte\} attente=\{enChemin\} \/>\s*\)\}/,
  )
  // « ← » dit d'où l'on vient : d'une pièce de la loge, c'est « M'habiller ».
  assert.match(app, /\{depuis \? \(depuis\.groupe === 'M’habiller' \? 'M’habiller' : depuis\.nom\) : 'Mon profil'\}/)
  assert.match(app, /\{ecran === 'collection' && \(pret \? <pret\.PanneauCollection /)
  // Les écrans de « Mon profil » le disent en tête : « Mon profil », puis leur nom.
  assert.match(app, /<PieceTete piece=\{e\.groupe\} titre=\{e\.nom\} \/>/)
})

test('un gros bouton : sa jauge et son compte sous le titre — la collection ; « Nouveau » à la place du chevron', async () => {
  const collection = await rendu('components/Pieces', 'GrosBouton', { icone: React.createElement('i'), titre: 'Ma collection', jauge: 0.09, compte: '27 sur 308', detail: 'Avatars', onClick: () => {} })
  assert.match(collection, /^<button type="button" class="gros-bouton"><span class="gros-icone"><i><\/i><\/span><span class="gros-texte"><b>Ma collection<\/b><span class="gros-jauge"><span class="jauge-fine" aria-hidden="true"><span style="width:9%"><\/span><\/span><span class="gros-compte">27 sur 308<\/span><\/span><span class="gros-detail">Avatars<\/span><\/span>/)
  // Le compte en route : la jauge vide garde sa ligne, rien ne saute quand il arrive.
  const enRoute = await rendu('components/Pieces', 'GrosBouton', { icone: React.createElement('i'), titre: 'Ma collection', jauge: 0, detail: 'Avatars', onClick: () => {} })
  assert.match(enRoute, /<span class="gros-jauge"><span class="jauge-fine" aria-hidden="true"><span style="width:0%"><\/span><\/span><\/span>/)
  assert.match(source('styles.css'), /\.gros-jauge \{ display: flex; align-items: center; gap: 10px; min-height: 1\.2rem; \}/)
  // Sans jauge : le gros bouton de toujours. Une pastille prend la place du chevron.
  const habiller = await rendu('components/Pieces', 'GrosBouton', { icone: React.createElement('i'), titre: 'M’habiller', pastille: 'Nouveau', onClick: () => {} })
  assert.doesNotMatch(habiller, /gros-jauge|chevron/)
  assert.match(habiller, /<span class="pastille-attente">Nouveau<\/span><\/button>$/)
  // Les tuiles, et les groupes qui les rangeaient, ne servent plus : le profil est aux gros boutons de l'accueil.
  assert.doesNotMatch(source('components/Pieces.tsx'), /export function Tuile|tuile-a-apercu|tuile-qui/)
  assert.doesNotMatch(source('styles.css'), /\.tuiles? |\.tuile-|\.profil-groupe|\.profil-voir-carte|\.mini-theme|\.mini-gerbe|\.vestiaire/)
})

// Le souhait du propriétaire du 11 octobre 2026 : « quelque chose de visuel
// qui permettrait de cliquer sur les différents éléments ». La loge, sur son
// écran : sa carte et ses six pièces paraissent avec le profil, ses panneaux
// les rejoignent.
test('la loge sur son écran : sa carte et ses six pièces tout de suite, à la place exacte où la loge les reprend', async () => {
  const touchees: string[] = []
  const props = {
    profil: complet,
    piece: 'avatar',
    onPiece: (p: string) => touchees.push(p),
    onOuvrir: () => touchees.push('carte'),
    attente: React.createElement('p', { className: 'serif-note' }, 'Chargement…'),
  }
  const html = await rendu('components/LogeTete', 'LogeEnChemin', props)
  // Sa carte telle que la salle la voit : son avatar, son prénom, la place de son titre, sa finition.
  assert.match(html, /^<div class="loge"><div class="loge-collante"><div class="loge-carte"><div class="loge-carte-haut"><span class="loge-carte-avatar">/)
  assert.match(html, /<span class="loge-carte-titre loge-sans">Sans titre<\/span>/)
  assert.match(html, /<span class="loge-finition">Mat<\/span>/)
  // Dessous, ce qui lui manque pour le niveau suivant, et ses confettis.
  assert.match(html, /<\/div><span class="xp-mince" role="progressbar" aria-label="Niveau 3"[^>]*>.*?60 XP → niv\. 4.*?12<span class="sr-only"> confettis<\/span>/)
  // Les six pièces, l'avatar choisi ; qui le voit ; et le panneau qui arrive, à sa place.
  const pieces = [...html.matchAll(/<button id="loge-(\w+)" type="button" role="tab" aria-selected="(true|false)"/g)].map(m => `${m[1]}${m[2] === 'true' ? '*' : ''}`)
  assert.deepEqual(pieces, ['avatar*', 'titre', 'vitrine', 'fond', 'theme', 'gerbe'])
  assert.match(html, /<p class="muted loge-qui"><svg[^>]*>.*?<\/svg>La salle le voit, à côté de ton prénom\.<\/p>/)
  assert.match(html, /<div class="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby="loge-avatar"><p class="serif-note">Chargement…<\/p><\/div><\/div>$/)
  // Aucune pastille « Nouveau » avant que la loge ne sache ce que ce téléphone a vu.
  assert.doesNotMatch(html, /loge-neuf/)
  // Une pièce touchée d'ici va à l'écran, qui l'ouvre dès que son panneau arrive.
  const arbre = (await import(new URL('../../client/src/components/LogeTete.tsx', import.meta.url).href)).LogeEnChemin(props)
  const rangee = arbre.props.children.find((e: any) => e?.props?.onChoisir)
  rangee.props.onChoisir('titre')
  assert.deepEqual(touchees, ['titre'])
  // Sa carte, touchée, s'ouvre déjà en grand : un bouton tendu sur elle, après ce qu'elle montre.
  assert.match(html, /<\/span><button type="button" class="loge-carte-ouvrir" title="Voir en grand"><span class="sr-only">Voir ma carte en grand<\/span><\/button><\/div><\/div>/)
  arbre.props.children.find((e: any) => e?.props?.onOuvrir).props.onOuvrir()
  assert.deepEqual(touchees, ['titre', 'carte'])

  // La loge arrivée reprend la même carte, au pixel : rien ne saute sous le
  // doigt — seule sa vitrine se remplit (elle a sa hauteur d'avance).
  const carte = (h: string) => h.slice(h.indexOf('<div class="loge-carte'), h.indexOf('<div class="loge-pieces">')).replace(/<span class="loge-carte-vitrine"[^>]*>.*?<\/span><\/span>|<span class="loge-carte-vitrine"><\/span>/, '<vitrine/>')
  assert.equal(carte(await laLoge('avatar')), carte(html))
  assert.match(source('styles.css'), /\.loge-carte-vitrine \{ display: inline-flex; gap: 5px; min-height: 28px; \}/)

  // Son titre porté s'y écrit entre guillemets, son fond la tapisse.
  const habille = await rendu('components/LogeTete', 'LogeEnChemin', { ...props, profil: { ...complet, titre: 'hf:phenix', fond: 'nuit' } })
  assert.match(habille, /<div class="loge-carte carte-fond fond-nuit">/)
  assert.match(habille, /<span class="loge-carte-titre">«\u202fLe Phénix\u202f»<\/span>/)
})

// Le souhait du propriétaire du 11 octobre 2026 : « il faudrait que chaque
// composant ait une page dédiée pour pas que lorsque l'on clique sur modifier
// on tombe au milieu d'une page », et les gerbes et les thèmes, « qui ne
// devraient pas être dans le même onglet ». « Ma carte » rangeait titre,
// vitrine et fond, et le vestiaire faisait défiler jusqu'à la pièce touchée ;
// « Mon thème » posait la gerbe sous les thèmes. Depuis le 12 octobre, la
// loge les tient sur un écran : chaque pièce a son panneau, et lui seul.
test('chaque pièce qu’on porte a son panneau dans la loge : sa carte en tête, et sa seule pièce', async () => {
  for (const [piece, titres] of [
    ['titre', ['Mes titres']],
    ['vitrine', ['Sur ta carte']],
    ['fond', ['Mes fonds']],
    ['gerbe', ['Mes gerbes']],
  ] as const) {
    const html = await laLoge(piece)
    assert.match(html, /^(<link rel="preload"[^>]*\/>)*<div class="loge"><div class="loge-collante"><div class="loge-carte/, `${piece} : sa carte en tête, qui change sous ses yeux`)
    assert.deepEqual(cartes(html), titres, piece)
  }
  // Le reste de la carte se remplit tout seul : la pièce de la vitrine le dit.
  assert.match(await laLoge('vitrine'), /Le reste de ta carte se remplit tout seul : tes légendaires, tes écussons, tes chiffres, tes prix\./)
  // Le thème et la gerbe, chacun son panneau : le leur, rien d'autre.
  const theme = await laLoge('theme')
  assert.match(theme, /<div class="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby="loge-theme"><section class="mes-themes">/)
  assert.doesNotMatch(theme, /gerbes-choix|Mes gerbes/, 'la gerbe a son panneau')
  const gerbe = await laLoge('gerbe')
  assert.match(gerbe, /<div class="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby="loge-gerbe"><section class="card"><h3>/)
  assert.deepEqual(cartes(gerbe), ['Mes gerbes'])
  assert.doesNotMatch(gerbe, /mes-themes|theme-vitrine/, 'les thèmes ont leur panneau')
  // Plus rien ne défile jusqu'à une partie : chaque page s'ouvre en haut.
  assert.doesNotMatch(source('components/PanneauxDuProfil.tsx'), /scrollIntoView|ancre-du-vestiaire|PanneauMaCarte/)
  assert.doesNotMatch(source('styles.css'), /\.ancre-du-vestiaire/)
})

test('la loge, sur l’avatar : sa carte collée en tête, ses finitions en pastilles, ses avatars à lui — le reste, dans la collection', async () => {
  const html = await laLoge('avatar')
  assert.match(html, /^(<link rel="preload"[^>]*\/>)*<div class="loge"><div class="loge-collante"><div class="loge-carte/, 'sa carte en tête : c’est elle qui change')
  // Ses finitions sur une rangée de pastilles (la maquette 3) : « Auto », celle
  // qu'il porte d'office ; dépliées en grandes cases, elles repoussaient ses
  // avatars de plus d'un écran.
  // Peu de pastilles — sa première finition — s'alignent à gauche (`rangee-courte`).
  assert.match(html, /<div class="loge-finitions"><span class="loge-sous-titre" id="loge-finitions-titre">Finition<\/span><div class="loge-finitions-rangee rangee-courte" role="group" aria-labelledby="loge-finitions-titre"><button type="button" class="finition-choix selected porte" aria-pressed="true" aria-label="Auto, toujours la plus belle : Argent">/)
  assert.doesNotMatch(html, /class="finitions"|aria-controls="mes-finitions"/)
  assert.ok(html.indexOf('loge-finitions') < html.indexOf('gemmes-loge'), 'la finition avant les avatars')
  // Seulement ce qu'il a : ni cadenas, ni finition ni bordure éteinte (le 13 octobre 2026).
  assert.doesNotMatch(html, /loge-ferme|finition-fermee|bordure-fermee/)
  // Ce qui reste, et où le gagner : un lien vers sa page de l'album, compté.
  const page = /aria-labelledby="loge-gemme-(\w+)"/.exec(html)![1]
  assert.match(html, new RegExp(`<a class="loge-a-gagner" href="#collection-avatars${page === 'offert' ? '' : `-${page}`}">\\d+ [^<]* à gagner`))
  // La carte reste collée pendant qu'on choisit.
  assert.match(source('styles.css'), /\.loge-collante \{ position: sticky; top: 0;/)
})

test('la loge, sur le thème : ses thèmes, deux liens vers ce qu’il n’a pas — sa gerbe a son panneau', async () => {
  const html = await laLoge('theme')
  assert.doesNotMatch(html, /Mes gerbes|gerbes-choix/, 'la gerbe a son panneau')
  // Ce qui s'achète à la boutique, ce qui se gagne dans la collection : pas sur l'écran où l'on choisit.
  assert.match(html, /<a class="link-inline lien-boutique" href="\/boutique"><svg[^>]*>.*?<\/svg>\d+ autres à la boutique<\/a>/)
  // Ce qui se gagne : le lien de toutes les pièces de la loge.
  assert.match(html, /<a class="loge-a-gagner" href="#collection-themes">5 thèmes à gagner\s:\soù\s\?<svg/)
  // Seulement ceux qu'il a, dans leurs cartes : les autres se montrent dans la collection.
  assert.equal(html.match(/<button type="button" class="theme-vitrine/g)?.length, complet.boutique.possedes.length)
})

// « Les gerbes, à améliorer » (le 10 octobre 2026) : celles à gagner étaient
// fermées au doigt — on ne savait pas ce qu'on visait. Elles éclatent au
// toucher, sans se porter ; et « Aucune » se demande, puisque sans choix
// chacun porte les confettis. Puis le 11 octobre 2026 : « que ça ne soit pas
// mélangé avec la collection » — « Ma gerbe » ne montre que les siennes, et
// celles à gagner éclatent dans sa collection. Dans la loge (le 12 octobre),
// la gerbe touchée éclate et s'essaie : « Porter » la garde.
test('la loge, sur la gerbe : les siennes seulement, « Aucune » se demande — celles à gagner éclatent dans la collection', async () => {
  const html = await laLoge('gerbe')
  const gerbes = html.slice(html.indexOf('gerbes-choix'))
  assert.doesNotMatch(gerbes, /<button[^>]*disabled=""/, 'aucune gerbe ne se ferme au doigt')
  assert.doesNotMatch(gerbes, /gerbe-a-gagner/)
  assert.equal(gerbes.match(/class="finition-btn( selected)?"/g)?.length, 1 + complet.gerbes.length, 'Aucune, et les siennes')
  const reste = GERBES.length - complet.gerbes.length
  assert.match(gerbes, new RegExp(`<a class="loge-a-gagner" href="#collection-gerbes">${reste} gerbes à gagner\\s:\\soù\\s\\?<svg`))
  const APPARENCE = source('components/Apparence.tsx')
  assert.match(APPARENCE, /onClick=\{\(\) => essayer\(\{ gerbe: AUCUNE_GERBE \}\)\}/)
  assert.match(APPARENCE, /montrer\(g\.key\)\s*essayer\(\{ gerbe: g\.key \}\)/)
  // Le fond et la finition de même : ce qu'il a, puis le chemin de la collection.
  const carte = await laLoge('fond')
  assert.match(carte, /<a class="loge-a-gagner" href="#collection-fonds">13 fonds à gagner\s:\soù\s\?<svg/)
  assert.doesNotMatch(carte, /fonds-choix.*disabled=""/)
  // La finition : les siennes seulement. Les restantes s'y montraient
  // éteintes, chacune son niveau (le 12 octobre 2026 : « il manque les
  // finitions 15, 20, 25 ») ; le lendemain, le propriétaire ne voulait plus
  // voir dans la loge ce qu'il n'avait pas. Elles se comptent au bout de la
  // rangée, et mènent à leur ligne de la collection, qui dit le niveau de chacune.
  const avatar = await rendu('components/Apparence', 'MesFinitions', { profil: complet, ...loge })
  assert.doesNotMatch(avatar, /finition-fermee|Niv\. \d/)
  assert.match(
    avatar,
    /<a class="finition-choix pastille-a-gagner" href="#collection-finitions" aria-label="6 finitions à gagner : où et comment, dans « Ma collection »"><i class="finition-teinte teinte-a-gagner" aria-hidden="true">\+6<\/i><span aria-hidden="true">à gagner<\/span><\/a>/,
  )
  const auNiveau12 = await rendu('components/Apparence', 'MesFinitions', { profil: { ...complet, ouvertes: ['mat', 'argent', 'or', 'holo'], finition: 'holo' }, ...loge })
  assert.equal(auNiveau12.match(/<button type="button" class="finition-choix/g)?.length, 5, 'Auto, et les quatre qu’il a')
  assert.match(auNiveau12, /aria-label="3 finitions à gagner[^"]*"><i class="finition-teinte teinte-a-gagner" aria-hidden="true">\+3<\/i>/)
  const auSommet = await rendu('components/Apparence', 'MesFinitions', { profil: { ...complet, ouvertes: [...FINITIONS], finition: 'constellation' }, ...loge })
  assert.doesNotMatch(auSommet, /pastille-a-gagner/, 'toutes gagnées : rien à compter')
  // Huit pastilles se serrent d'un bord à l'autre ; deux ou trois s'alignent à gauche.
  assert.match(auSommet, /class="loge-finitions-rangee"/)
  assert.match(avatar, /class="loge-finitions-rangee rangee-courte"/)
  // Dans la collection, chaque gerbe se touche pour éclater, même à gagner (`AlbumDuStyle`).
  const STYLE = source('components/AlbumDuStyle.tsx')
  assert.match(STYLE, /if \(partie === 'gerbes'\) setEclat\(e => \(\{ cle: o\.cle, n: \(e\?\.n \?\? 0\) \+ 1 \}\)\)/)
  assert.match(STYLE, /\{eclat && <GerbeDeJuste key=\{eclat\.n\} cle=\{eclat\.cle\} \/>\}/)
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

test('les trophées : un album, une page par mode, chaque trophée dans sa case — la vitrine se règle dans « Ma vitrine »', async () => {
  const html = await rendu('components/AlbumDesTrophees', 'AlbumDesTrophees', { profil: vecu, page: 'soiree', onPage: () => {} })
  assert.doesNotMatch(html, /vitrine/i, 'la vitrine a sa page, « Ma vitrine »')
  // Six pages, une par mode : la campagne, les duels et les sentiers ont les leurs.
  const onglets = [...html.matchAll(/role="tab"[^>]*aria-label="([^",]+),/g)].map(([, nom]) => nom)
  assert.deepEqual(onglets, ['Soirée', 'Quiz du jour', 'Campagne', 'Duels', 'Sentiers', 'Partout'])
  // La page de la soirée : ses pistes, ses exploits, ses coups du sort, son palmarès — chacun son titre et son compte.
  const sections = [...html.matchAll(/<h3 id="trophees-soiree-(\w+)" class="label">([^<]+)<\/h3><span class="famille-compte">([^<]+)<\/span>/g)].map(m => `${m[2]} ${m[3]}`)
  assert.deepEqual(sections.map(s => s.replace(/ \d+\/\d+$/, '')), ['Les pistes', 'Les exploits', 'Les coups du sort', 'Le palmarès'])
  assert.ok(sections.includes('Le palmarès 1/1'), 'les prix : un sur un')
  // Toutes ses cases repliées à l'ouverture : la fiche s'ouvre au toucher, sous sa rangée.
  assert.doesNotMatch(html, /aria-expanded="true"|id="fiche-trophee"/)
  // L'album vit dans « Ma collection », juste après celui des avatars.
  assert.match(source('components/Collection.tsx'), /<AlbumDesTrophees profil=\{profil\} page=\{pageDesTrophees\} onPage=\{choisirLaPageDesTrophees\} \/>/)
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

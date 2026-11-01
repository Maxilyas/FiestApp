// « Ma collection » : tout ce qui se gagne, ce qu'on a, ce qui reste — et où
// le gagner.
//
// Les pages où l'on choisit ce qu'on porte (« Mon avatar », « Mon titre »,
// « Ma vitrine », « Mon fond de carte », « Mon thème », « Ma gerbe ») ne
// montrent que ce qu'on a ; la collection montre tout, et n'y règle rien. Son compte est celui de la tuile du profil : une seule
// règle (`shared/collection.ts`), qui compte aussi les lignes des trophées.
//
// Et les thèmes : la collection les disait en deux lignes de texte, ceux
// qu'on a compris, quand tout le reste s'y montre (la remarque du 6 octobre
// 2026) — ils y sont en album, une vignette chacun, rangés par rareté. Ceux
// qui ne se vendent pas quittent la boutique : ils s'y montrent, avec le lieu
// qui les donne — le lien d'avant menait les cinq aux sentiers quand quatre
// se gagnent au quiz du jour ou dans la série (la remarque du 5 octobre 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { compteDeLaCollection } from '../../shared/collection'
import { albumDesTrophees, compteDesTrophees } from '../../shared/trophees'
import { avatarDeLAlbum } from '../../shared/album'
import { DIVINS } from '../../shared/divins'
import { LEGENDAIRES } from '../../shared/legendaires'
import { NOM_DE_RARETE, RARETES_DE_THEME, THEMES } from '../../shared/themes'
import { GERBES } from '../../shared/gerbes'
import { hautFait, type HautFaitVu } from '../../shared/hautsfaits'

const lieu = { pathname: '/profil', search: '', hash: '', origin: 'http://banc' }
Object.assign(globalThis, { React, window: { location: lieu }, location: lieu })

const source = (fichier: string) => readFileSync(new URL(`../../${fichier}`, import.meta.url), 'utf8')

/** Les cartes d'une vitrine de thèmes, par ce que chacune dit d'elle à l'oreille. */
const casesDe = (html: string) => [...html.matchAll(/<button\b[^>]*class="theme-vitrine[^"]*"[^>]*aria-label="([^"]*)"/g)].map(m => m[1])

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Un haut fait du catalogue, tel que sa page le reçoit : gagné tant de fois. */
function vu(key: string, fois: number, plus: Partial<HautFaitVu> = {}): HautFaitVu {
  const h = hautFait(key)!
  return { key, famille: h.famille, emoji: h.emoji, title: h.title, rule: 'règle', ton: 'ton' in h ? h.ton : 'eclat', fois, ...plus } as HautFaitVu
}

/**
 * Une joueuse en route : deux portraits de la forêt, le Phénix et un Divin,
 * le niveau 8, trois thèmes dont un qui se gagne — le Sommet —, un fond, deux
 * gerbes ; des hauts faits de soirée, du quiz du jour et de la campagne, un
 * palier de carrière à l'argent, un prix, un écusson, une page du calendrier.
 */
const LEA = {
  id: 'p',
  login: 'lea',
  name: 'Léa',
  avatar: '🦊',
  finition: 'or',
  finitionChoisie: 'auto',
  niveau: 8,
  acquis: 40,
  requis: 100,
  ouvertes: ['mat', 'argent', 'or'],
  titre: null,
  fond: 'nuit',
  fonds: ['nuit'],
  gerbe: 'etoiles',
  gerbes: ['confettis', 'etoiles'],
  theme: 'sommet',
  laurier: false,
  legendaire: 'lg:phenix',
  legendaires: ['lg:phenix'],
  divins: [{ key: 'dv:seraphin', legende: 'Il est descendu un soir de grand vent.', ton: 'eclat' }],
  eclats: [],
  eclatsEteints: [],
  vitrine: [],
  vitrineChoisie: null,
  sentiers: { foret: 5 },
  hautsFaits: [
    vu('hf:phenix', 1),
    vu('hf:oracle', 0),
    vu('hf:lanterne-rouge', 2),
    vu('hf:laurier', 1, { origine: 'jour' }),
    vu('hf:funambule', 0, { origine: 'campagne' }),
    vu('hf:habitue', 2, { valeur: 12, prochain: 25 }),
  ],
  prix: [
    { key: 'prix:eclair', emoji: '⚡', title: 'L’Éclair', rule: 'Le plus rapide', fois: 1 },
    { key: 'prix:flair', emoji: '🔮', title: 'Le Flair', rule: 'Le plus juste', fois: 0 },
  ],
  ecussons: [
    { categorie: 'Histoire', palier: 1, justes: 30 },
    { categorie: 'Sciences', palier: 0, justes: 3 },
  ],
  // Ses pages ouvertes, comme le serveur les dit : leurs mois (`pagesOuvertes`).
  calendrier: { pages: ['01'], dorees: [], mois: '2026-10', joursCeMois: 3 },
  jour: { joues: 4, victoires: 1, medailles: { or: 1, argent: 0, bronze: 0 }, record: 3, meilleurScore: 900 },
  boutique: { confettis: { gagnes: 500, depenses: 150, solde: 350 }, possedes: ['velours', 'ivoire', 'sommet'], porte: null, jour: '2026-10-05' },
}

test('le compte de la collection : trois familles, leurs lignes, un total — ce que la tuile et la page disent', () => {
  const { familles, total } = compteDeLaCollection(LEA as any)
  const lignes = familles.map(f => [f.famille, `${f.acquis}/${f.total}`, f.parties.map(p => `${p.partie} ${p.acquis}/${p.total}`)])
  assert.deepEqual(lignes, [
    // Deux portraits, le Phénix et le Séraphin, les cinq emojis de collection
    // du niveau 8 : un seul album (le 13 octobre 2026), compté par sa règle —
    // les douze formes des compagnons comprises, et leurs trois métamorphoses
    // depuis le 19 octobre 2026 ; les quatre de la luciole, et sa
    // luciole-aurore, depuis le 20 ; les cinq légendaires des fêtes du
    // printemps à la rentrée depuis le 1er novembre.
    ['avatars', '9/147', ['avatars 9/147']],
    // Les trophées aussi, en un album — une page par mode (la maquette 1, le
    // 13 octobre 2026) —, juste après les avatars, comptés par sa règle : en
    // soirée, L'Habitué à l'argent (deux métaux), le Phénix, la Lanterne
    // rouge et l'Éclair ; au quiz du jour, la page de janvier ; partout, le
    // bronze de l'écusson d'histoire. Onze de plus à gagner depuis le
    // 15 octobre 2026 : les trois pistes et les deux exploits des sentiers ;
    // trois depuis le 18 : Le Globe-trotter, le passeport de l'expédition.
    ['trophees', '7/146', ['trophees 7/146']],
    // Le style, et ses bordures de ligue depuis le 13 octobre 2026 : la loge
    // les proposait, la collection ne les rangeait nulle part. Sans duel
    // classé, le serveur les tait : zéro sur six, pas absentes. Les six fonds
    // et les six gerbes du trésor du coffre de la semaine y comptent depuis
    // le 14 octobre 2026, les douze fonds des savoirs de la boutique depuis
    // le 15, les huit gerbes des fêtes depuis le 1er novembre.
    ['style', '9/98', ['themes 3/35', 'fonds 1/25', 'gerbes 2/25', 'finitions 3/7', 'bordures 0/6']],
  ])
  assert.deepEqual(total, { acquis: 25, total: 391 })
  assert.deepEqual(
    compteDeLaCollection({ ...LEA, bordures: [{ ligue: 'bronze', crans: 12 }, { ligue: 'argent', crans: 3 }] } as any)
      .familles.find(f => f.famille === 'style')!
      .parties.find(p => p.partie === 'bordures'),
    { partie: 'bordures', acquis: 2, total: 6 },
  )
  assert.deepEqual(compteDesTrophees(LEA as any), { acquis: 7, total: 146 })
  // Les vingt-quatre emojis de l'inscription sont à tout le monde : ils ne se comptent pas.
  // Et ce qu'un serveur d'avant ne dit pas ne se compte pas : le total n'annonce jamais ce que la page ne montrerait pas.
  const avant = compteDeLaCollection({ ...LEA, boutique: undefined, fonds: undefined, gerbes: undefined, calendrier: undefined } as any)
  assert.deepEqual(
    avant.familles.find(f => f.famille === 'style')!.parties.map(p => p.partie),
    ['finitions', 'bordures'],
  )
  const jour = albumDesTrophees({ ...LEA, calendrier: undefined } as any).find(p => p.page === 'jour')!
  assert.deepEqual([jour.acquis, jour.total, jour.sections.map(s => s.cle)], [0, 24, ['pistes', 'exploits', 'coups']])
})

test('les trophées se comptent par la même règle que la collection : chaque page sur son onglet', async () => {
  const html = await rendu('components/AlbumDesTrophees', 'AlbumDesTrophees', { profil: LEA, page: 'soiree', onPage: () => {} })
  const onglets = [...html.matchAll(/<button id="trophees-onglet-(\w+)" type="button" role="tab" aria-selected="(true|false)"[^>]*aria-label="([^"]+)"/g)].map(m => `${m[1]}${m[2] === 'true' ? '*' : ''} ${m[3]}`)
  // Chaque onglet dit son compte, en chiffres : la couleur seule ne se lit pas.
  assert.deepEqual(
    onglets,
    albumDesTrophees(LEA as any).map(p => `${p.page}${p.page === 'soiree' ? '*' : ''} ${{ soiree: 'Soirée', jour: 'Quiz du jour', campagne: 'Campagne', duels: 'Duels', sentiers: 'Sentiers', cabinet: 'Cabinet', partout: 'Partout' }[p.page]}, ${p.acquis} sur ${p.total}`),
  )
  const pages = albumDesTrophees(LEA as any)
  assert.deepEqual(
    pages.reduce((n, p) => ({ acquis: n.acquis + p.acquis, total: n.total + p.total }), { acquis: 0, total: 0 }),
    compteDesTrophees(LEA as any),
  )
  // Les onglets de l'application : un seul arrêt de Tab, le panneau de la page choisie seulement.
  assert.match(html, /<div class="trophees-onglets" role="tablist" aria-label="Les modes de jeu">/)
  assert.equal(html.match(/role="tab"[^>]*tabindex="0"/g)?.length, 1)
  assert.match(html, /<div class="trophees-page" role="tabpanel" id="trophees-page" aria-labelledby="trophees-onglet-soiree">/)
  // La ligne de la collection lit la même règle.
  assert.match(source('shared/collection.ts'), /\{ partie: 'trophees', \.\.\.compteDesTrophees\(p\) \}/)
})

// « La partie haut fait de la collection est incompréhensible : il faudrait
// cloisonner par gagné en campagne / quiz du jour / quiz » (un retour du
// 10 octobre 2026), puis « c'est très confus, les trophées que les gens
// gagnent » (le 13 octobre 2026). Chaque trophée a sa page : celle du mode où
// il se gagne.
test('les trophées se rangent par où ils se gagnent : une page par mode, ses pistes, ses exploits et ce qu’il a en propre', () => {
  const pages = albumDesTrophees(LEA as any)
  assert.deepEqual(
    pages.map(p => `${p.page} : ${p.sections.map(s => s.cle).join(', ')}`),
    [
      'soiree : pistes, exploits, coups, palmares',
      'jour : pistes, exploits, coups, calendrier',
      'campagne : pistes, exploits',
      'duels : ligues, bordures',
      'sentiers : pistes, exploits, maitres',
      'partout : ecussons, niveau',
    ],
  )
  // Les pistes se rangent par ce qu'elles comptent : le niveau et les Éclats, de partout, à part.
  const pistes = (page: string, section = 'pistes') => pages.find(p => p.page === page)!.sections.find(s => s.cle === section)!.cases.map(c => c.cle).sort()
  assert.deepEqual(pistes('jour'), ['hf:assidu', 'hf:champion-du-jour', 'hf:elite', 'hf:infatigable', 'hf:sans-faute'])
  // Le passeport de l'expédition, depuis le 18 octobre 2026 : sa piste se range avec celles de la campagne, qui la compte.
  assert.deepEqual(pistes('campagne'), ['hf:alpiniste', 'hf:erudit', 'hf:globe-trotter', 'hf:marathonien'])
  // Ce qui se valide en épreuve, sur la page des sentiers — que la campagne compte pourtant.
  assert.deepEqual(pistes('sentiers'), ['hf:cartographe', 'hf:constellation', 'hf:randonneur'])
  assert.deepEqual(pistes('sentiers', 'exploits'), ['hf:contre-toute-attente', 'hf:impeccable'])
  assert.deepEqual(pistes('partout', 'niveau'), ['hf:eclats', 'hf:legende'])
  // Le Laurier n'a plus sa case : la piste du Champion du jour le compte, la même victoire.
  assert.ok(!pistes('jour', 'exploits').includes('hf:laurier'))
  const champion = pages.find(p => p.page === 'jour')!.sections[0].cases.find(c => c.cle === 'hf:champion-du-jour')!
  assert.deepEqual(champion.absorbe, { cle: 'hf:laurier', titre: 'Le Laurier', emoji: '🌿', xp: 50, fois: 1 })
  // Ce qu'on a d'abord, puis le reste : L'Habitué en tête des pistes de la soirée.
  assert.equal(pages[0].sections[0].cases[0].cle, 'hf:habitue')
  // Les duels se montrent avant le premier duel classé : le serveur tait ses bordures jusque-là.
  assert.deepEqual([pages[3].acquis, pages[3].total], [0, 12])
})

test('la collection : son total, trois familles, une ligne par collection — repliées, sans rien à porter', async () => {
  lieu.hash = ''
  const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  assert.match(html, /<p class="collection-total"><b>25<\/b> sur 391<\/p>/)
  const familles = [...html.matchAll(/<h2 id="famille-\w+">([^<]+)<span class="collection-compte">([^<]+)<\/span><\/h2>/g)].map(m => `${m[1].trim()} ${m[2]}`)
  assert.deepEqual(familles, ['Avatars 9 sur 147', 'Trophées 7 sur 146', 'Style 9 sur 98'])
  const lignes = [...html.matchAll(/<span class="trophee-texte"><b>([^<]+)<\/b>/g)].map(m => m[1])
  assert.deepEqual(lignes, [
    // Trois lignes — le savoir, les légendaires et les Divins, les emojis —
    // rendaient les gens « confus » : un album, une page par rareté. Dix
    // lignes de trophées aussi : un album, une page par mode.
    'L’album des avatars',
    'L’album des trophées',
    'Thèmes',
    'Fonds de carte',
    'Gerbes',
    'Finitions',
    'Bordures de ligue',
  ])
  assert.equal(html.match(/aria-expanded="true"/g), null, 'tout replié à l’ouverture')
  // On n'y règle rien : on y regarde. Les avatars s'y parcourent sans « Le porter ».
  const page = source('client/src/components/Collection.tsx')
  assert.match(page, /<AlbumDesAvatars profil=\{profil\} page=\{page\} onPage=\{choisirLaPage\} \/>/)
  assert.doesNotMatch(page, /enregistrer|busy/)
  assert.doesNotMatch(source('client/src/components/AlbumDesAvatars.tsx'), /enregistrer|onPorter|onEclat|aria-pressed/)
  assert.doesNotMatch(html, /Le porter|<button[^>]*aria-pressed/)
})

// Le carnet des fêtes (le 1er novembre 2026) : un timbre par fête et par an,
// à côté de l'album des trophées. Un serveur d'avant ne le dit pas : pas de ligne.
test('le carnet des fêtes : sa ligne avec les trophées, une page par année, chaque timbre dit ce qu’il en est', async () => {
  const AVEC_LE_CARNET = { ...LEA, carnet: { timbres: ['halloween:2026'], jour: '2026-12-31' } }
  const trophees = compteDeLaCollection(AVEC_LE_CARNET as any).familles.find(f => f.famille === 'trophees')!
  // 2026 : Halloween et Noël ; 2027, ouverte par le Nouvel An en cours : ses huit fêtes.
  assert.deepEqual(trophees.parties, [
    { partie: 'trophees', acquis: 7, total: 146 },
    { partie: 'timbres', acquis: 1, total: 10 },
  ])
  assert.deepEqual(compteDeLaCollection(AVEC_LE_CARNET as any).total, { acquis: 26, total: 401 })

  lieu.hash = '#collection-timbres'
  const html = await rendu('components/Collection', 'MaCollection', { profil: AVEC_LE_CARNET })
  lieu.hash = ''
  assert.match(html, /<li id="collection-timbres" class="trophee trophee-ouvert"/)
  assert.match(html, /<b>Le carnet des fêtes<\/b>/)
  const ligne = html.slice(html.indexOf('id="collection-timbres"'))
  // Ouvert sur l'année en cours, la dernière ; chaque année son bouton et son compte.
  assert.deepEqual([...ligne.matchAll(/<button type="button" class="pill-btn( active)?" aria-pressed="(true|false)">([^<]+)<\/button>/g)].map(m => `${m[3]}${m[2] === 'true' ? '*' : ''}`), [
    '2026 · 1/2',
    '2027 · 0/8*',
  ])
  const timbres = [...ligne.matchAll(/<span class="timbre timbre-([a-z-]+)" role="img" aria-label="([^"]+)">/g)].map(m => `${m[1]} ${m[2]}`)
  assert.deepEqual(timbres, [
    'en-cours Timbre Nouvel An 2027, sa fête en cours',
    'a-venir Timbre Saint-Valentin 2027, à venir',
    'a-venir Timbre Pâques 2027, à venir',
    'a-venir Timbre Fête de la musique 2027, à venir',
    'a-venir Timbre L’été 2027, à venir',
    'a-venir Timbre La rentrée 2027, à venir',
    'a-venir Timbre Halloween 2027, à venir',
    'a-venir Timbre Noël 2027, à venir',
  ])
  // Sous chacun, en mots : jusqu'à quand, ou ses dates — Pâques suit la lune, et la rentrée commence un 1er.
  const legendes = [...ligne.matchAll(/<span class="timbres-legende timbres-legende-[a-z-]+">([^<]+)<\/span>/g)].map(m => m[1].replace(/ /g, ' '))
  assert.deepEqual(legendes.slice(0, 3), ['En cours · jusqu’au 2 janvier', 'du 12 au 15 février', 'du 26 au 29 mars'])
  assert.equal(legendes[5], 'du 1er au 7 septembre')
  // Gagné, il porte son cachet ; ni le Nouvel An en cours ni ceux à venir.
  assert.doesNotMatch(ligne, /timbre-cachet/)
  const halloween = await rendu('components/Timbre', 'Timbre', { fete: 'halloween', millesime: 2026, etat: 'gagne' })
  assert.match(halloween, /aria-label="Timbre Halloween 2026, gagné"/)
  assert.match(halloween, /class="timbre-cachet"[\s\S]*GAGNÉ[\s\S]*2026/)
  // La dentelure est un masque à lui : deux timbres d'une page ne partagent pas le même.
  assert.match(halloween, /<mask id="timbre-trous-[\w-]+">/)
  // Gagné à la fin d'une partie : sa carte, et le lien vers son carnet.
  const gagne = await rendu('components/Timbre', 'TimbreGagne', { timbre: 'paques:2027' })
  // Sa carte n'emprunte pas le nom d'un état (`timbre-${etat}`) : `.timbre-gagne` aurait fait de chaque timbre gagné du carnet une boîte souple.
  assert.match(gagne, /^<section class="card timbre-tombe">/)
  assert.doesNotMatch(source('client/src/styles.css'), /^\.timbre-(gagne|en-cours) \{/m)
  assert.match(gagne, /<b>Ton timbre Pâques 2027<\/b>/)
  assert.match(gagne, /<a class="link-inline" href="\/profil#collection-timbres">Ouvrir mon carnet<\/a>/)
  assert.equal(await rendu('components/Timbre', 'TimbreGagne', { timbre: 'inconnue:2027' }), '')
})

// « Ma gerbe » ne montre que les siennes (le 11 octobre 2026) : c'est ici
// que celles à gagner se voient — elles éclatent au toucher, sans se porter.
test('les gerbes de la collection se touchent pour éclater, même celles à gagner — rien ne s’y porte', async () => {
  lieu.hash = '#collection-gerbes'
  const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  lieu.hash = ''
  assert.match(html, /<li id="collection-gerbes" class="trophee trophee-ouvert"/)
  const ligne = html.slice(html.indexOf('id="collection-gerbes"'), html.indexOf('id="collection-finitions"'))
  // Un album, comme les avatars et les trophées (le 13 octobre 2026) : une
  // case par gerbe, éteintes celles à gagner, chacune ce qu'il faut sous elle.
  assert.equal(ligne.match(/<button type="button" class="trophee-case style-case/g)?.length, GERBES.length)
  assert.equal(ligne.match(/class="trophee-case style-case trophee-manque"/g)?.length, GERBES.length - LEA.gerbes.length)
  assert.match(ligne, /aria-label="Les ballons, à gagner : Le Laurier">/)
  assert.doesNotMatch(ligne, /aria-pressed|Le porter/)
  // Touchée, elle éclate — même à gagner : on sait ce qu'on vise.
  assert.match(source('client/src/components/AlbumDuStyle.tsx'), /if \(partie === 'gerbes'\) setEclat\(/)
  // Elle se porte dans « Ma gerbe », sa page — plus sous les thèmes : le lien le dit.
  assert.match(ligne, /Elle se porte dans <a class="link-inline" href="#gerbe">« Ma gerbe »<\/a>/)
})

test('une ligne de la collection a son adresse : « Mon thème » y mène, sur l’album des thèmes', async () => {
  lieu.hash = '#collection-themes'
  const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  assert.match(html, /<li id="collection-themes" class="trophee trophee-ouvert"/)
  // Un album : une page par rareté, sa gemme et son compte en titre, chaque
  // thème en vignette à sa place du catalogue — en couleur ceux qu'elle a, en
  // gris les autres. Deux lignes de texte disaient ce qu'elle avait sans le
  // montrer, puis les cartes de la boutique prenaient quatre écrans.
  assert.doesNotMatch(html, /À toi · \d|theme-a-gagner|class="theme-vitrine/)
  const pages = [
    ...html.matchAll(
      /<h4 class="album-rarete" style="([^"]+)"><i aria-hidden="true"><\/i>([^<]+) <span class="famille-compte">(\d+)\/(\d+)<\/span><\/h4><div class="album-themes" role="group" aria-label="([^"]+)">(.*?)<\/div>/g,
    ),
  ].map(m => ({
    style: m[1],
    nom: m[2],
    compte: `${m[3]}/${m[4]}`,
    groupe: m[5],
    vignettes: [...m[6].matchAll(/<button type="button" class="vignette-theme([^"]*)" style="([^"]+)"[^>]*aria-label="([^"]+)"/g)].map(v => ({ classes: v[1], style: v[2], nom: v[3] })),
  }))
  assert.deepEqual(
    pages.map(p => `${p.nom} ${p.compte}`),
    ['Offert 2/2', 'Commune 0/5', 'Peu commune 0/7', 'Rare 0/8', 'Épique 0/5', 'Légendaire 1/8'],
  )
  const possedes = new Set(LEA.boutique.possedes)
  for (const [i, r] of RARETES_DE_THEME.entries()) {
    const page = pages[i]
    const themes = THEMES.filter(t => t.rarete === r)
    assert.equal(page.groupe, `${NOM_DE_RARETE[r]} : ${themes.filter(t => possedes.has(t.key)).length} sur ${themes.length}`)
    // Chacun à sa place du catalogue, bordé de la gemme de sa page.
    assert.deepEqual(
      page.vignettes.map(v => v.nom.split(',')[0]),
      themes.map(t => t.nom),
      r,
    )
    for (const v of page.vignettes) assert.equal(v.style, page.style, v.nom)
    // En gris ce qui lui manque, en couleur le reste ; le Sommet, porté, cerclé.
    assert.deepEqual(
      page.vignettes.map(v => v.classes.includes('vignette-manque')),
      themes.map(t => !possedes.has(t.key)),
      r,
    )
  }
  const portees = pages.flatMap(p => p.vignettes).filter(v => v.classes.includes('vignette-portee'))
  assert.deepEqual(portees.map(v => v.nom), ['Le Sommet, porté'])
  // Ceux qui se gagnent n'ont pas de prix : leur fiche dit comment, et où.
  assert.ok(pages[5].vignettes.some(v => v.nom === 'Babel, Légendaire, se gagne'))
  // La vignette est l'aperçu seul — dans Vite, celui de la boutique (`apercuDe`) — et le gris vient de la feuille.
  const page = source('client/src/components/Collection.tsx')
  assert.match(page, /const apercu = apercuDe\(t\.key\)/)
  assert.match(page, /<VignetteDeTheme t=\{t\} etat=\{etat\(t\)\} solde=\{solde\} ouvert=\{ouvert === t\.key\} onToucher=\{\(\) => setOuvert\(o => \(o === t\.key \? null : t\.key\)\)\} \/>/)
  assert.match(source('client/src/styles.css'), /\.vignette-manque img \{ filter: grayscale\(1\); opacity: 0\.4; \}/)
  // Un toucher ouvre sa fiche, qui ne fait que montrer : ni `onPorter` ni `onAcheter`.
  assert.doesNotMatch(html, /id="detail-theme"/, 'aucune fiche avant le premier toucher')
  assert.match(page, /<DetailTheme theme=\{t\} etat=\{etat\(t\)\} solde=\{solde\} \/>/)
  // Ouverte, elle défile jusqu'à se montrer entière : au-dessus de la barre du menu, sous laquelle passait son lien.
  assert.match(source('client/src/styles.css'), /html:has\(> body\.avec-menu\) \{ scroll-padding-bottom: calc\(72px \+ env\(safe-area-inset-bottom\)\); \}/)
  // Chaque autre ligne dit où se porte ce qu'on a.
  for (const [partie, ecran] of [
    ['avatars', 'avatar'],
    // Un trophée se porte en titre, ou dans la vitrine de sa carte.
    ['trophees', 'titre'],
    ['fonds', 'fond'],
    ['gerbes', 'gerbe'],
    ['finitions', 'avatar'],
    ['bordures', 'avatar'],
  ]) {
    lieu.hash = `#collection-${partie}`
    const ouverte = await rendu('components/Collection', 'MaCollection', { profil: LEA })
    assert.match(ouverte, new RegExp(`<li id="collection-${partie}" class="trophee trophee-ouvert"`), partie)
    assert.match(ouverte, new RegExp(`<a class="link-inline" href="#${ecran}">`), partie)
  }
  // Les fonds en album : celui qu'elle porte, coché ; les autres éteints, ce qu'il faut sous leur case.
  lieu.hash = '#collection-fonds'
  const fonds = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  assert.match(fonds, /aria-label="Nuit étoilée, porté"><span class="trophee-medaillon" aria-hidden="true"><span class="fond-apercu carte-fond fond-nuit"><\/span><span class="album-coche">/)
  assert.match(fonds, /class="trophee-case style-case trophee-manque"[^>]*aria-label="Aurore boréale, à gagner : niv\. 20">.*?<span class="trophee-sous" aria-hidden="true">niv\. 20<\/span>/)
  lieu.hash = ''
})

// La maquette 1, choisie le 13 octobre 2026 : un album, une page par rareté.
test('l’album des avatars : six gemmes et leur compte, ce qu’il a en couleur, le reste en silhouette — et où le gagner', async () => {
  // Le Cabinet fermé, en le disant : ouvert, ses lieux s'ajoutent (`album-des-avatars.test.ts` les éprouve), et le
  // jour où il ouvre en production, le drapeau du code ne doit pas faire rougir ce que cette page dit sans lui.
  const album = (page: string) => rendu('components/AlbumDesAvatars', 'AlbumDesAvatars', { profil: LEA, page, onPage: () => {}, cabinet: false })
  const html = await album('legendaire')
  // Six gemmes, une par page — les onglets de l'application : un seul arrêt de Tab, le panneau de la choisie seulement.
  const gemmes = [...html.matchAll(/<button id="gemme-(\w+)" type="button" role="tab" aria-selected="(true|false)"[^>]*aria-label="([^"]+)"/g)].map(m => `${m[1]}${m[2] === 'true' ? '*' : ''} ${m[3]}`)
  // Les quatre formes de la luciole, une par page, et sa luciole-aurore, légendaire, depuis le 20 octobre 2026.
  assert.deepEqual(gemmes, [
    'commune Commune, 6 sur 23',
    'peucommune Peu commune, 1 sur 18',
    'rare Rare, 0 sur 29',
    'epique Épique, 0 sur 17',
    'legendaire* Légendaire, 1 sur 54',
    'divin Divin, 1 sur 6',
  ])
  assert.match(html, /<div class="gemmes gemmes-album" role="tablist" aria-label="Les raretés">/)
  assert.equal(html.match(/tabindex="0"/g)?.length, 1)
  assert.equal(html.match(/aria-controls="album-page"/g)?.length, 1)
  assert.match(html, /<div class="album-avatars" role="tabpanel" id="album-page" aria-labelledby="gemme-legendaire"/)
  // Ce que range la page, compté.
  assert.match(
    html,
    /<p class="gemme-legende"[^>]*><b>Légendaire · 1 sur 54\.<\/b> Les légendaires des hauts faits, la forme ultime de chaque sentier, celle de chaque compagnon et sa métamorphose\.<\/p>/,
  )
  // Cinquante-trois cases : le Phénix d'abord, porté — sa coche —, puis ce qui reste — les légendaires, les
  // formes ultimes des sentiers et des cinq compagnons, leurs cinq métamorphoses —, chacun dit où il se gagne.
  const cases = [...html.matchAll(/<button type="button" class="album-case([^"]*)" aria-expanded="false" aria-label="([^"]+)"/g)].map(m => ({ classes: m[1], nom: m[2] }))
  assert.equal(cases.length, LEGENDAIRES.length + 12 + 5 + 5)
  assert.deepEqual(cases[0], { classes: '', nom: 'Le Phénix, légendaire, porté' })
  assert.equal(html.match(/class="album-coche"/g)?.length, 1)
  assert.ok(cases.slice(1).every(c => c.classes.includes('album-manque')))
  for (const nom of [
    'La Licorne Astrale, légendaire, à gagner en soirée ou au quiz du jour',
    // L'Expédition effacée le 31 octobre 2026 (le choix du propriétaire) : sa voie se tait.
    'La Chimère, légendaire, à gagner en soirée, au quiz du jour et en campagne',
    'La Citrouille, légendaire, à gagner pour Halloween',
    'L’Éléphant, légendaire, à gagner en campagne',
    'Le loup des étoiles, légendaire, à gagner en boutique, puis à 500 bonnes réponses avec lui',
    'Le loup-tempête, légendaire, à gagner en boutique, puis à 500 bonnes réponses avec lui et par l’Éclat',
    // La luciole se gagnait en expédition (le 20 octobre 2026) ; elle s'achète comme les autres depuis le 31 octobre 2026.
    'La luciole-constellation, légendaire, à gagner en boutique, puis à 500 bonnes réponses avec elle',
    'La luciole-aurore, légendaire, à gagner en boutique, puis à 500 bonnes réponses avec elle et par l’Éclat',
  ])
    assert.ok(cases.some(c => c.nom === nom), nom)
  // Une pastille sur chaque case qui reste, et leur légende sous la grille — plus d'expédition : la luciole a celle de la boutique.
  // Le Djinn n'a que sa voie du Cabinet, que l'album tait ici, rendu Cabinet fermé (`cabinet: false`) : sans pastille.
  assert.equal(html.match(/class="album-lieu"/g)?.length, cases.length - 2)
  const legende = [...html.slice(html.indexOf('album-legende')).matchAll(/<\/svg>([^<]+)<\/span>/g)].map(m => m[1])
  assert.deepEqual(legende, ['en soirée', 'au quiz du jour', 'à sa saison', 'en campagne', 'sur les sentiers', 'en boutique'])
  // Aucune fiche avant le premier toucher ; rien ne s'y porte.
  assert.doesNotMatch(html, /id="fiche-avatar"|Le porter|aria-pressed/)

  // La page commune : les emojis qu'elle a, en couleur ; les autres en silhouette, leur niveau sur l'anneau.
  const commune = await album('commune')
  assert.match(commune, /aria-label="Avatar 🐝, commune, à toi"/)
  assert.match(commune, /aria-label="Avatar 🦩, commune, à gagner au niveau 9"><span class="album-medaillon" aria-hidden="true"><span class="silhouette">🦩<\/span><\/span><span class="case-niveau" aria-hidden="true">niv\. 9<\/span>/)
  assert.match(commune, /aria-label="L’écureuil, commune, à toi"/)
  assert.match(commune, /aria-label="Le kangourou, commune, à gagner sur les sentiers"/)

  // Les Divins : le sien, et cinq voiles qui ne disent rien d'eux — ni nom, ni lieu (invariant 21).
  const divins = await album('divin')
  const voiles = [...divins.matchAll(/class="album-case([^"]*)" aria-expanded="false" aria-label="([^"]+)"/g)].map(m => m[2])
  assert.deepEqual(voiles, ['Le Séraphin, divin, à toi', ...Array(5).fill('Un Divin, inconnu')])
  for (const d of DIVINS.filter(d => d.key !== 'dv:seraphin')) assert.ok(!divins.includes(d.nom), d.nom)
  assert.doesNotMatch(divins, /album-lieu|album-legende/)
  assert.match(divins, /Ils ne disent pas comment\./)

  // La fiche suit sa rangée, de toute la largeur ; la grille finit la rangée avec les cases d'après.
  const CSS = source('client/src/styles.css')
  assert.match(CSS, /\.album-avatars \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);[^}]*grid-auto-flow: dense;/)
  assert.match(CSS, /\.fiche-case \{ grid-column: 1 \/ -1; \}/)
  assert.match(source('client/src/components/AlbumDesAvatars.tsx'), /<\/button>\s*\{ouvert === a\.cle && \(\s*<div id="fiche-avatar" className="fiche-case album-fiche" ref=\{detail\}>/)
})

test('l’album a ses pages à son adresse — et les lignes d’avant y mènent, sur la page de leur prochain avatar', async () => {
  const choisie = async (hash: string) => {
    lieu.hash = hash
    const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
    lieu.hash = ''
    assert.match(html, /<li id="collection-avatars" class="trophee trophee-ouvert"/, hash)
    return /<button id="gemme-(\w+)" type="button" role="tab" aria-selected="true"/.exec(html)?.[1]
  }
  // Ouverte sans page : celle de ce qu'elle porte, le Phénix.
  assert.equal(await choisie('#collection-avatars'), 'legendaire')
  assert.equal(await choisie('#collection-avatars-rare'), 'rare')
  // « 24 légendaires à gagner : où ? », les sentiers, les emojis : un lien d'avant, un favori.
  assert.equal(await choisie('#collection-legendaires'), 'legendaire')
  assert.equal(await choisie('#collection-savoir'), 'commune')
  assert.equal(await choisie('#collection-emojis'), 'commune')
  // La page choisie s'écrit dans l'adresse, sans entrée de plus : revenu du sentier qu'une fiche a ouvert, on la retrouve.
  assert.match(source('client/src/components/Collection.tsx'), /const choisirLaPage = \(r: RareteDAvatar\) => \{\s*ecrire\(`-avatars-\$\{r\}`\)/)
  assert.match(source('client/src/components/Collection.tsx'), /history\.replaceState\(history\.state, '', `\$\{window\.location\.pathname\}\$\{window\.location\.search\}#\$\{ADRESSE\}\$\{suite\}`\)/)
})

test('l’album des trophées a ses pages à son adresse — et les dix lignes d’avant y mènent, sur la page de leur mode', async () => {
  const choisie = async (hash: string) => {
    lieu.hash = hash
    const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
    lieu.hash = ''
    assert.match(html, /<li id="collection-trophees" class="trophee trophee-ouvert"/, hash)
    return /<button id="trophees-onglet-(\w+)" type="button" role="tab" aria-selected="true"/.exec(html)?.[1]
  }
  // Ouvert sans page : celle du mode où elle a le plus — ses soirées.
  assert.equal(await choisie('#collection-trophees'), 'soiree')
  // La fin d'une partie y mène sur la page de ce qu'elle vient de faire tomber.
  assert.equal(await choisie('#collection-trophees-duels'), 'duels')
  assert.equal(await choisie('#collection-trophees-jour'), 'jour')
  // Un lien d'avant, un favori : chaque ligne d'avant, la page de son mode.
  for (const [ancienne, page] of [
    ['eclats', 'soiree'],
    ['ombres', 'soiree'],
    ['prix', 'soiree'],
    ['paliers', 'soiree'],
    ['jour', 'jour'],
    ['paliersDuJour', 'jour'],
    ['campagne', 'campagne'],
    ['paliersDeCampagne', 'campagne'],
    ['ecussons', 'partout'],
    ['paliersDeToujours', 'partout'],
  ])
    assert.equal(await choisie(`#collection-${ancienne}`), page, ancienne)
  assert.match(source('client/src/components/Collection.tsx'), /const choisirLaPageDesTrophees = \(p: PageDesTrophees\) => \{\s*ecrire\(`-trophees-\$\{p\}`\)/)
})

// La fiche de la maquette : comment l'obtenir, voie par voie, où il en est, et le chemin de l'écran où le gagner.
test('la fiche d’un avatar à gagner : ses voies — « ou » entre elles, « et » dans une voie —, où il en est, et où aller', async () => {
  // Le Cabinet fermé, en le disant, comme l'album plus haut : ouvert, la Chimère a une voie de plus.
  const fiche = (cle: string, profil: object = LEA) => rendu('components/AlbumDesAvatars', 'FicheDeLAvatar', { a: avatarDeLAlbum(cle, false), aLui: false, porte: false, profil, dessin: null, cabinet: false })
  const etapes = (html: string) => [...html.matchAll(/<span class="album-etape-texte"><b>([^<]+)<\/b>(?:<span class="muted small">([^<]+)<\/span>)?(?:<span class="album-progres">.*?<span>([^<]+)<\/span><\/span>)?<\/span>/g)].map(m => [m[1], m[3] ?? null])
  const licorne = await fiche('lg:licorne', { ...LEA, hautsFaits: [...LEA.hautsFaits, vu('hf:seul-contre-tous', 1)] })
  assert.match(licorne, /<b class="galerie-detail-nom">La Licorne Astrale<\/b><span class="album-detail-rarete"><i aria-hidden="true"><\/i>Légendaire<\/span>/)
  assert.match(licorne, /<p class="serif-note">« Seul contre tous, et trois fois raison\. »<\/p>/)
  assert.match(licorne, /<span class="label album-etiquette">Comment l’obtenir<\/span>/)
  assert.deepEqual(etapes(licorne), [
    ['En soirée : 3 fois « Seul contre tous »', '1 sur 3'],
    ['Au quiz du jour : 3 fois « Seul au monde »', '0 sur 3'],
  ])
  assert.equal(licorne.match(/<span class="album-ou">ou<\/span>/g)?.length, 1)
  assert.match(licorne, /<a class="btn btn-small album-aller" href="\/jour">Jouer le quiz du jour<\/a>/)
  // La Chimère : une voie de trois étapes à la fois — l'expédition, l'autre voie, tue depuis son effacement (le 31 octobre 2026).
  const chimere = await fiche('lg:chimere')
  assert.equal(chimere.match(/<span class="album-et">et<\/span>/g)?.length, 2)
  assert.equal(chimere.match(/<span class="album-ou">ou<\/span>/g), null)
  // Un légendaire des soirées — qu'on rejoint par leur code, sans écran où aller — avait l'expédition, qui en était un ;
  // effacée, le Cabinet fermé, rien où aller (ouvert, sa salle : `album-des-avatars.test.ts`).
  assert.doesNotMatch(await fiche('lg:oracle'), /album-aller/)
  // Un légendaire de saison non plus : ses dates seules, sans jauge — le quiz du jour ne compte que pendant elles.
  const citrouille = await fiche('lg:citrouille')
  assert.match(citrouille, /Pour Halloween, du 25 octobre au 1er novembre/)
  assert.doesNotMatch(citrouille, /album-aller|album-progres/)
  // Un portrait : le palier de son sentier, et le chemin du sentier.
  const lynx = await fiche('br:lynx')
  assert.deepEqual(etapes(lynx), [['Sur les sentiers : le palier 6 du sentier de la forêt', 'palier 5 sur 6']])
  assert.match(lynx, /<a class="btn btn-small album-aller" href="\/campagne#sentier-foret">Aller au sentier<\/a>/)
  // Un emoji : son niveau, rien où aller — il vient de tout ce qu'on joue.
  const baleine = await fiche('🐳')
  assert.deepEqual(etapes(baleine), [['Au niveau 12', 'niveau 8 sur 12']])
  assert.doesNotMatch(baleine, /album-aller/)
  // Un Divin pas encore descendu : son mystère, rien d'autre — ni nom, ni voie, ni jauge (invariant 21).
  const voile = await fiche('dv:lotus')
  assert.match(voile, /<b class="galerie-detail-nom">\?<\/b>/)
  assert.match(voile, /Personne ne sait ce qui le fait descendre\./)
  assert.doesNotMatch(voile, /Lotus|Comment l’obtenir|album-etape|album-aller|jauge/)
  // Aucune fiche n'a de bouton : on y lit, on n'y porte rien.
  for (const html of [licorne, chimere, lynx, baleine, voile]) assert.doesNotMatch(html, /<button/)
  // L'Éclat ne se dit que sur ce qui est à lui : verrouillé, rien n'éclate.
  const eclate = { ...LEA, eclats: ['lg:licorne', 'lg:phenix'] }
  assert.doesNotMatch(await fiche('lg:licorne', eclate), /Il a éclaté/)
  assert.match(
    await rendu('components/AlbumDesAvatars', 'FicheDeLAvatar', { a: avatarDeLAlbum('lg:phenix'), aLui: true, porte: true, profil: eclate, dessin: null }),
    /Il a éclaté : tu portes sa version rare/,
  )
})

test('une fiche de la collection ne porte rien : ni bouton ni « Le porter » — ce qui est à lui se porte dans « Mon avatar »', async () => {
  // La fiche de l'album, sous sa case : à lui, elle le dit et mène à la loge ;
  // porté, elle le dit aussi. Rien ne s'y porte ni ne s'y règle.
  const fiche = (cle: string, aLui: boolean, porte = false) =>
    rendu('components/AlbumDesAvatars', 'FicheDeLAvatar', { a: avatarDeLAlbum(cle), aLui, porte, profil: LEA, dessin: null })
  for (const [cle, nom] of [
    ['lg:phenix', 'Le Phénix'],
    ['dv:seraphin', 'Le Séraphin'],
    ['br:blaireau', 'Le blaireau'],
    ['🐝', 'Emoji de collection'],
  ] as const) {
    const html = await fiche(cle, true)
    assert.doesNotMatch(html, /<button|Le porter|Il remplacera/, cle)
    assert.match(html, new RegExp(`<b class="galerie-detail-nom">${nom}</b>`), cle)
    assert.match(html, /À toi\. Il se porte dans <a class="link-inline" href="#avatar">« Mon avatar »<\/a>\./, cle)
  }
  assert.match(await fiche('lg:phenix', true, true), /À toi, et tu le portes\. On en change dans <a class="link-inline" href="#avatar">/)
  // Un thème non plus : un lien mène à l'écran qui le porte, ou qui le vend.
  const theme = (cle: string, etat: string) => rendu('components/Boutique', 'DetailTheme', { theme: THEMES.find(t => t.key === cle), etat, solde: 350 })
  const aToi = await theme('velours', 'a-toi')
  assert.doesNotMatch(aToi, /<button/)
  assert.match(aToi, /À toi : il se porte dans <a class="link-inline" href="#theme">« Mon thème »<\/a>\./)
  const enVente = await theme('ocean', 'a-vendre')
  assert.doesNotMatch(enVente, /<button/)
  assert.match(enVente, /Il coûte 250 confettis : il t’en restera 100\.<\/p><a class="link-inline" href="\/boutique">La boutique<\/a>/)
})

test('la boutique ne montre que ce qui se vend : ceux qui se gagnent ont leur lieu dans leur fiche, dans « Ma collection »', async () => {
  const html = await rendu('components/Boutique', 'RayonDesThemes', { profil: LEA, busy: false, acheter: async () => null })
  // Ni carte ni ligne : un thème qui ne s'achète pas n'a rien à faire dans
  // une boutique, et la collection les montre (la remarque du 6 octobre 2026).
  assert.doesNotMatch(html, /se gagne|ne se vendent pas|theme-a-gagner/)
  const vendus = casesDe(html)
  assert.ok(vendus.length > 0)
  for (const t of THEMES.filter(t => t.gagne)) assert.ok(!vendus.some(nom => nom.startsWith(`${t.nom},`)), t.key)
  // Ce qu'elle a se porte dans « Mon thème ».
  assert.match(html, /déjà à toi : <a class="link-inline" href="\/profil#theme">les porter<\/a>/)
  // La fiche de chacun : ce qu'il faut, sans prix, et le lieu qui le donne.
  const lieux: string[] = []
  for (const t of THEMES.filter(t => t.gagne)) {
    const fiche = await rendu('components/Boutique', 'DetailTheme', { theme: t, etat: 'a-gagner', solde: 350 })
    assert.match(fiche, new RegExp(`<span class="detail-famille muted">${NOM_DE_RARETE[t.rarete]} · il se gagne</span>`), t.key)
    // Les espaces fines de `espacesFines`, devant les deux-points.
    assert.match(fiche, /Il ne se vend pas\s:\sil se gagne avec\s/, t.key)
    assert.doesNotMatch(fiche, /🎊|<button/, t.key)
    const lien = /<a class="link-inline" href="([^"]+)">([^<]+)<\/a>/.exec(fiche)!
    lieux.push(`${t.nom} → ${lien[2]} (${lien[1]})`)
  }
  assert.deepEqual(lieux, [
    'Babel → Les sentiers (/campagne#sentiers)',
    'L’Horloge astronomique → Le quiz du jour (/jour)',
    'Le Ciel du jour → Le quiz du jour (/jour)',
    'Les Très Riches Heures → Le quiz du jour (/jour)',
    'Le Sommet → La série (/campagne)',
  ])
  // Chaque thème qui se gagne dit où : un thème de plus devra le dire aussi.
  for (const t of THEMES.filter(t => t.gagne)) assert.match(t.gagne!.ou.lien, /^\/(campagne|jour)/, t.key)
})

test('la vitrine d’une carte : une seule règle, que lisent le serveur, la carte de la loge et le choix de la vitrine', () => {
  assert.match(source('shared/carte.ts'), /export function vitrineDeLaCarte\(/)
  assert.match(source('server/src/core/carte.ts'), /import \{ vitrineDeLaCarte, type CarteDeJoueur \} from '\.\.\/\.\.\/\.\.\/shared\/carte'/)
  assert.doesNotMatch(source('server/src/core/carte.ts'), /function vitrineDeLaCarte/)
  assert.match(source('client/src/components/Trophees.tsx'), /const montres = vitrineDeLaCarte\(profil\.vitrine, choisie, recompenses\)/)
  // La carte de la loge, sur la page du profil, la lit aussi — l'essai compris : le vestiaire la lisait par ses aperçus.
  assert.match(source('shared/loge.ts'), /return vitrineDeLaCarte\(profil\.vitrine, profil\.vitrineChoisie \?\? null, recompensesDe\(profil\.hautsFaits\)\)/)
  assert.match(source('client/src/components/Loge.tsx'), /vitrine=\{vitrineVue\(vu\)\}/)
})

// « Ma collection » : tout ce qui se gagne, ce qu'on a, ce qui reste — et où
// le gagner.
//
// Les écrans où l'on choisit ce qu'on porte (« Mon avatar », « Ma carte »,
// « Mon thème ») ne montrent que ce qu'on a ; la collection montre tout, et
// n'y règle rien. Son compte est celui de la tuile du profil : une seule
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
import { LIEU_DES_TROPHEES, compteDeLaCollection, comptesDesTrophees, listesDesTrophees } from '../../shared/collection'
import { NOM_DE_RARETE, RARETES_DE_THEME, THEMES } from '../../shared/themes'
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
  calendrier: { pages: ['heures:01'], dorees: [], mois: '2026-10', joursCeMois: 3 },
  jour: { joues: 4, victoires: 1, medailles: { or: 1, argent: 0, bronze: 0 }, record: 3, meilleurScore: 900 },
  boutique: { confettis: { gagnes: 500, depenses: 150, solde: 350 }, possedes: ['velours', 'ivoire', 'sommet'], porte: null, jour: '2026-10-05' },
}

test('le compte de la collection : trois familles, leurs lignes, un total — ce que la tuile et la page disent', () => {
  const { familles, total } = compteDeLaCollection(LEA as any)
  const lignes = familles.map(f => [f.famille, `${f.acquis}/${f.total}`, f.parties.map(p => `${p.partie} ${p.acquis}/${p.total}`)])
  assert.deepEqual(lignes, [
    // Deux portraits, le Phénix et le Séraphin, les cinq emojis de collection du niveau 8.
    ['avatars', '9/116', ['savoir 2/72', 'legendaires 2/32', 'emojis 5/12']],
    ['style', '9/59', ['themes 3/35', 'fonds 1/7', 'gerbes 2/10', 'finitions 3/7']],
    // Les lignes des trophées, comptées comme elles se montrent, rangées par
    // où elles se gagnent : le quiz du jour avec les pages de son calendrier,
    // un palier de carrière par métal — ceux des soirées, du jour, de la
    // campagne et de toujours chacun dans sa section.
    [
      'trophees',
      '8/24',
      [
        'eclats 1/2',
        'ombres 1/1',
        'prix 1/2',
        'paliers 2/3',
        'jour 2/13',
        'paliersDuJour 0/0',
        'campagne 0/1',
        'paliersDeCampagne 0/0',
        'ecussons 1/2',
        'paliersDeToujours 0/0',
      ],
    ],
  ])
  assert.deepEqual(total, { acquis: 26, total: 199 })
  // Les vingt-quatre emojis de l'inscription sont à tout le monde : ils ne se comptent pas.
  // Et ce qu'un serveur d'avant ne dit pas ne se compte pas : le total n'annonce jamais ce que la page ne montrerait pas.
  const avant = compteDeLaCollection({ ...LEA, boutique: undefined, fonds: undefined, gerbes: undefined, calendrier: undefined } as any)
  assert.deepEqual(
    avant.familles.find(f => f.famille === 'style')!.parties.map(p => p.partie),
    ['finitions'],
  )
  assert.deepEqual(comptesDesTrophees({ ...LEA, calendrier: undefined } as any).find(c => c.partie === 'jour'), { partie: 'jour', acquis: 1, total: 1 })
})

test('les trophées se comptent par la même règle que la collection', async () => {
  const html = await rendu('components/TropheesAtlas', 'TropheesAtlas', { profil: LEA })
  const montres = [...html.matchAll(/<span class="trophee-compte">([^<]+)<span class="jauge-fine"/g)].map(m => m[1])
  const comptes = comptesDesTrophees(LEA as any)
  // Toutes comme le compte, le quiz du jour compris : « 1 victoire » sur une
  // jauge de hauts faits ne disait pas la même chose qu'elle.
  assert.deepEqual(
    montres,
    comptes.map(c => `${c.acquis}/${c.total}`),
  )
  assert.match(source('client/src/components/TropheesAtlas.tsx'), /const comptes = new Map\(comptesDesTrophees\(profil\)\.map\(c => \[c\.partie, c\]\)\)/)
})

// « La partie haut fait de la collection est incompréhensible : il faudrait
// cloisonner par gagné en campagne / quiz du jour / quiz » (un retour du
// 10 octobre 2026). Chaque trophée se range là où on le gagne.
test('les trophées se rangent par où ils se gagnent : en soirée, au quiz du jour, en campagne, partout', async () => {
  const html = await rendu('components/TropheesAtlas', 'TropheesAtlas', { profil: LEA })
  const sections = [...html.matchAll(/<h3 id="trophees-(\w+)" class="label trophees-lieu">([^<]+)<\/h3>/g)].map(m => `${m[1]} ${m[2]}`)
  assert.deepEqual(sections, ['soiree En soirée', 'jour Au quiz du jour', 'campagne En campagne', 'partout Partout'])
  // Chaque ligne dans la section de son lieu.
  const parSection = html.split('<section ').slice(1).map(s => [...s.matchAll(/<span class="trophee-texte"><b>([^<]+)<\/b>/g)].map(m => m[1]))
  assert.deepEqual(parSection, [
    ['Hauts faits', 'Coups du sort', 'Prix', 'Paliers des soirées'],
    ['Hauts faits du jour', 'Paliers du jour'],
    ['Hauts faits de campagne', 'Paliers de campagne'],
    ['Écussons', 'Paliers de toujours'],
  ])
  // Les paliers de carrière se rangent par ce qu'ils comptent : le niveau et les Éclats de partout, à part.
  const vus = [vu('hf:habitue', 1), vu('hf:assidu', 1, { origine: 'jour' }), vu('hf:alpiniste', 2, { origine: 'campagne' }), vu('hf:legende', 1), vu('hf:eclats', 0)]
  const listes = listesDesTrophees({ hautsFaits: vus, prix: [], ecussons: [] })
  assert.deepEqual(
    [listes.paliers, listes.paliersDuJour, listes.paliersDeCampagne, listes.paliersDeToujours].map(l => l.map(h => h.key)),
    [['hf:habitue'], ['hf:assidu'], ['hf:alpiniste'], ['hf:legende', 'hf:eclats']],
  )
  // Chaque ligne a sa section, et aucune n'est oubliée.
  assert.deepEqual(Object.keys(LIEU_DES_TROPHEES).sort(), comptesDesTrophees(LEA as any).map(c => c.partie).sort())
})

test('la collection : son total, trois familles, une ligne par collection — repliées, sans rien à porter', async () => {
  lieu.hash = ''
  const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  assert.match(html, /<p class="collection-total"><b>26<\/b> sur 199<\/p>/)
  const familles = [...html.matchAll(/<h2 id="famille-\w+">([^<]+)<span class="collection-compte">([^<]+)<\/span><\/h2>/g)].map(m => `${m[1].trim()} ${m[2]}`)
  assert.deepEqual(familles, ['Avatars 9 sur 116', 'Style 9 sur 59', 'Trophées 8 sur 24'])
  const lignes = [...html.matchAll(/<span class="trophee-texte"><b>([^<]+)<\/b>/g)].map(m => m[1])
  assert.deepEqual(lignes, [
    'Le savoir',
    'Légendaires et Divins',
    'Emojis de collection',
    'Thèmes',
    'Fonds de carte',
    'Gerbes',
    'Finitions',
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
  assert.equal(html.match(/aria-expanded="true"/g), null, 'tout replié à l’ouverture')
  // On n'y règle rien : on y regarde. Les avatars s'y parcourent sans « Le porter ».
  const page = source('client/src/components/Collection.tsx')
  assert.match(page, /<AtlasDesAvatars profil=\{profil\} onglet="savoir" \/>/)
  assert.match(page, /<AtlasDesAvatars profil=\{profil\} onglet="legendaires" \/>/)
  assert.doesNotMatch(page, /enregistrer|busy/)
  assert.doesNotMatch(html, /Le porter|<button[^>]*aria-pressed/)
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
    ['savoir', 'avatar'],
    ['legendaires', 'avatar'],
    ['emojis', 'avatar'],
    ['fonds', 'carte'],
    ['gerbes', 'theme'],
    ['finitions', 'avatar'],
  ]) {
    lieu.hash = `#collection-${partie}`
    const ouverte = await rendu('components/Collection', 'MaCollection', { profil: LEA })
    assert.match(ouverte, new RegExp(`<li id="collection-${partie}" class="trophee trophee-ouvert"`), partie)
    assert.match(ouverte, new RegExp(`<a class="link-inline" href="#${ecran}">`), partie)
  }
  // Les fonds et les gerbes : coché ce qu'on a, la règle du reste.
  lieu.hash = '#collection-fonds'
  const fonds = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  assert.match(fonds, /<li class="a-gagner-a-toi">.*?<b>Nuit étoilée<\/b><span class="small">Porté<\/span>/)
  assert.match(fonds, /<li class="a-gagner-reste">.*?<b>Aurore boréale<\/b><span class="small">Le niveau 20<\/span>/)
  lieu.hash = ''
})

test('une fiche de la collection ne porte rien : sans `onPorter`, ni bouton ni « Il remplacera »', async () => {
  const communs = { busy: false, porte: 'lg:phenix' }
  const legendaire = await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:dragon', debloques: ['lg:dragon'], eclats: [], hautsFaits: [] })
  assert.doesNotMatch(legendaire, /<button|Il remplacera/)
  assert.match(legendaire, /<b class="galerie-detail-nom">Le Dragon d’Or<\/b>/)
  const divin = await rendu('components/Carriere', 'DetailDivin', { ...communs, cle: 'dv:seraphin', descendus: LEA.divins })
  assert.doesNotMatch(divin, /<button|Il remplacera/)
  const portrait = await rendu('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:blaireau', paliers: { foret: 5 }, eclat: false })
  assert.doesNotMatch(portrait, /<button|Il remplacera/)
  assert.match(portrait, /Gagné au palier 4/)
  // Avec, comme dans « Mon avatar » : on porte d'ici.
  assert.match(await rendu('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:blaireau', paliers: { foret: 5 }, eclat: false, onPorter: () => {} }), />Le porter</)
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

test('la vitrine d’une carte : une seule règle, que lisent le serveur, la tuile « Ma carte » et le choix de la vitrine', () => {
  assert.match(source('shared/carte.ts'), /export function vitrineDeLaCarte\(/)
  assert.match(source('server/src/core/carte.ts'), /import \{ vitrineDeLaCarte, type CarteDeJoueur \} from '\.\.\/\.\.\/\.\.\/shared\/carte'/)
  assert.doesNotMatch(source('server/src/core/carte.ts'), /function vitrineDeLaCarte/)
  assert.match(source('client/src/components/Trophees.tsx'), /const montres = vitrineDeLaCarte\(profil\.vitrine, choisie, recompenses\)/)
  assert.match(source('client/src/components/PanneauxDuProfil.tsx'), /vitrine: vitrineDeLaCarte\(profil\.vitrine, profil\.vitrineChoisie \?\? null, recompensesDe\(profil\.hautsFaits\)\)/)
})

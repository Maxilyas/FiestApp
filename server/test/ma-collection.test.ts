// « Ma collection » : tout ce qui se gagne, ce qu'on a, ce qui reste — et où
// le gagner.
//
// Les écrans où l'on choisit ce qu'on porte (« Mon avatar », « Ma carte »,
// « Mon thème ») ne montrent que ce qu'on a ; la collection montre tout, et
// n'y règle rien. Son compte est celui de la tuile du profil : une seule
// règle (`shared/collection.ts`), qui compte aussi les lignes des trophées.
//
// Et les thèmes qui ne se vendent pas : la boutique les disait en une ligne
// de texte chacun, et son lien menait les cinq aux sentiers quand quatre se
// gagnent au quiz du jour ou dans la série (la remarque du 5 octobre 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { compteDeLaCollection, comptesDesTrophees } from '../../shared/collection'
import { THEMES } from '../../shared/themes'
import { hautFait, type HautFaitVu } from '../../shared/hautsfaits'

const lieu = { pathname: '/profil', search: '', hash: '', origin: 'http://banc' }
Object.assign(globalThis, { React, window: { location: lieu }, location: lieu })

const source = (fichier: string) => readFileSync(new URL(`../../${fichier}`, import.meta.url), 'utf8')

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
    // Les lignes des trophées, comptées comme elles se montrent : le quiz du jour
    // avec les pages de son calendrier, un palier de carrière par métal.
    ['trophees', '8/24', ['eclats 1/2', 'ombres 1/1', 'paliers 2/3', 'ecussons 1/2', 'prix 1/2', 'jour 2/13', 'campagne 0/1']],
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
  // Le quiz du jour se dit en victoires ; les six autres, comme le compte.
  assert.deepEqual(
    montres,
    comptes.map(c => (c.partie === 'jour' ? '1 victoire' : `${c.acquis}/${c.total}`)),
  )
  assert.match(source('client/src/components/TropheesAtlas.tsx'), /const comptes = new Map\(comptesDesTrophees\(profil\)\.map\(c => \[c\.partie, c\]\)\)/)
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
    'Paliers',
    'Écussons',
    'Prix',
    'Quiz du jour',
    'Campagne',
  ])
  assert.equal(html.match(/aria-expanded="true"/g), null, 'tout replié à l’ouverture')
  // On n'y règle rien : on y regarde. Les avatars s'y parcourent sans « Le porter ».
  const page = source('client/src/components/Collection.tsx')
  assert.match(page, /<AtlasDesAvatars profil=\{profil\} onglet="savoir" \/>/)
  assert.match(page, /<AtlasDesAvatars profil=\{profil\} onglet="legendaires" \/>/)
  assert.doesNotMatch(page, /enregistrer|busy/)
  assert.doesNotMatch(html, /Le porter|<button[^>]*aria-pressed/)
})

test('une ligne de la collection a son adresse : « Mon thème » y mène, ouverte sur ceux qui se gagnent', async () => {
  lieu.hash = '#collection-themes'
  const html = await rendu('components/Collection', 'MaCollection', { profil: LEA })
  assert.match(html, /<li id="collection-themes" class="trophee trophee-ouvert"/)
  // Ce qu'elle a, ce que vend la boutique, et les cinq qui se gagnent — le Sommet, à elle, le dit.
  assert.match(html, /<b>À toi · 3<\/b> — Velours, Ivoire, Le Sommet\./)
  assert.match(html, /<a class="link-inline" href="#theme">Les porter<\/a>/)
  assert.match(html, /<b>À la boutique · \d+<\/b> — de 🎊 150 à 🎊 [\d  ]+/)
  const cartes = [...html.matchAll(/<li class="theme-a-gagner( theme-gagne)?"[^>]*>.*?<b>([^<]+)<\/b><span class="small">([^<]+)<\/span>/g)].map(m => `${m[2]} : ${m[3]}`)
  assert.equal(cartes.length, THEMES.filter(t => t.gagne).length)
  assert.ok(cartes.includes('Le Sommet : À toi : il se porte dans « Mon thème ».'), cartes.join('\n'))
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
})

test('la boutique montre les thèmes qui se gagnent dans leurs cartes, chacun avec le lieu qui le donne', async () => {
  const html = await rendu('components/Boutique', 'RayonDesThemes', { profil: LEA, busy: false, acheter: async () => null })
  // La ligne de texte d'avant, et son lien unique vers les sentiers, ne sont plus.
  assert.doesNotMatch(html, /ne se vend pas : il se gagne avec/)
  const cartes = [...html.matchAll(/<li class="theme-a-gagner"[^>]*>.*?<b>([^<]+)<\/b>.*?<a class="link-inline small" href="([^"]+)">([^<]+)<\/a>/g)].map(m => `${m[1]} → ${m[3]} (${m[2]})`)
  // Le Sommet est à elle : la boutique ne montre que ceux qui manquent.
  assert.deepEqual(cartes, [
    'Babel → Les sentiers (/campagne#sentiers)',
    'L’Horloge astronomique → Le quiz du jour (/jour)',
    'Le Ciel du jour → Le quiz du jour (/jour)',
    'Les Très Riches Heures → Le quiz du jour (/jour)',
  ])
  assert.match(html, /<h3 class="themes-a-gagner-titre">Ils ne se vendent pas : ils se gagnent<\/h3>/)
  // Ce qu'elle a se porte dans « Mon thème ».
  assert.match(html, /déjà à toi : <a class="link-inline" href="\/profil#theme">les porter<\/a>/)
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

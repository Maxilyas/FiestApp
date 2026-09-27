// La grille des avatars du profil : un seul geste pour tous. On touche un
// avatar — portrait d'une branche, emoji, de collection, légendaire ou Divin
// —, sa fiche s'ouvre sous sa rangée, et « Le porter » le porte. Cent
// vingt-neuf avatars se rangent par famille, un onglet chacune.
//
// Un emoji se portait d'un toucher, quand un avatar dessiné ouvrait sa
// légende : la même grille répondait de deux façons. Le doigt qui voulait
// voir la grenouille la portait déjà — enregistrée, montrée à la salle — et
// ôtait le Phénix, dix rangées plus bas. Et la fiche s'ouvrait sous toute la
// grille, 687 px en 360 × 640 : hors de l'écran, pour une case du haut.
// Le rendu se regarde dans un navigateur ; ici, ce qui le décide.
// Pas de serveur : des composants du client, rendus en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const CSS = source('styles.css')

/** Un composant du client, rendu en HTML — la recette de `petit-ecran.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Un composant sans état, appelé tel quel : l'arbre qu'il rend, ses gestes compris. */
async function arbre(fichier: string, composant: string, props: object): Promise<any> {
  const module = await import(url(`${fichier}.tsx`))
  return module[composant](props)
}

/** Les éléments de l'arbre, en profondeur, dans l'ordre de la page. */
function elements(noeud: any): any[] {
  if (Array.isArray(noeud)) return noeud.flatMap(elements)
  if (!noeud || typeof noeud !== 'object') return []
  return [noeud, ...elements(noeud.props?.children)]
}

/** Le corps de la première règle dont le sélecteur est exactement celui-ci. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|[{}])\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

/** Un habitué : le Phénix porté, la grenouille dessous, un second légendaire, un Divin, niveau 14. */
const HABITUE = {
  id: 'p1',
  login: 'jeanne',
  name: 'Jeanne',
  avatar: '🐸',
  finition: 'holo',
  finitionChoisie: 'holo',
  niveau: 14,
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  eclats: ['🦊'],
  legendaire: 'lg:phenix',
  legendaires: ['lg:phenix', 'lg:dragon'],
  divins: [{ key: 'dv:seraphin', legende: 'Il est descendu un soir de grand vent.', ton: 'eclat' }],
  hautsFaits: [],
}

/** Les cinq familles de « Mes avatars », dans l'ordre des onglets. */
const FAMILLES = ['branches', 'emojis', 'collection', 'legendaires', 'divins']

/** « Mes avatars » ouvert sur une famille. */
const mesAvatars = (profil: object, familleInitiale?: string) =>
  rendu('components/Apparence', 'MesAvatars', { profil, busy: false, enregistrer: () => {}, familleInitiale })

test('dans chaque famille, chaque case ouvre sa fiche : aucune ne se porte d’un toucher', async () => {
  const cases: string[] = []
  for (const famille of FAMILLES) {
    const html = await mesAvatars(HABITUE, famille)
    const boutons = [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0])
    // Des onglets, les lignes des branches à déplier, et des cases : rien d'autre à toucher.
    for (const b of boutons) assert.match(b, /role="tab"|class="ligne-branche"|class="emoji-btn case-avatar/, b)
    cases.push(...boutons.filter(b => /case-avatar/.test(b)))
    assert.doesNotMatch(html, /id="detail-avatar"/, `${famille} : aucune fiche avant le premier toucher`)
    // Les espaces fines de `espacesFines`, autour du bouton cité.
    assert.match(html, /touche un avatar, puis «\u202fLe porter\u202f»/)
  }
  // Les six portraits de la branche dépliée, vingt-quatre emojis, les dix de
  // collection ouverts au niveau 14, les légendaires, les Divins.
  assert.ok(cases.length > 50, `toutes les cases à toucher (${cases.length})`)
  for (const c of cases) {
    // Un bouton qui déplie, pas un interrupteur : `aria-pressed` disait qu'un
    // toucher portait l'emoji.
    assert.match(c, /aria-expanded="false"/, c)
    assert.doesNotMatch(c, /aria-pressed/, c)
    // Rien n'est ouvert : `aria-controls` ne vise que la fiche affichée.
    assert.doesNotMatch(c, /aria-controls/, c)
  }
  // L'emoji sous le Phénix n'est pas « porté » : c'est le Phénix que la salle voit.
  const portes = cases.filter(c => /aria-label="[^"]*, porté"/.test(c)).map(c => /aria-label="([^"]*)"/.exec(c)![1])
  assert.deepEqual(portes, ['Le Phénix, légendaire, porté'])

  // Le geste lui-même : dans les grilles, un toucher n'enregistre rien — il
  // ouvre la fiche, ou déplie une branche ; seule la fiche porte.
  const composant = source('components/Apparence.tsx')
  const corps = composant.slice(composant.indexOf('export function MesAvatars'), composant.indexOf('export function DetailPortrait'))
  const gestes = [...corps.matchAll(/onClick=\{/g)].map(m => {
    let profondeur = 1
    let k = m.index! + m[0].length
    while (profondeur > 0 && k < corps.length) {
      if (corps[k] === '{') profondeur++
      else if (corps[k] === '}') profondeur--
      k++
    }
    return corps.slice(m.index! + m[0].length, k - 1).trim()
  })
  assert.equal(gestes.filter(g => /^\(\) => toucher\([^)]*\)$/.test(g)).length, 5, 'emojis, collection, légendaires, Divins, portraits')
  assert.deepEqual(
    gestes.filter(g => !/^\(\) => toucher\(/.test(g)),
    ['() => deplier(b.key)'],
    'une ligne de branche se déplie',
  )
})

test('« Mes avatars » s’ouvre sur la famille de ce qu’il porte, et chaque onglet dit son compte', async () => {
  const onglet = (html: string) => /<button[^>]*role="tab" aria-selected="true"[^>]*>([^<]*)/.exec(html)?.[1]
  // Sous le Phénix, les légendaires ; sous un emoji de collection, la
  // collection ; sous un emoji de l'inscription, les branches — c'est là que
  // ses bonnes réponses le mènent.
  assert.equal(onglet(await mesAvatars(HABITUE)), 'Légendaires')
  assert.equal(onglet(await mesAvatars({ ...HABITUE, legendaire: null, avatar: '🐝' })), 'Collection')
  assert.equal(onglet(await mesAvatars({ ...HABITUE, legendaire: null })), 'Branches')
  assert.equal(onglet(await mesAvatars({ ...HABITUE, legendaire: 'dv:seraphin' })), 'Divins')
  const html = await mesAvatars({
    ...HABITUE,
    ecussons: [
      { categorie: 'Nature', justes: 25, palier: 1 },
      { categorie: 'Histoire', justes: 3, palier: 0 },
    ],
  })
  assert.match(html, />Branches<span class="onglet-compte">3 \/ 72<\/span>/)
  assert.match(html, />Collection<span class="onglet-compte">10 \/ 12<\/span>/)
  assert.match(html, />Légendaires<span class="onglet-compte">2 \/ 16<\/span>/)
})

test('l’onglet des branches : une dépliée — celle du portrait porté —, les autres sur une ligne qui dit ce qui vient', async () => {
  const savant = {
    ...HABITUE,
    legendaire: 'br:blaireau',
    ecussons: [
      { categorie: 'Nature', justes: 25, palier: 1 },
      { categorie: 'Histoire', justes: 3, palier: 0 },
    ],
  }
  const html = await mesAvatars(savant)
  // Douze branches : la forêt dépliée, onze lignes à toucher.
  assert.equal([...html.matchAll(/class="rayon"/g)].length, 1)
  assert.equal([...html.matchAll(/class="ligne-branche"/g)].length, 11)
  assert.match(html, /<b>La forêt<\/b><span class="detail-famille muted">Nature<\/span><span class="ligne-branche-compte">2 \/ 6<\/span>/)
  assert.match(html, /Encore 15 bonnes réponses en Nature pour le lynx\./)
  assert.match(html, /Encore 17 bonnes réponses en Histoire pour la Gorgone\./)
  assert.match(html, /Encore 3 bonnes réponses en Culture générale pour le kangourou\./)
  // Ses six cases : deux gagnées, dont celle qu'il porte ; quatre à gagner, avec leur palier.
  const cases = [...html.matchAll(/<button[^>]*class="(emoji-btn case-avatar case-portrait[^"]*)"[^>]*aria-label="([^"]*)"/g)].map(m => [m[1], m[2]])
  assert.deepEqual(
    cases.map(([, nom]) => nom),
    [
      'L’écureuil, gagné',
      'Le blaireau, porté',
      'Le lynx, à 40 bonnes réponses',
      'Le loup, à 75 bonnes réponses',
      'L’ours, à 130 bonnes réponses',
      'Le cerf, à 200 bonnes réponses',
    ],
  )
  assert.ok(cases[1][0].includes('selected') && cases[2][0].includes('ferme'))
  // Sans savoir encore, c'est la première branche qui se déplie.
  assert.match(await mesAvatars({ ...HABITUE, legendaire: null }), /<div class="rayon"><div class="rayon-tete"><b>Le tour du monde<\/b>/)
})

test('la fiche d’un portrait dit ce qui l’ouvre, et combien il manque ; gagné, il se porte d’ici', async () => {
  const portes: (string | null)[] = []
  const communs = { savoir: { Nature: 25 }, eclat: false, busy: false, onPorter: (k: string | null) => portes.push(k) }
  const blaireau = await rendu('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:blaireau', porte: 'lg:phenix' })
  assert.match(blaireau, /<span class="detail-famille muted">La forêt · Nature<\/span><b class="galerie-detail-nom">Le blaireau<\/b>/)
  assert.match(blaireau, /Gagné à 20 bonnes réponses en Nature, avec l’écusson de bronze\./)
  assert.match(blaireau, /Il remplacera Le Phénix, que tu gardes\.<\/p><button[^>]*>Le porter</)
  const lynx = await rendu('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:lynx', porte: null })
  assert.match(lynx, /Se gagne à 40 bonnes réponses en Nature : <b>encore 15<\/b>, en soirée comme au quiz du jour\./)
  assert.doesNotMatch(lynx, /<button/, 'à gagner : rien à porter')
  const loup = await rendu('components/Apparence', 'DetailPortrait', { ...communs, savoir: { Nature: 80 }, cle: 'br:loup', porte: 'br:loup' })
  assert.match(loup, /avec l’écusson d’argent/)
  assert.match(loup, />Revenir à mon emoji</)

  const fiche = await arbre('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:blaireau', porte: null })
  const bouton = elements(fiche).find(e => e.type === 'button')
  assert.equal(portes.length, 0, 'rien avant le bouton')
  bouton.props.onClick()
  assert.deepEqual(portes, ['br:blaireau'])
})

test('la fiche d’une case s’ouvre sous sa rangée, de toute la largeur de la grille', () => {
  // Juste derrière sa case dans la page ; `dense` finit la rangée avec les
  // cases d'après et pose la fiche dessous.
  assert.match(regle('.grille-unique'), /grid-auto-flow:\s*row dense/)
  assert.match(regle('.fiche-case'), /grid-column:\s*1 \/ -1/)
  const composant = source('components/Apparence.tsx')
  const corps = composant.slice(composant.indexOf('export function MesAvatars'), composant.indexOf('export function DetailPortrait'))
  // Chaque case suivie de sa fiche, dans sa grille — les portraits compris.
  assert.equal([...corps.matchAll(/<\/button>\s*\{fiche\((a|c\.emoji|l\.key|d\.key|p\.key)\)\}/g)].length, 5)
  // Et plus rien sous les grilles de « Mes avatars ».
  const seul = corps.slice(0, corps.indexOf('const SORTES_DES_BRANCHES'))
  assert.doesNotMatch(seul.slice(seul.indexOf('<p className="legende-anneaux')), /detail-avatar/)
  // La page défile juste ce qu'il faut pour la montrer entière, et le focus va à son nom.
  assert.match(corps, /scrollIntoView\(\{ block: 'nearest'/)
  assert.match(corps, /rendreLeFocus\(detail\.current, \['\.galerie-detail-nom'\]\)/)
})

test('« Le porter » porte l’emoji, et dit d’abord ce qu’il remplace', async () => {
  const portes: string[] = []
  const fiche = await arbre('components/Apparence', 'DetailEmoji', {
    emoji: '🦊',
    avatar: '🐸',
    porte: 'lg:phenix',
    eclat: true,
    busy: false,
    onPorter: (e: string) => portes.push(e),
  })
  const bouton = elements(fiche).find(e => e.type === 'button')
  assert.equal(bouton?.props.children, 'Le porter')
  assert.equal(portes.length, 0, 'rien avant le bouton')
  bouton.props.onClick()
  assert.deepEqual(portes, ['🦊'])

  const html = await rendu('components/Apparence', 'DetailEmoji', { emoji: '🦊', avatar: '🐸', porte: 'lg:phenix', eclat: true, busy: false, onPorter: () => {} })
  assert.match(html, /<span class="detail-famille muted">Emoji<\/span>/)
  assert.match(html, /<b class="galerie-detail-nom detail-emoji">🦊<\/b>/)
  // L'Éclat, que seul le lecteur d'écran disait.
  assert.match(html, /Il a éclaté/)
  // Le Phénix n'est pas perdu : on le lit avant de toucher.
  assert.match(html, /Il remplacera Le Phénix, que tu gardes\.<\/p><button/)
})

test('un emoji de collection dit son niveau ; porté, sa fiche n’a plus rien à toucher', async () => {
  const collection = await rendu('components/Apparence', 'DetailEmoji', {
    emoji: '🐝',
    avatar: '🐸',
    porte: null,
    eclat: false,
    busy: false,
    onPorter: () => {},
  })
  assert.match(collection, /<span class="detail-famille anneau-texte-collection">De collection · niveau 8<\/span>/)
  // Il ne remplace qu'un emoji : rien à dire.
  assert.doesNotMatch(collection, /Il remplacera/)
  assert.match(collection, />Le porter<\/button>/)
  const haute = await rendu('components/Apparence', 'DetailEmoji', { emoji: '🐳', avatar: '🐸', porte: null, eclat: false, busy: false, onPorter: () => {} })
  assert.match(haute, /class="detail-famille anneau-texte-collection-haut">De collection · niveau 12</)

  const porte = await rendu('components/Apparence', 'DetailEmoji', { emoji: '🐸', avatar: '🐸', porte: null, eclat: false, busy: true, onPorter: () => {} })
  assert.doesNotMatch(porte, /<button/)
  assert.match(porte, /C’est lui que la salle voit\./)
  // Sous un légendaire, l'emoji du profil n'est pas porté : il se reporte.
  const dessous = await rendu('components/Apparence', 'DetailEmoji', { emoji: '🐸', avatar: '🐸', porte: 'lg:phenix', eclat: false, busy: false, onPorter: () => {} })
  assert.match(dessous, />Le porter<\/button>/)
})

test('un légendaire et un Divin disent aussi ce qu’ils remplacent — jamais eux-mêmes', async () => {
  const communs = { debloques: ['lg:phenix', 'lg:dragon'], eclats: [], hautsFaits: [], busy: false, onPorter: () => {} }
  const dragon = await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:dragon', porte: 'lg:phenix' })
  assert.match(dragon, /Il remplacera Le Phénix, que tu gardes\.<\/p><button[^>]*>Le porter</)
  const phenix = await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:phenix', porte: 'lg:phenix' })
  assert.doesNotMatch(phenix, /Il remplacera/)
  assert.match(phenix, />Revenir à mon emoji</)
  // Sous un emoji, rien à dire : il reste dessous, et « Revenir à mon emoji » le rend.
  const sousEmoji = await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:dragon', porte: null })
  assert.doesNotMatch(sousEmoji, /Il remplacera/)
  // À gagner : pas de bouton, rien à remplacer.
  const aGagner = await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:oracle', porte: 'lg:phenix' })
  assert.doesNotMatch(aGagner, /Il remplacera|Le porter/)

  const descendus = [{ key: 'dv:seraphin', legende: 'Il est descendu un soir de grand vent.', ton: 'eclat' }]
  const seraphin = await rendu('components/Carriere', 'DetailDivin', { cle: 'dv:seraphin', descendus, porte: 'lg:phenix', busy: false, onPorter: () => {} })
  assert.match(seraphin, /Il remplacera Le Phénix, que tu gardes\.<\/p><button[^>]*>Le porter</)
  // Un Divin porté, et le Dragon regardé : c'est le Divin qu'on garde.
  const sousDivin = await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:dragon', porte: 'dv:seraphin' })
  assert.match(sousDivin, /Il remplacera Le Séraphin, que tu gardes\./)
})

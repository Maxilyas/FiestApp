// La grille des avatars du profil : un seul geste pour tous. On touche un
// avatar — emoji, de collection, légendaire ou Divin —, sa fiche s'ouvre
// sous sa rangée, et « Le porter » le porte.
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

test('dans la grille, chaque case ouvre sa fiche : aucune ne se porte d’un toucher', async () => {
  const html = await rendu('components/Apparence', 'MesAvatars', { profil: HABITUE, busy: false, enregistrer: () => {} })
  const grille = /<div class="emoji-grid grille-unique"[^>]*>([\s\S]*)<\/div><p class="legende-anneaux/.exec(html)?.[1]
  assert.ok(grille, 'la grille est rendue')
  const cases = [...grille.matchAll(/<button\b[^>]*>/g)].map(m => m[0])
  // Vingt-quatre emojis, les dix de collection ouverts au niveau 14, les légendaires, les Divins.
  assert.ok(cases.length > 45, `toutes les cases à toucher (${cases.length})`)
  for (const c of cases) {
    // Un bouton qui déplie, pas un interrupteur : `aria-pressed` disait qu'un
    // toucher portait l'emoji.
    assert.match(c, /aria-expanded="false"/, c)
    assert.doesNotMatch(c, /aria-pressed/, c)
    // Rien n'est ouvert : `aria-controls` ne vise que la fiche affichée.
    assert.doesNotMatch(c, /aria-controls/, c)
  }
  assert.doesNotMatch(html, /id="detail-avatar"/, 'aucune fiche avant le premier toucher')
  // L'emoji sous le Phénix n'est pas « porté » : c'est le Phénix que la salle voit.
  const portes = cases.filter(c => /aria-label="[^"]*, porté"/.test(c)).map(c => /aria-label="([^"]*)"/.exec(c)![1])
  assert.deepEqual(portes, ['Le Phénix, légendaire, porté'])
  assert.match(html, /touche un avatar, puis « Le porter »/)

  // Le geste lui-même : dans la grille, un toucher n'enregistre rien — il
  // ouvre ; seule la fiche porte.
  const composant = source('components/Apparence.tsx')
  const corps = composant.slice(composant.indexOf('export function MesAvatars'), composant.indexOf('export function DetailEmoji'))
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
  assert.equal(gestes.length, 4, 'emojis, collection, légendaires, Divins')
  for (const g of gestes) assert.match(g, /^\(\) => toucher\([^)]*\)$/, g)
})

test('la fiche d’une case s’ouvre sous sa rangée, de toute la largeur de la grille', () => {
  // Juste derrière sa case dans la page ; `dense` finit la rangée avec les
  // cases d'après et pose la fiche dessous.
  assert.match(regle('.grille-unique'), /grid-auto-flow:\s*row dense/)
  assert.match(regle('.fiche-case'), /grid-column:\s*1 \/ -1/)
  const composant = source('components/Apparence.tsx')
  const corps = composant.slice(composant.indexOf('export function MesAvatars'), composant.indexOf('export function DetailEmoji'))
  const grille = corps.slice(corps.indexOf('<div className="emoji-grid grille-unique"'), corps.indexOf('<p className="legende-anneaux'))
  // Chaque case suivie de sa fiche, dans la grille — plus rien dessous.
  assert.equal([...grille.matchAll(/<\/button>\s*\{fiche\((a|c\.emoji|l\.key|d\.key)\)\}/g)].length, 4)
  assert.doesNotMatch(corps.slice(corps.indexOf('<p className="legende-anneaux')), /detail-avatar/)
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

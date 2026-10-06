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

/** Les trois familles de « Mes avatars », dans l'ordre des onglets. */
const FAMILLES = ['branches', 'emojis', 'legendaires']

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

test('« Mes avatars » : trois onglets sur une rangée, ouverts sur la famille de ce qu’il porte ; chaque partie dit son compte', async () => {
  const onglets = (html: string) => [...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]*)<\/button>/g)].map(m => m[1])
  const actif = (html: string) => /<button[^>]*role="tab" aria-selected="true"[^>]*>([^<]*)/.exec(html)?.[1]
  // Trois noms courts, sans compteur : cinq onglets à compte faisaient trois
  // rangées au téléphone, un tiers de l'écran avant le premier avatar.
  assert.deepEqual(onglets(await mesAvatars(HABITUE)), ['Branches', 'Emojis', 'Légendaires'])
  // Sous le Phénix — ou un Divin —, les légendaires ; sous un emoji de
  // collection, les emojis ; sous un emoji de l'inscription, les branches :
  // c'est là que ses sentiers le mènent.
  assert.equal(actif(await mesAvatars(HABITUE)), 'Légendaires')
  assert.equal(actif(await mesAvatars({ ...HABITUE, legendaire: 'dv:seraphin' })), 'Légendaires')
  assert.equal(actif(await mesAvatars({ ...HABITUE, legendaire: null, avatar: '🐝' })), 'Emojis')
  assert.equal(actif(await mesAvatars({ ...HABITUE, legendaire: null })), 'Branches')
  // Chaque partie a son titre et son compte : cinq paliers de la forêt, deux des mythologies.
  const savant = { ...HABITUE, sentiers: { foret: 5, mythes: 2 } }
  const titres = async (famille: string) =>
    [...(await mesAvatars(savant, famille)).matchAll(/<h4 class="famille-titre">([^<]*)<span class="famille-compte">([^<]*)<\/span><\/h4>/g)].map(m => [
      m[1].trim(),
      m[2],
    ])
  assert.deepEqual(await titres('branches'), [['Les portraits des branches', '3 / 72']])
  assert.deepEqual(await titres('emojis'), [
    ['Les emojis', '24'],
    ['De collection', '10 / 12'],
  ])
  // Vingt-six légendaires et six Divins depuis les récompenses du quiz du jour et de la campagne (le 5 octobre 2026).
  assert.deepEqual(await titres('legendaires'), [
    ['Les légendaires', '2 / 26'],
    ['Les Divins', '1 / 6'],
  ])
})

test('dans « Mon avatar », seulement ceux qu’il a : ni case fermée, ni branche sans portrait, ni Divin pas encore descendu', async () => {
  // On y vient pour en changer : cent cases fermées noyaient les quarante
  // qu'on peut porter. Ce qui reste, et où, se lit dans « Ma collection ».
  const aMoi = (profil: object, familleInitiale: string) =>
    rendu('components/Apparence', 'MesAvatars', { profil, busy: false, enregistrer: () => {}, familleInitiale, aMoi: true })
  const savant = { ...HABITUE, sentiers: { foret: 5, mythes: 2 } }
  for (const famille of FAMILLES) {
    const html = await aMoi(savant, famille)
    assert.doesNotMatch(html, /case-avatar[^"]* ferme/, famille)
    assert.match(html, /<span class="muted small titre-compte">\d+ à toi<\/span>/, famille)
  }
  // Les branches où il a un portrait — la forêt dépliée, les mythologies sur
  // leur ligne —, et dans chacune ceux qu'il a gagnés.
  const branches = await aMoi(savant, 'branches')
  assert.equal([...branches.matchAll(/class="ligne-branche"/g)].length, 1)
  assert.deepEqual(
    [...branches.matchAll(/class="emoji-btn case-avatar case-portrait[^"]*"[^>]*aria-label="([^"]*)"/g)].map(m => m[1]),
    ['L’écureuil, gagné', 'Le blaireau, gagné'],
  )
  // Ses deux légendaires et son Divin.
  const legendaires = await aMoi(savant, 'legendaires')
  assert.equal([...legendaires.matchAll(/class="emoji-btn case-avatar anneau-legendaire/g)].length, 2)
  assert.equal([...legendaires.matchAll(/class="emoji-btn case-avatar anneau-divin/g)].length, 1)
  // Les dix emojis de collection du niveau 14, pas les deux d'après.
  assert.equal([...(await aMoi(savant, 'emojis')).matchAll(/aria-label="Avatar [^"]*, de collection/g)].length, 10)
  // Rien encore : il le dit, sans titre vide — ni Divins, ni emojis de collection.
  const debutant = { ...HABITUE, legendaire: null, legendaires: [], divins: [], niveau: 1 }
  const vide = await aMoi(debutant, 'legendaires')
  assert.match(vide, /Aucun encore : chacun se réveille par un exploit/)
  assert.doesNotMatch(vide, /Les Divins/)
  assert.doesNotMatch(await aMoi(debutant, 'emojis'), /De collection/)
  // Il s'ouvre sur ce qu'il porte : sous un emoji de l'inscription, ses emojis — pas des branches vides.
  const actif = (html: string) => /<button[^>]*role="tab" aria-selected="true"[^>]*>([^<]*)/.exec(html)?.[1]
  const ouvert = (profil: object) => rendu('components/Apparence', 'MesAvatars', { profil, busy: false, enregistrer: () => {}, aMoi: true })
  assert.equal(actif(await ouvert(debutant)), 'Emojis')
  assert.equal(actif(await ouvert({ ...savant, legendaire: 'br:blaireau' })), 'Branches')
  assert.equal(actif(await ouvert(savant)), 'Légendaires')
})

test('l’onglet des branches : une dépliée — celle du portrait porté —, les autres sur une ligne qui dit ce qui vient', async () => {
  const savant = { ...HABITUE, legendaire: 'br:blaireau', sentiers: { foret: 5, mythes: 2 } }
  const html = await mesAvatars(savant)
  // Douze branches : la forêt dépliée, onze lignes à toucher.
  assert.equal([...html.matchAll(/class="rayon"/g)].length, 1)
  assert.equal([...html.matchAll(/class="ligne-branche"/g)].length, 11)
  assert.match(html, /<b>La forêt<\/b><span class="detail-famille muted">Nature<\/span><span class="ligne-branche-compte">2 \/ 6<\/span>/)
  assert.match(html, /<p class="muted small">Encore 1 palier du sentier pour le lynx\.<\/p>/)
  // Une ligne tient sur deux : sa catégorie, et ce qui manque. Le lecteur
  // d'écran entend la phrase entière, le prochain portrait nommé.
  assert.match(html, /aria-label="Les mythologies, 1 \/ 6\. Encore 2 paliers du sentier pour la Gorgone\."/)
  assert.match(html, /<span class="muted small">Histoire · encore 2 paliers<\/span>/)
  assert.match(html, /<span class="muted small">Culture générale · encore 2 paliers<\/span>/)
  // Ses six cases : deux gagnées, dont celle qu'il porte ; quatre à gagner, avec leur palier.
  const cases = [...html.matchAll(/<button[^>]*class="(emoji-btn case-avatar case-portrait[^"]*)"[^>]*aria-label="([^"]*)"/g)].map(m => [m[1], m[2]])
  assert.deepEqual(
    cases.map(([, nom]) => nom),
    [
      'L’écureuil, gagné',
      'Le blaireau, porté',
      'Le lynx, au palier 6',
      'Le loup, au palier 8',
      'L’ours, au palier 10',
      'Le cerf, au palier 12',
    ],
  )
  assert.ok(cases[1][0].includes('selected') && cases[2][0].includes('ferme'))
  // Sans un palier encore, c'est la première branche qui se déplie.
  assert.match(await mesAvatars({ ...HABITUE, legendaire: null }), /<div class="rayon"><div class="rayon-tete"><b>Le tour du monde<\/b>/)
})

test('la fiche d’un portrait dit le palier qui l’ouvre, et combien il en manque ; gagné, il se porte d’ici', async () => {
  const portes: (string | null)[] = []
  const communs = { paliers: { foret: 5 }, eclat: false, busy: false, onPorter: (k: string | null) => portes.push(k) }
  const blaireau = await rendu('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:blaireau', porte: 'lg:phenix' })
  assert.match(blaireau, /<span class="detail-famille muted">La forêt · Nature<\/span><b class="galerie-detail-nom">Le blaireau<\/b>/)
  assert.match(blaireau, /Gagné au palier 4 du sentier de la forêt\./)
  assert.match(blaireau, /Il remplacera Le Phénix, que tu gardes\.<\/p><button[^>]*>Le porter</)
  const lynx = await rendu('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:lynx', porte: null })
  assert.match(lynx, /Se gagne au palier 6 du sentier de la forêt : <b>encore 1 palier<\/b>, dans la campagne\./)
  // À gagner : rien à porter, le chemin du sentier.
  assert.doesNotMatch(lynx, /<button/, 'à gagner : rien à porter')
  assert.match(lynx, /<a class="btn btn-small" href="\/campagne#sentier-foret">Aller au sentier<\/a>/)
  const loup = await rendu('components/Apparence', 'DetailPortrait', { ...communs, paliers: { foret: 8 }, cle: 'br:loup', porte: 'br:loup' })
  assert.match(loup, /Gagné au palier 8/)
  assert.match(loup, />Revenir à mon emoji</)

  const fiche = await arbre('components/Apparence', 'DetailPortrait', { ...communs, cle: 'br:blaireau', porte: null })
  const bouton = elements(fiche).find(e => e.type === 'button')
  assert.equal(portes.length, 0, 'rien avant le bouton')
  bouton.props.onClick()
  assert.deepEqual(portes, ['br:blaireau'])
})

test('touché, un légendaire ou un Divin se montre en grand en tête de sa fiche, le reflet sous le doigt', async () => {
  // À 30 px dans sa case, on ne voyait ni la peinture ni la pellicule, quand
  // l'emoji s'écrit en grand dans sa fiche et que le portrait l'est déjà
  // dans sa branche.
  const composant = source('components/Apparence.tsx')
  const debut = composant.indexOf('const fiche = ')
  const corps = composant.slice(debut, composant.indexOf('return (', debut))
  // Gagné ou non, éclaté ou non, en grand : ses grands fichiers, et le reflet qui suit le doigt.
  assert.match(corps, /dessin=\{<Legendaire cle=\{cle\} verrouille=\{!profil\.legendaires\.includes\(cle\)\} eclat=\{brille\(cle\)\} grand \/>\}/)
  assert.match(corps, /dessin=\{<Divin cle=\{cle\} verrouille=\{!descendu\(cle\)\} grand \/>\}/)

  // La fiche le pose en tête, muet : son nom et son état se lisent juste dessous.
  const { Legendaire } = await import(url('components/Legendaire.tsx'))
  const { Divin } = await import(url('components/Divin.tsx'))
  const communs = { eclats: [], porte: null, hautsFaits: [], busy: false, onPorter: () => {} }
  const dragon = await rendu('components/Carriere', 'DetailLegendaire', {
    ...communs,
    cle: 'lg:dragon',
    debloques: ['lg:dragon'],
    dessin: React.createElement(Legendaire, { cle: 'lg:dragon', grand: true }),
  })
  assert.match(dragon, /<div class="galerie-detail detail-case"><span class="detail-dessin" aria-hidden="true"><span class="lg lg-eclat lg-dragon lg-touche-libre"/)
  assert.match(dragon, /dragon-art-512\./, 'ses grands fichiers')
  assert.ok(dragon.indexOf('detail-dessin') < dragon.indexOf('galerie-detail-nom'), 'le médaillon, puis son nom')
  // Sans dessin — une page qui n'a pas les médaillons —, la fiche reste du texte.
  assert.doesNotMatch(await rendu('components/Carriere', 'DetailLegendaire', { ...communs, cle: 'lg:dragon', debloques: [] }), /detail-dessin/)

  const seraphin = await rendu('components/Carriere', 'DetailDivin', {
    ...communs,
    cle: 'dv:seraphin',
    descendus: HABITUE.divins,
    dessin: React.createElement(Divin, { cle: 'dv:seraphin', grand: true }),
  })
  assert.match(seraphin, /<span class="detail-dessin" aria-hidden="true"><span class="dv dv-seraphin dv-peint"/)
  assert.match(seraphin, /seraphin-badge-512\./)
  // Pas encore descendu : son voile en grand, et toujours rien de lui.
  const inconnu = await rendu('components/Carriere', 'DetailDivin', {
    ...communs,
    cle: 'dv:lotus',
    descendus: HABITUE.divins,
    dessin: React.createElement(Divin, { cle: 'dv:lotus', verrouille: true, grand: true }),
  })
  assert.match(inconnu, /<span class="detail-dessin" aria-hidden="true"><svg class="dv dv-lotus dv-voile"/)
  assert.doesNotMatch(inconnu, /Lotus|badge|medaillons/)

  // Centré, grand, et de l'air autour pour ce qui déborde.
  const cadre = regle('.detail-dessin')
  assert.match(cadre, /align-self:\s*center/)
  const taille = /font-size:\s*([\d.]+)rem/.exec(cadre)
  assert.ok(taille && Number(taille[1]) >= 8, `en grand : ${taille?.[0]}`)
})

test('un avatar éclaté se porte dans sa version rare ou d’origine, d’un toucher dans sa fiche', async () => {
  // Il peut ne pas vouloir de la version rare : il la garde, et porte l'autre.
  const choix: boolean[] = []
  const html = (brille: boolean) =>
    rendu('components/Carriere', 'ChoixDeLEclat', { brille, busy: false, onChoisir: (b: boolean) => choix.push(b) })
  const rare = await html(true)
  assert.match(rare, /Il a éclaté : tu portes sa version rare/)
  assert.match(rare, /<div class="choix-eclat" role="group" aria-label="Sa version"><button[^>]*aria-pressed="true"[^>]*>Version rare<\/button><button[^>]*aria-pressed="false"[^>]*>Version d’origine</)
  assert.match(await html(false), /Il a éclaté : sa version rare est à toi, et tu portes pour l’instant sa version d’origine\./)

  // Le bouton de la version portée ne refait rien ; l'autre la change.
  const arbreDuChoix = await arbre('components/Carriere', 'ChoixDeLEclat', { brille: true, busy: false, onChoisir: (b: boolean) => choix.push(b) })
  const [versionRare, versionDOrigine] = elements(arbreDuChoix).filter(e => e.type === 'button')
  versionRare.props.onClick()
  assert.deepEqual(choix, [], 'déjà portée')
  versionDOrigine.props.onClick()
  assert.deepEqual(choix, [false])
  // Sans enregistrement possible, la phrase seule.
  assert.doesNotMatch(await rendu('components/Carriere', 'ChoixDeLEclat', { brille: true, busy: false }), /<button/)

  // Les trois fiches qui peuvent éclater le proposent — jamais un Divin, qui n'éclate pas.
  const composant = source('components/Apparence.tsx')
  const debut = composant.indexOf('const fiche = ')
  const corps = composant.slice(debut, composant.indexOf('return (', debut))
  assert.equal(corps.split('onEclat={choisirEclat(cle)}').length - 1, 3)
  assert.match(composant, /const choisirEclat = \(cle: string\) => \(b: boolean\) => enregistrer\(\{ eclat: \{ cle, brille: b \} \}\)/)
  // La grille et les fiches montrent la version qu'il porte.
  assert.match(composant, /const brille = \(cle: string\) => brilleChez\(profil, cle\)/)
  const legendaire = await rendu('components/Carriere', 'DetailLegendaire', {
    cle: 'lg:phenix',
    debloques: ['lg:phenix'],
    eclats: ['lg:phenix'],
    eteints: ['lg:phenix'],
    porte: null,
    hautsFaits: [],
    busy: false,
    onPorter: () => {},
    onEclat: () => {},
  })
  assert.match(legendaire, /tu portes pour l’instant sa version d’origine/)

  // Ce qui brille : éclaté, et pas éteint — un serveur d'avant n'en dit rien, et tout brille.
  const { brilleChez } = await import('../../shared/profil')
  assert.equal(brilleChez({ eclats: ['🦊'] }, '🦊'), true)
  assert.equal(brilleChez({ eclats: ['🦊'], eclatsEteints: ['🦊'] }, '🦊'), false)
  assert.equal(brilleChez({ eclats: [], eclatsEteints: ['🦊'] }, '🦊'), false)
  // Et le lecteur d'écran entend ce qui a changé.
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ eclat: { cle: '🦊', brille: false } }), 'Tu portes sa version d’origine.')
  assert.equal(annonceDuChoix({ eclat: { cle: '🦊', brille: true } }), 'Tu portes sa version rare.')
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
  // Une seule fiche, celle qui suit sa case : plus rien sous les grilles.
  assert.equal(corps.split('id="detail-avatar"').length - 1, 1)
  // La page défile juste ce qu'il faut pour la montrer entière, et le focus va à son nom.
  assert.match(corps, /scrollIntoView\(\{ block: 'nearest'/)
  // Et la case touchée reste au-dessus quand les deux tiennent à l'écran : la
  // fiche refermée plus haut faisait remonter la case hors de la vue, et
  // celle d'un légendaire, qui le montre en grand, est haute.
  assert.match(corps, /const laCase = fiche\.previousElementSibling/)
  assert.match(corps, /if \(laCase && haut < 0 && bas - haut <= window\.innerHeight\)/)
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

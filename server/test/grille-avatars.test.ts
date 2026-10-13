// La grille des avatars de la loge : la maquette 1 validée le 12 octobre 2026.
// Trois pastilles qui comptent — ses légendaires, ses portraits, ses emojis —,
// puis la grille de ce qu'il a : un toucher essaie l'avatar — la carte de la
// loge le montre, la case a son halo d'or —, celui qu'il porte garde sa
// coche, et « Porter », dans la barre de la loge, le garde. Des cadenas
// finissent la rangée de ce qui reste ; d'où il vient, et comment gagner les
// autres, se lit dans « Ma collection ».
//
// Avant elle, la même grille répondait de deux façons — un emoji se portait
// d'un toucher, un avatar dessiné ouvrait sa légende —, puis chaque case
// ouvrait une fiche sous sa rangée, derrière trois onglets à titres et
// l'accordéon des branches : on lisait des titres et des lignes avant de voir
// un avatar (« pas reprendre ce qu'on a déjà », le propriétaire). Les fiches
// vivent dans l'album de « Ma collection » (`AlbumDesAvatars`), qui ne fait
// que montrer.
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

/** Un habitué : le Phénix porté, la grenouille dessous, un second légendaire, un Divin, niveau 14, trois portraits. */
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
  sentiers: { foret: 5, mythes: 2 },
}

/** Le premier jour : niveau 1, rien de dessiné. */
const DEBUTANT = { ...HABITUE, legendaire: null, legendaires: [], divins: [], niveau: 1, sentiers: {}, eclats: [] }

const FAMILLES = ['legendaires', 'portraits', 'emojis'] as const

/** Ce que reçoit une pièce de la loge : rien d'essayé. */
const loge = { essai: {}, essayer: () => {}, busy: false }

/** Les cases d'une grille rendue : leurs classes, leur nom, si elles sont pressées. */
const casesDe = (html: string) =>
  [...html.matchAll(/<button type="button" class="loge-case case-avatar([^"]*)" aria-pressed="(true|false)" aria-label="([^"]*)"/g)].map(m => ({
    classes: m[1].trim().split(/\s+/).filter(Boolean),
    presse: m[2] === 'true',
    nom: m[3],
  }))

/** Une famille de la grille, rendue. */
const famille = (f: string, profil: object = HABITUE, essai: object = {}) => rendu('components/Apparence', 'FamilleDAvatars', { profil, ...loge, essai, famille: f })

test('dans chaque famille, chaque case essaie son avatar : rien ne se porte ni ne s’enregistre d’un toucher, aucune fiche ne s’ouvre', async () => {
  const essais: object[] = []
  const vus: Record<string, object[]> = {}
  for (const f of FAMILLES) {
    essais.length = 0
    const boutons = elements(await arbre('components/Apparence', 'FamilleDAvatars', { profil: HABITUE, ...loge, essayer: (p: object) => essais.push(p), famille: f })).filter(
      e => e.type === 'button',
    )
    for (const b of boutons) {
      // Une case, pressée si la carte la montre — pas un bouton qui déplie une fiche.
      assert.match(b.props.className, /^loge-case case-avatar/, f)
      assert.equal(typeof b.props['aria-pressed'], 'boolean', f)
      assert.equal(b.props['aria-expanded'], undefined, f)
      assert.equal(b.props['aria-controls'], undefined, f)
      b.props.onClick()
    }
    vus[f] = [...essais]
  }
  // Ses deux légendaires et son Divin ; ses trois portraits, rangés comme le catalogue ; vingt-quatre emojis et les dix de collection du niveau 14.
  assert.deepEqual(vus.legendaires, [{ legendaire: 'lg:phenix' }, { legendaire: 'lg:dragon' }, { legendaire: 'dv:seraphin' }])
  assert.deepEqual(vus.portraits, [{ legendaire: 'br:minotaure' }, { legendaire: 'br:ecureuil' }, { legendaire: 'br:blaireau' }])
  assert.equal(vus.emojis.length, 34)
  assert.ok(vus.emojis.every(e => Object.keys(e).join() === 'avatar'), 'un emoji s’essaie, il ôte le légendaire')
  // Rien ne s'enregistre d'un toucher dans la grille, ni dans aucune pièce : pas même la version d'un avatar éclaté.
  const APPARENCE = source('components/Apparence.tsx')
  assert.doesNotMatch(APPARENCE, /\benregistrer\(|onPorter=|id="detail-avatar"|fiche-case/)
  // Les espaces de `espacesFines` devant les deux-points et le point d'interrogation : le chemin de ce qui reste — la page de l'album où ils sont.
  assert.match(await famille('legendaires'), /<a class="loge-a-gagner" href="#collection-avatars-legendaire">24 légendaires à gagner : où \?<svg/)
})

test('quatre pastilles, chacune son compte, ouvertes sur la famille de ce qu’il porte', async () => {
  const pastilles = (html: string) =>
    [...html.matchAll(/<button id="famille-(\w+)" type="button" role="tab" aria-selected="(true|false)"[^>]*>([^<]*)<span class="onglet-pastille" aria-hidden="true">(\d+)<\/span><span class="sr-only">, \4 à toi<\/span><\/button>/g)].map(m => [
      m[1],
      m[2],
      m[3],
      m[4],
    ])
  const mes = (profil: object) => rendu('components/Apparence', 'MesAvatars', { profil, ...loge })
  // Deux légendaires et un Divin, trois portraits, aucun compagnon, vingt-quatre emojis et dix de collection.
  assert.deepEqual(await pastilles(await mes(HABITUE)), [
    ['legendaires', 'true', 'Légendaires', '3'],
    ['portraits', 'false', 'Portraits', '3'],
    ['compagnons', 'false', 'Compagnons', '0'],
    ['emojis', 'false', 'Emojis', '34'],
  ])
  // Un seul arrêt de Tab — l'onglet choisi — et `aria-controls` ne vise que le panneau affiché.
  const html = await mes(HABITUE)
  assert.match(html, /<div class="onglets onglets-puces" role="tablist" aria-label="Familles d’avatars">/)
  assert.equal([...html.matchAll(/tabindex="0"/g)].length, 1)
  assert.equal([...html.matchAll(/aria-controls="famille-avatars"/g)].length, 1)
  assert.match(html, /<div class="famille-avatars" role="tabpanel" id="famille-avatars" aria-labelledby="famille-legendaires">/)
  // Sous le Phénix — ou un Divin —, les légendaires ; sous un portrait, les portraits ; sous un emoji, les emojis.
  const actif = async (profil: object) => (await pastilles(await mes(profil))).find(p => p[1] === 'true')?.[2]
  assert.equal(await actif(HABITUE), 'Légendaires')
  assert.equal(await actif({ ...HABITUE, legendaire: 'dv:seraphin' }), 'Légendaires')
  assert.equal(await actif({ ...HABITUE, legendaire: 'br:blaireau' }), 'Portraits')
  assert.equal(await actif({ ...HABITUE, legendaire: 'cp:loup-jeune', compagnons: [{ compagnon: 'loup', rang: 1 }] }), 'Compagnons')
  assert.equal(await actif({ ...HABITUE, legendaire: null, avatar: '🐝' }), 'Emojis')
  assert.equal(await actif(DEBUTANT), 'Emojis')
  // Le premier jour : zéro légendaire, zéro portrait, zéro compagnon — les pastilles disent qu'ils existent.
  assert.deepEqual((await pastilles(await mes(DEBUTANT))).map(p => p[3]), ['0', '0', '0', '24'])
  // Les onglets de toute l'application : les flèches passent à la voisine (`petit-ecran.test.ts`).
  assert.match(source('components/Apparence.tsx'), /<Onglets\s+onglets=\{FAMILLES\.map/)
})

test('seulement ce qu’il a : des cadenas finissent la rangée, et « N à gagner : où ? » mène à sa page de l’album de la collection', async () => {
  const { cadenas } = await import(url('components/Apparence.tsx'))
  // La dernière rangée, ou une rangée entière quand elle tombe juste — jamais plus que ce qui reste.
  assert.deepEqual([cadenas(0, 4, 26), cadenas(2, 4, 24), cadenas(4, 4, 22), cadenas(3, 4, 1), cadenas(5, 4, 0), cadenas(10, 5, 2)], [4, 2, 4, 1, 0, 2])
  const fermes = (html: string) => [...html.matchAll(/<span class="loge-case loge-ferme" aria-hidden="true"><svg[^>]*>.*?<\/svg>(?:<span class="loge-ferme-niveau">([^<]*)<\/span>)?<\/span>/g)].map(m => m[1] ?? '')

  // Les légendaires : les deux siens et deux cadenas ; son Divin sous son titre, sans cadenas — les Divins ne disent pas comment.
  const legendaires = await famille('legendaires')
  assert.equal(casesDe(legendaires).length, 3)
  assert.deepEqual(fermes(legendaires), ['', ''])
  assert.match(legendaires, /<p class="loge-grille-titre">Les Divins <span>1 \/ 6<\/span><\/p>/)
  assert.ok(legendaires.indexOf('loge-ferme') < legendaires.indexOf('Les Divins'), 'les cadenas finissent la rangée des légendaires')
  // Les portraits : trois, un cadenas, soixante-neuf à gagner sur les sentiers.
  const portraits = await famille('portraits')
  assert.deepEqual(casesDe(portraits).map(c => c.nom), ['Le Minotaure, portrait des mythologies', 'L’écureuil, portrait de la forêt', 'Le blaireau, portrait de la forêt'])
  assert.deepEqual(fermes(portraits), [''])
  // Le prochain portrait est un visage, d'une autre branche : la page commune de l'album.
  assert.match(portraits, /href="#collection-avatars-commune">69 portraits à gagner : où \?/)
  // Les emojis : les vingt-quatre de l'inscription, sans cadenas ; dix de collection, et les deux suivants disent leur niveau.
  const emojis = await famille('emojis')
  assert.equal(casesDe(emojis).length, 34)
  assert.match(emojis, /<p class="loge-grille-titre">De collection <span>10 \/ 12<\/span><\/p>/)
  assert.deepEqual(fermes(emojis), ['niv. 16', 'niv. 17'])
  assert.match(emojis, /href="#collection-avatars-peucommune">2 emojis de collection à gagner : où \?/)
  // Les cadenas sont du décor : ni bouton, ni lien — le lien dessous dit où.
  assert.doesNotMatch(emojis, /<(button|a)[^>]*loge-ferme/)
  // Les compagnons : le loup acheté et grandi d'une forme — ses deux formes se portent —, deux cadenas, dix à gagner.
  const compagnons = await famille('compagnons', { ...HABITUE, compagnons: [{ compagnon: 'loup', rang: 1 }] })
  assert.deepEqual(
    casesDe(compagnons).map(c => c.nom),
    ['Le louveteau, Le Loup, première forme', 'Le jeune loup, Le Loup, deuxième forme'],
  )
  assert.deepEqual(fermes(compagnons), ['', ''])
  assert.match(compagnons, /href="#collection-avatars-commune">10 formes de compagnons à gagner\s: où\s\?/)

  // Le premier jour : ce qui se gagne, et où — une rangée de cadenas dans chaque famille.
  const rien = await famille('legendaires', DEBUTANT)
  assert.match(rien, /Chacun se réveille par un exploit, en soirée, au quiz du jour ou en campagne\./)
  assert.deepEqual(fermes(rien), ['', '', '', ''])
  assert.doesNotMatch(rien, /Les Divins/)
  const sentiers = await famille('portraits', DEBUTANT)
  assert.match(sentiers, /Ils se gagnent sur les sentiers du savoir de la campagne : un portrait tous les deux paliers\. <a class="link-inline" href="\/campagne#sentiers">Les sentiers<\/a>/)
  assert.match(sentiers, /72 portraits à gagner/)
  const collection = await famille('emojis', DEBUTANT)
  assert.match(collection, /De collection <span>0 \/ 12<\/span>/)
  assert.deepEqual(fermes(collection), ['niv. 2', 'niv. 4', 'niv. 5', 'niv. 7', 'niv. 8'])
  const boutique = await famille('compagnons', DEBUTANT)
  assert.match(boutique, /Ils s’achètent à la boutique, puis grandissent avec les bonnes réponses que tu donnes en les portant\. <a class="link-inline" href="\/boutique#compagnons">La boutique<\/a>/)
  assert.deepEqual(fermes(boutique), ['', '', '', ''])
  assert.match(boutique, /12 formes de compagnons à gagner/)
})

test('la carte montre une case — son halo d’or —, celle qu’il porte garde sa coche, et rien ne bouge sous le doigt', async () => {
  // Rien d'essayé : le Phénix est montré et porté — pressé, sa coche, sans « porté » redit à l'oreille.
  const sansEssai = casesDe(await famille('legendaires'))
  assert.deepEqual(sansEssai.map(c => [c.nom, c.presse, c.classes.join(' ')]), [
    ['Le Phénix, légendaire', true, 'anneau-legendaire selected porte'],
    ['Le Dragon d’Or, légendaire', false, 'anneau-legendaire'],
    ['Le Séraphin, Divin', false, 'anneau-divin'],
  ])
  // Le Dragon essayé : son halo ; le Phénix garde sa coche, et l'oreille entend qu'il le porte toujours.
  const dragon = casesDe(await famille('legendaires', HABITUE, { legendaire: 'lg:dragon' }))
  assert.deepEqual(dragon.map(c => [c.nom, c.presse, c.classes.join(' ')]), [
    ['Le Phénix, légendaire, porté', false, 'anneau-legendaire porte'],
    ['Le Dragon d’Or, légendaire', true, 'anneau-legendaire selected essaye'],
    ['Le Séraphin, Divin', false, 'anneau-divin'],
  ])
  // Les mêmes cases, dans le même ordre : un essai ne change que leur état — rien ne part sous le doigt, ni le focus avec.
  const sansEtat = (cases: { nom: string }[]) => cases.map(c => c.nom.replace(/, porté$/, ''))
  assert.deepEqual(sansEtat(dragon), sansEtat(sansEssai))
  // Sous le Phénix, la grenouille n'est pas portée : c'est le Phénix que la salle voit. Essayée, elle le remplace sur la carte.
  const avant = casesDe(await famille('emojis')).find(c => c.nom === 'Avatar 🐸')!
  assert.deepEqual([avant.presse, avant.classes], [false, []])
  const apres = casesDe(await famille('emojis', HABITUE, { avatar: '🐸' })).find(c => c.nom === 'Avatar 🐸')!
  assert.deepEqual([apres.presse, apres.classes], [true, ['selected', 'essaye']])
  // Le halo d'or de l'essai, la coche de ce qu'il porte, le cadre de ce que la carte montre.
  assert.match(regle('.loge-case.essaye'), /box-shadow:/)
  assert.match(regle('.loge-case.selected'), /border: 2px solid var\(--accent\)/)
  assert.match(CSS, /\.case-avatar\.porte::after[^{]*\{ content: '✓';/)
})

/** La fiche d'un avatar dans l'album de « Ma collection », sans rien d'autre autour. */
async function ficheDeLAlbum(cle: string, plus: { aLui?: boolean; porte?: boolean; profil?: object; dessin?: unknown } = {}) {
  const { avatarDeLAlbum } = await import('../../shared/album')
  return rendu('components/AlbumDesAvatars', 'FicheDeLAvatar', { a: avatarDeLAlbum(cle), aLui: false, porte: false, profil: HABITUE, dessin: null, ...plus })
}

test('la fiche d’un portrait dit le palier qui l’ouvre, et où il en est ; à lui, où le porter — rien ne s’y porte', async () => {
  // Le blaireau, au palier 4 de la forêt : à lui. Il se porte dans la loge, pas d'ici.
  const blaireau = await ficheDeLAlbum('br:blaireau', { aLui: true })
  assert.match(blaireau, /<b class="galerie-detail-nom">Le blaireau<\/b><span class="album-detail-rarete"><i aria-hidden="true"><\/i>Peu commune<\/span>/)
  assert.match(blaireau, /<p class="muted small">La forêt · Nature<\/p>/)
  assert.match(blaireau, /À toi\. Il se porte dans <a class="link-inline" href="#avatar">« Mon avatar »<\/a>\./)
  assert.match(blaireau, /<span class="label album-etiquette">Comment il se gagne<\/span>/)
  // À lui, plus de jauge ni de chemin : il l'a.
  assert.doesNotMatch(blaireau, /<button|Le porter|album-progres|album-aller/)
  // Le lynx, au palier 6 : où il en est sur son sentier, et le chemin du sentier.
  const lynx = await ficheDeLAlbum('br:lynx')
  assert.match(lynx, /Sur les sentiers : le palier 6 du sentier de la forêt<\/b>/)
  assert.match(lynx, /<span class="album-progres"><span class="jauge-fine" aria-hidden="true"><span style="width:83%"><\/span><\/span><span>palier 5 sur 6<\/span><\/span>/)
  assert.doesNotMatch(lynx, /<button/, 'à gagner : rien à porter')
  assert.match(lynx, /<a class="btn btn-small album-aller" href="\/campagne#sentier-foret">Aller au sentier<\/a>/)
  // Le Loup, au palier 8 : à lui, et porté.
  const loup = await ficheDeLAlbum('br:loup', { aLui: true, porte: true, profil: { ...HABITUE, sentiers: { foret: 8 } } })
  assert.match(loup, /À toi, et tu le portes\./)
})

test('touché dans l’album, un légendaire ou un Divin se montre en grand en tête de sa fiche, le reflet sous le doigt', async () => {
  // À 30 px dans sa case, on ne voyait ni la peinture ni la pellicule. La
  // fiche vit dans la collection, qui raconte d'où il vient.
  const album = source('components/AlbumDesAvatars.tsx')
  // Gagné ou non, éclaté ou non, en grand : ses grands fichiers, et le reflet qui suit le doigt.
  assert.match(album, /<FicheDeLAvatar a=\{a\} aLui=\{aLui\} porte=\{lePorte\} profil=\{profil\} dessin=\{dessin\(a, aLui, true\)\} \/>/)
  assert.match(album, /<Legendaire cle=\{a\.cle\} verrouille=\{!aLui\} eclat=\{aLui && brille\(a\.cle\)\} grand=\{grand\} \/>/)
  assert.match(album, /<Divin cle=\{a\.cle\} verrouille=\{!aLui\} grand=\{grand\} \/>/)

  // La fiche le pose en tête, muet : son nom et son état se lisent juste dessous.
  const { Legendaire } = await import(url('components/Legendaire.tsx'))
  const { Divin } = await import(url('components/Divin.tsx'))
  const dragon = await ficheDeLAlbum('lg:dragon', { aLui: true, dessin: React.createElement(Legendaire, { cle: 'lg:dragon', grand: true }) })
  assert.match(dragon, /<div class="galerie-detail detail-case album-detail"[^>]*><div class="album-detail-tete"><span class="album-detail-dessin" aria-hidden="true"><span class="lg lg-eclat lg-dragon lg-touche-libre"/)
  assert.match(dragon, /dragon-art-512\./, 'ses grands fichiers')
  assert.ok(dragon.indexOf('album-detail-dessin') < dragon.indexOf('galerie-detail-nom'), 'le médaillon, puis son nom')
  // Sans dessin — une page qui n'a pas les médaillons —, la fiche reste du texte.
  assert.doesNotMatch(await ficheDeLAlbum('lg:dragon'), /album-detail-dessin/)

  const seraphin = await ficheDeLAlbum('dv:seraphin', { aLui: true, dessin: React.createElement(Divin, { cle: 'dv:seraphin', grand: true }) })
  assert.match(seraphin, /<span class="album-detail-dessin" aria-hidden="true"><span class="dv dv-seraphin dv-peint"/)
  assert.match(seraphin, /seraphin-badge-512\./)
  assert.match(seraphin, /<p class="serif-note">Il est descendu un soir de grand vent\.<\/p>/)
  // Pas encore descendu : son voile en grand, et toujours rien de lui.
  const inconnu = await ficheDeLAlbum('dv:lotus', { dessin: React.createElement(Divin, { cle: 'dv:lotus', verrouille: true, grand: true }) })
  assert.match(inconnu, /<span class="album-detail-dessin" aria-hidden="true"><svg class="dv dv-lotus dv-voile"/)
  assert.doesNotMatch(inconnu, /Lotus|badge|medaillons/)

  // Centré, grand, et de l'air autour pour ce qui déborde.
  assert.match(regle('.album-detail-tete'), /align-items:\s*center/)
  const taille = /font-size:\s*([\d.]+)rem/.exec(regle('.album-detail-dessin'))
  assert.ok(taille && Number(taille[1]) >= 8, `en grand : ${taille?.[0]}`)
  // La fiche s'ouvre juste sous sa case, de toute la largeur de sa grille : `dense` finit la rangée.
  assert.match(regle('.album-avatars'), /grid-auto-flow:\s*dense/)
  assert.match(regle('.fiche-case'), /grid-column:\s*1 \/ -1/)
})

test('un avatar éclaté s’essaie dans sa version rare ou d’origine, sur la carte de la loge, à côté de lui', async () => {
  // Il peut ne pas vouloir de la version rare : il la garde, et porte l'autre.
  // Dans « Ma collection », la fiche le dit — sans rien régler.
  const choix: boolean[] = []
  const html = (brille: boolean) => rendu('components/Carriere', 'ChoixDeLEclat', { brille, busy: false, onChoisir: (b: boolean) => choix.push(b) })
  const rare = await html(true)
  assert.match(rare, /Il a éclaté : tu portes sa version rare/)
  assert.match(rare, /<div class="choix-eclat" role="group" aria-label="Sa version"><button[^>]*aria-pressed="true"[^>]*>Version rare<\/button><button[^>]*aria-pressed="false"[^>]*>Version d’origine</)
  assert.match(await html(false), /Il a éclaté : sa version rare est à toi, et tu portes pour l’instant sa version d’origine\./)
  const arbreDuChoix = await arbre('components/Carriere', 'ChoixDeLEclat', { brille: true, busy: false, onChoisir: (b: boolean) => choix.push(b) })
  const [versionRare, versionDOrigine] = elements(arbreDuChoix).filter(e => e.type === 'button')
  versionRare.props.onClick()
  assert.deepEqual(choix, [], 'déjà portée')
  versionDOrigine.props.onClick()
  assert.deepEqual(choix, [false])
  assert.doesNotMatch(await rendu('components/Carriere', 'ChoixDeLEclat', { brille: true, busy: false }), /<button/)

  // Dans la loge, la version s'essaie comme le reste : la carte la montre, la barre la dit, « Porter » la garde.
  const { essayer, avecLEssai, lignesDeLEssai } = await import('../../shared/loge')
  const porte = { ...HABITUE, eclats: ['lg:phenix'], eclatsEteints: [], titre: null, vitrine: [], vitrineChoisie: null, titresDates: [], fond: null, fonds: [], theme: null, gerbe: null, gerbes: [] } as any
  const origine = essayer({}, { eclat: { cle: 'lg:phenix', brille: false } }, porte)
  assert.deepEqual(origine, { eclat: { cle: 'lg:phenix', brille: false } })
  assert.deepEqual(avecLEssai(porte, origine).eclatsEteints, ['lg:phenix'])
  assert.deepEqual(lignesDeLEssai(origine, porte), [{ piece: 'avatar', nom: 'Version d’origine', detail: 'Éclat' }])
  // Revenir à ce qu'il porte, c'est renoncer à l'essai ; un autre avatar essayé laisse la version de celui-ci.
  assert.deepEqual(essayer(origine, { eclat: { cle: 'lg:phenix', brille: true } }, porte), {})
  assert.deepEqual(essayer(origine, { legendaire: 'lg:dragon' }, porte), { legendaire: 'lg:dragon' })
  // Rien sous un Divin, qui n'éclate pas.
  const { cibleDeLEclat, avatarMontre } = await import('../../shared/loge')
  assert.equal(cibleDeLEclat(avatarMontre(porte, { legendaire: 'dv:seraphin' })), null)
  assert.equal(cibleDeLEclat(avatarMontre(porte, { avatar: '🦊' })), '🦊')

  // Sur la carte, à côté de lui : « Version rare », pressée quand c'est elle qu'on montre.
  const laLoge = (profil: object) => rendu('components/Loge', 'Loge', { profil: { ...porte, ...profil }, piece: 'avatar', onPiece: () => {}, busy: false, enregistrer: async () => true })
  assert.match(await laLoge({}), /<button type="button" class="loge-version" aria-pressed="true"><svg[^>]*>.*?<\/svg>Version rare<\/button>/)
  assert.match(await laLoge({ eclatsEteints: ['lg:phenix'] }), /class="loge-version" aria-pressed="false"/)
  // Ni sous un avatar qui n'a pas éclaté, ni sous un Divin.
  assert.doesNotMatch(await laLoge({ legendaire: 'lg:dragon' }), /loge-version/)
  assert.doesNotMatch(await laLoge({ legendaire: 'dv:seraphin', eclats: ['lg:phenix', '🐸'] }), /loge-version/)
  // Le geste vient de la loge, qui tient l'essai ; la carte, dans sa tête légère, ne fait que le poser sur le bouton.
  assert.match(source('components/Loge.tsx'), /version=\{rare !== null && cible \? \{ rare, essayee: !!essai\.eclat, basculer: \(\) => essayer\(\{ eclat: \{ cle: cible, brille: !rare \} \}\) \} : null\}/)
  assert.match(source('components/LogeTete.tsx'), /<button type="button" className=\{'loge-version' \+ \(version\.essayee \? ' loge-essaye' : ''\)\} aria-pressed=\{version\.rare\} onClick=\{version\.basculer\}>/)

  // Ce qui brille : éclaté, et pas éteint — un serveur d'avant n'en dit rien, et tout brille.
  const { brilleChez } = await import('../../shared/profil')
  assert.equal(brilleChez({ eclats: ['🦊'] }, '🦊'), true)
  assert.equal(brilleChez({ eclats: ['🦊'], eclatsEteints: ['🦊'] }, '🦊'), false)
  assert.equal(brilleChez({ eclats: [], eclatsEteints: ['🦊'] }, '🦊'), false)
  // La grille montre la version que la carte montrerait.
  assert.match(source('components/Apparence.tsx'), /const tenue = avecLEssai\(profil, essai\)\s*const brille = \(cle: string\) => brilleChez\(tenue, cle\)/)
  assert.match((await famille('emojis')), /aria-label="Avatar 🦊, éclaté"/)
  // Et le lecteur d'écran entend ce qui a changé.
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ eclat: { cle: '🦊', brille: false } }), 'Tu portes sa version d’origine.')
  assert.equal(annonceDuChoix({ eclat: { cle: '🦊', brille: true } }), 'Tu portes sa version rare.')
})

test('un emoji de collection dit son niveau, à l’oreille et dans la barre de la loge', async () => {
  const cases = casesDe(await famille('emojis'))
  const abeille = cases.find(c => c.nom.startsWith('Avatar 🐝'))!
  assert.equal(abeille.nom, 'Avatar 🐝, de collection · niveau 8')
  assert.ok(abeille.classes.includes('anneau-collection'))
  assert.ok(cases.find(c => c.nom.startsWith('Avatar 🐳'))!.classes.includes('anneau-collection-haut'), 'au-delà du niveau 10, son anneau bleu')
  const { lignesDeLEssai } = await import('../../shared/loge')
  assert.deepEqual(lignesDeLEssai({ avatar: '🐝' }, HABITUE), [{ piece: 'avatar', nom: '🐝', detail: 'De collection · niveau 8' }])
  assert.deepEqual(lignesDeLEssai({ avatar: '🦊' }, HABITUE), [{ piece: 'avatar', nom: '🦊', detail: 'Emoji' }])
})

test('dans l’album, la fiche d’un avatar à lui dit qu’il l’a, et s’il le porte — en changer se fait dans la loge, qui l’essaie d’abord', async () => {
  // « Le porter » vivait dans les fiches, et disait ce qu'il remplaçait : la
  // loge essaie désormais sur la carte, et sa barre le dit. L'album ne fait
  // que montrer, légendaire, Divin, portrait ou emoji.
  const dragon = await ficheDeLAlbum('lg:dragon', { aLui: true })
  assert.match(dragon, /À toi\. Il se porte dans <a class="link-inline" href="#avatar">« Mon avatar »<\/a>\./)
  assert.match(await ficheDeLAlbum('lg:phenix', { aLui: true, porte: true }), /À toi, et tu le portes\./)
  assert.match(await ficheDeLAlbum('dv:seraphin', { aLui: true }), /À toi\./)
  const aGagner = await ficheDeLAlbum('lg:oracle')
  assert.doesNotMatch(aGagner, /À toi/)
  for (const html of [dragon, aGagner]) assert.doesNotMatch(html, /<button|Le porter|Il remplacera|Revenir à mon emoji/)
  assert.doesNotMatch(source('components/AlbumDesAvatars.tsx'), /enregistrer|onPorter|onEclat/)
})

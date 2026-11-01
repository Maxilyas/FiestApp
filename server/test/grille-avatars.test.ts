// La grille des avatars de la loge : la maquette 1 validée le 12 octobre 2026,
// rangée le lendemain comme l'album de « Ma collection » — les gemmes des
// raretés, au lieu de quatre familles (légendaires, portraits, compagnons,
// emojis) : on ne s'y retrouvait pas d'un écran à l'autre. Les offerts, puis
// chaque rareté où il a quelque chose, chacune son compte ; dessous, la grille
// de ce qu'il a : un toucher essaie l'avatar — la carte de la loge le montre,
// la case a son halo d'or —, celui qu'il porte garde sa coche, et « Porter »,
// dans la barre de la loge, le garde. Ni cadenas ni fantômes : ce qui reste se
// compte sous la grille, et mène à sa page de l'album, qui dit d'où il vient.
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

/** Ce que reçoit une pièce de la loge : rien d'essayé. */
const loge = { essai: {}, essayer: () => {}, busy: false }

/** Les pages de sa grille, telles que la loge les range. */
async function sesPages(profil: object = HABITUE): Promise<{ page: string; cles: readonly string[]; reste: number }[]> {
  const { pagesDeLaLoge } = await import(url('components/Apparence.tsx'))
  return pagesDeLaLoge(profil)
}

/** Une page de sa grille : ses cases et ce qui reste. */
async function laPage(nom: string, profil: object = HABITUE) {
  const page = (await sesPages(profil)).find(p => p.page === nom)
  assert.ok(page, `la page ${nom}`)
  return page
}

/** Les cases d'une grille rendue : leurs classes, leur nom, si elles sont pressées. */
const casesDe = (html: string) =>
  [...html.matchAll(/<button type="button" class="loge-case case-avatar([^"]*)" aria-pressed="(true|false)" aria-label="([^"]*)"/g)].map(m => ({
    classes: m[1].trim().split(/\s+/).filter(Boolean),
    presse: m[2] === 'true',
    nom: m[3],
  }))

/** Une page de la grille, rendue. */
const page = async (nom: string, profil: object = HABITUE, essai: object = {}) =>
  rendu('components/Apparence', 'PageDAvatars', { profil, ...loge, essai, page: await laPage(nom, profil) })

test('dans chaque page, chaque case essaie son avatar : rien ne se porte ni ne s’enregistre d’un toucher, aucune fiche ne s’ouvre', async () => {
  const essais: object[] = []
  const vus: Record<string, object[]> = {}
  for (const p of await sesPages()) {
    essais.length = 0
    const boutons = elements(await arbre('components/Apparence', 'PageDAvatars', { profil: HABITUE, ...loge, essayer: (x: object) => essais.push(x), page: p })).filter(
      e => e.type === 'button',
    )
    for (const b of boutons) {
      // Une case, pressée si la carte la montre — pas un bouton qui déplie une fiche.
      assert.match(b.props.className, /^loge-case case-avatar/, p.page)
      assert.equal(typeof b.props['aria-pressed'], 'boolean', p.page)
      assert.equal(b.props['aria-expanded'], undefined, p.page)
      assert.equal(b.props['aria-controls'], undefined, p.page)
      b.props.onClick()
    }
    vus[p.page] = [...essais]
  }
  // Les pages de l'album où il a quelque chose, après les offerts : ni rare ni épique, il n'en a pas.
  assert.deepEqual(Object.keys(vus), ['offert', 'commune', 'peucommune', 'legendaire', 'divin'])
  // Ses deux légendaires, son Divin à part ; ses portraits à la rareté de leur rang — le visage commun, le deuxième peu commun.
  assert.deepEqual(vus.legendaire, [{ legendaire: 'lg:phenix' }, { legendaire: 'lg:dragon' }])
  assert.deepEqual(vus.divin, [{ legendaire: 'dv:seraphin' }])
  assert.deepEqual(
    vus.commune.filter(e => 'legendaire' in e),
    [{ legendaire: 'br:minotaure' }, { legendaire: 'br:ecureuil' }],
  )
  assert.deepEqual(
    vus.peucommune.filter(e => 'legendaire' in e),
    [{ legendaire: 'br:blaireau' }],
  )
  // Les vingt-quatre de l'inscription, et les dix de collection du niveau 14 à la rareté de leur niveau.
  assert.equal(vus.offert.length, 24)
  assert.equal([...vus.commune, ...vus.peucommune].filter(e => 'avatar' in e).length, 10)
  assert.ok(
    [...vus.offert, ...vus.commune, ...vus.peucommune].filter(e => 'avatar' in e).every(e => Object.keys(e).join() === 'avatar'),
    'un emoji s’essaie, il ôte le légendaire',
  )
  // Rien ne s'enregistre d'un toucher dans la grille, ni dans aucune pièce : pas même la version d'un avatar éclaté.
  const APPARENCE = source('components/Apparence.tsx')
  assert.doesNotMatch(APPARENCE, /\benregistrer\(|onPorter=|id="detail-avatar"|fiche-case/)
  // Les espaces de `espacesFines` devant les deux-points et le point d'interrogation : le chemin de ce qui reste — sa page de l'album.
  // La luciole-constellation et sa luciole-aurore comprises (le 20 octobre 2026), les cinq légendaires des fêtes de 2027 aussi (le 1er novembre),
  // et le Djinn des défis du Cabinet, le même jour.
  assert.match(await page('legendaire'), /<a class="loge-a-gagner" href="#collection-avatars-legendaire">52 avatars légendaires à gagner\s:\soù\s\?<svg/)
})

test('les gemmes de l’album : les offerts, puis chaque rareté où il a quelque chose, chacune son compte, ouvertes sur la page de ce qu’il porte', async () => {
  const gemmes = (html: string) =>
    [...html.matchAll(/<button id="loge-gemme-(\w+)" type="button" role="tab" aria-selected="(true|false)"[^>]*aria-label="([^"]+)"[^>]*>.*?<span aria-hidden="true">([^<]*)<\/span><b aria-hidden="true">(\d+)<\/b><\/button>/g)].map(m => [
      m[1],
      m[2],
      m[3],
      m[4],
      m[5],
    ])
  const mes = (profil: object) => rendu('components/Apparence', 'MesAvatars', { profil, ...loge })
  // Vingt-quatre offerts ; des communs et des peu communs — portraits et emojis de collection ; deux légendaires ; un Divin.
  assert.deepEqual(await gemmes(await mes(HABITUE)), [
    ['offert', 'false', 'Offerts à tous, 24 à toi', 'Offerts', '24'],
    ['commune', 'false', 'Commune, 8 à toi', 'Commune', '8'],
    ['peucommune', 'false', 'Peu commune, 5 à toi', 'Peu com.', '5'],
    ['legendaire', 'true', 'Légendaire, 2 à toi', 'Légend.', '2'],
    ['divin', 'false', 'Divin, 1 à toi', 'Divin', '1'],
  ])
  // Un seul arrêt de Tab — la gemme choisie — et `aria-controls` ne vise que le panneau affiché.
  const html = await mes(HABITUE)
  assert.match(html, /<div class="gemmes gemmes-loge" role="tablist" aria-label="Mes avatars, par rareté">/)
  assert.equal([...html.matchAll(/tabindex="0"/g)].length, 1)
  assert.equal([...html.matchAll(/aria-controls="loge-page-avatars"/g)].length, 1)
  assert.match(html, /<div class="loge-page-avatars" role="tabpanel" id="loge-page-avatars" aria-labelledby="loge-gemme-legendaire">/)
  // La page de ce qu'il porte : le Phénix, légendaire ; un Divin, la sienne ; un portrait, sa rareté ; un compagnon, celle de sa forme ; un emoji, la sienne.
  const choisie = async (profil: object) => (await gemmes(await mes(profil))).find(g => g[1] === 'true')?.[0]
  assert.equal(await choisie(HABITUE), 'legendaire')
  assert.equal(await choisie({ ...HABITUE, legendaire: 'dv:seraphin' }), 'divin')
  assert.equal(await choisie({ ...HABITUE, legendaire: 'br:blaireau' }), 'peucommune')
  assert.equal(await choisie({ ...HABITUE, legendaire: 'cp:loup-jeune', compagnons: [{ compagnon: 'loup', rang: 1 }] }), 'rare')
  assert.equal(await choisie({ ...HABITUE, legendaire: null, avatar: '🐝' }), 'commune')
  assert.equal(await choisie({ ...HABITUE, legendaire: null, avatar: '🐸' }), 'offert')
  assert.equal(await choisie(DEBUTANT), 'offert')
  // Le premier jour : les offerts seuls — pas de gemme vide pour dire ce qui existe, l'album le dit.
  assert.deepEqual((await gemmes(await mes(DEBUTANT))).map(g => g[0]), ['offert'])
  // Les gemmes de l'album, les mêmes, et ses noms courts : on passe de l'un à l'autre sans réapprendre (`petit-ecran.test.ts` : les flèches).
  assert.match(source('components/Apparence.tsx'), /<Gemmes\s/)
  assert.match(source('components/AlbumDesAvatars.tsx'), /<Gemmes\s/)
  // Une rangée jusqu'à cinq, deux au-delà — et une règle plus précise que `.gemmes`, posée plus bas : à classe seule, la sienne l'emportait.
  assert.match(CSS, /\.gemmes\.gemmes-loge \{ grid-template-columns: none; grid-auto-flow: column;/)
  assert.match(CSS, /\.gemmes\.gemmes-loge:has\(> :nth-child\(6\)\) \{ grid-auto-flow: row; grid-template-columns: repeat\(3,/)
  assert.match(CSS, /\.gemmes\.gemmes-loge:has\(> :nth-child\(7\)\) \{ grid-template-columns: repeat\(4,/)
  assert.doesNotMatch(CSS, /^\.gemmes-loge \{/m)
})

test('seulement ce qu’il a : ni cadenas ni fantômes — ce qui reste se compte sous la grille, et mène à sa page de l’album', async () => {
  // Les cadenas rayés qui finissaient chaque rangée sont partis avec les
  // familles (le 13 octobre 2026) : la loge ne montre que ce qu'il a.
  const { cadenas } = await import(url('components/Apparence.tsx'))
  assert.equal(cadenas, undefined)
  for (const p of await sesPages()) assert.doesNotMatch(await page(p.page), /loge-ferme|niv\. \d/, p.page)
  assert.doesNotMatch(CSS, /\.loge-ferme/)
  // Les communs : ses deux visages, puis ses emojis de collection des premiers niveaux, chacun à sa place du catalogue.
  const commune = await page('commune')
  assert.deepEqual(casesDe(commune).map(c => c.nom), [
    'Le Minotaure, portrait des mythologies',
    'L’écureuil, portrait de la forêt',
    'Avatar 🦚, de collection · niveau 2',
    'Avatar 🐢, de collection · niveau 4',
    'Avatar 🦈, de collection · niveau 5',
    'Avatar 🦔, de collection · niveau 7',
    'Avatar 🐝, de collection · niveau 8',
    'Avatar 🦩, de collection · niveau 9',
  ])
  // Ce qui reste sur sa page de l'album, compté, et son chemin — les espaces fines de `espacesFines` comprises —, les formes de la luciole avec.
  assert.match(commune, /href="#collection-avatars-commune">15 avatars communs à gagner\s:\soù\s\?/)
  assert.match(await page('peucommune'), /href="#collection-avatars-peucommune">23 avatars peu communs à gagner\s:\soù\s\?/)
  // Les offerts mènent à tout l'album : ce qui reste de toutes ses pages.
  assert.match(await page('offert'), /href="#collection-avatars">141 avatars à gagner\s:\soù\s\?/)
  // Un Divin ne dit pas comment : rien à compter sous sa page (invariant 21).
  assert.doesNotMatch(await page('divin'), /loge-a-gagner/)
  // Les compagnons, à la rareté de leur forme : le louveteau commun, le jeune loup rare.
  const avecLeLoup = { ...HABITUE, compagnons: [{ compagnon: 'loup', rang: 1 }] }
  assert.ok(casesDe(await page('commune', avecLeLoup)).some(c => c.nom === 'Le louveteau, Le Loup, première forme'))
  assert.deepEqual(casesDe(await page('rare', avecLeLoup)).map(c => c.nom), ['Le jeune loup, Le Loup, deuxième forme'])
  // Sa métamorphose, que l'Éclat lui ouvre à sa forme ultime : une case de plus, après elle — elle ne la remplace pas.
  const eclate = { ...HABITUE, eclats: ['🦊', 'cp:loup-louveteau'], compagnons: [{ compagnon: 'loup', rang: 3, eclat: true }] }
  const legendaires = casesDe(await page('legendaire', eclate)).map(c => c.nom)
  assert.deepEqual(legendaires.slice(-2), ['Le loup des étoiles, Le Loup, forme ultime, éclaté', 'Le loup-tempête, Le Loup, métamorphose, éclaté'])
  assert.ok(!casesDe(await page('legendaire', { ...HABITUE, compagnons: [{ compagnon: 'loup', rang: 3 }] })).some(c => c.nom.startsWith('Le loup-tempête')), 'pas sans l’Éclat')
  // Le premier jour : les offerts seuls, et ce qui reste de tout l'album.
  assert.deepEqual((await sesPages(DEBUTANT)).map(p => p.page), ['offert'])
  assert.match(await page('offert', DEBUTANT), /href="#collection-avatars">157 avatars à gagner\s:\soù\s\?/)
})

test('la carte montre une case — son halo d’or —, celle qu’il porte garde sa coche, et rien ne bouge sous le doigt', async () => {
  // Rien d'essayé : le Phénix est montré et porté — pressé, sa coche, sans « porté » redit à l'oreille.
  const sansEssai = casesDe(await page('legendaire'))
  assert.deepEqual(sansEssai.map(c => [c.nom, c.presse, c.classes.join(' ')]), [
    ['Le Phénix, légendaire', true, 'anneau-legendaire selected porte'],
    ['Le Dragon d’Or, légendaire', false, 'anneau-legendaire'],
  ])
  // Le Dragon essayé : son halo ; le Phénix garde sa coche, et l'oreille entend qu'il le porte toujours.
  const dragon = casesDe(await page('legendaire', HABITUE, { legendaire: 'lg:dragon' }))
  assert.deepEqual(dragon.map(c => [c.nom, c.presse, c.classes.join(' ')]), [
    ['Le Phénix, légendaire, porté', false, 'anneau-legendaire porte'],
    ['Le Dragon d’Or, légendaire', true, 'anneau-legendaire selected essaye'],
  ])
  // Les mêmes cases, dans le même ordre : un essai ne change que leur état — rien ne part sous le doigt, ni le focus avec.
  const sansEtat = (cases: { nom: string }[]) => cases.map(c => c.nom.replace(/, porté$/, ''))
  assert.deepEqual(sansEtat(dragon), sansEtat(sansEssai))
  // Son Divin, sur sa page, dans son anneau.
  assert.deepEqual(
    casesDe(await page('divin')).map(c => [c.nom, c.presse, c.classes.join(' ')]),
    [['Le Séraphin, Divin', false, 'anneau-divin']],
  )
  // Sous le Phénix, la grenouille n'est pas portée : c'est le Phénix que la salle voit. Essayée, elle le remplace sur la carte.
  const avant = casesDe(await page('offert')).find(c => c.nom === 'Avatar 🐸')!
  assert.deepEqual([avant.presse, avant.classes], [false, []])
  const apres = casesDe(await page('offert', HABITUE, { avatar: '🐸' })).find(c => c.nom === 'Avatar 🐸')!
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

test('la fiche d’un portrait dit le palier qui l’ouvre, et où il en est ; à lui, où le porter et « Essayer » — rien ne s’y porte', async () => {
  // Le blaireau, au palier 4 de la forêt : à lui. Il se porte dans la loge, pas d'ici.
  const blaireau = await ficheDeLAlbum('br:blaireau', { aLui: true })
  assert.match(blaireau, /<b class="galerie-detail-nom">Le blaireau<\/b><span class="album-detail-rarete"><i aria-hidden="true"><\/i>Peu commune<\/span>/)
  assert.match(blaireau, /<p class="muted small">La forêt · Nature<\/p>/)
  assert.match(blaireau, /À toi\. Il se porte dans <a class="link-inline" href="#avatar">«\sMon avatar\s»<\/a>\./)
  assert.match(blaireau, /<span class="label album-etiquette">Comment il se gagne<\/span>/)
  // « Essayer », comme sous « À porter » à la fin d'une partie : la loge s'ouvre, lui sur la carte (`essaiDemande`).
  assert.match(blaireau, /<a class="btn btn-small album-essayer" href="\?essayer=br%3Ablaireau#avatar">Essayer<\/a>/)
  // À lui, plus de jauge ni de chemin : il l'a.
  assert.doesNotMatch(blaireau, /<button|Le porter|album-progres|album-aller/)
  // Le lynx, au palier 6 : où il en est sur son sentier, et le chemin du sentier.
  const lynx = await ficheDeLAlbum('br:lynx')
  assert.match(lynx, /Sur les sentiers\s: le palier 6 du sentier de la forêt<\/b>/)
  assert.match(lynx, /<span class="album-progres"><span class="jauge-fine" aria-hidden="true"><span style="width:83%"><\/span><\/span><span>palier 5 sur 6<\/span><\/span>/)
  assert.doesNotMatch(lynx, /<button|album-essayer/, 'à gagner : rien à porter, rien à essayer')
  assert.match(lynx, /<a class="btn btn-small album-aller" href="\/campagne#sentier-foret">Aller au sentier<\/a>/)
  // Le Loup, au palier 8 : à lui, et porté — l'essayer ne montrerait rien de neuf.
  const loup = await ficheDeLAlbum('br:loup', { aLui: true, porte: true, profil: { ...HABITUE, sentiers: { foret: 8 } } })
  assert.match(loup, /À toi, et tu le portes\./)
  assert.doesNotMatch(loup, /album-essayer/)
})

test('touché dans l’album, un légendaire ou un Divin se montre en grand en tête de sa fiche, le reflet sous le doigt', async () => {
  // À 30 px dans sa case, on ne voyait ni la peinture ni la pellicule. La
  // fiche vit dans la collection, qui raconte d'où il vient.
  const album = source('components/AlbumDesAvatars.tsx')
  // Gagné ou non, éclaté ou non, en grand : ses grands fichiers, et le reflet qui suit le doigt.
  // Le drapeau du Cabinet suit l'album jusqu'à elle (`cabinet`, le 25 octobre 2026).
  assert.match(album, /<FicheDeLAvatar a=\{a\} aLui=\{aLui\} porte=\{lePorte\} profil=\{profil\} dessin=\{dessin\(a, aLui, true\)\} cabinet=\{cabinet\} \/>/)
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
  assert.match(await page('offert'), /aria-label="Avatar 🦊, éclaté"/)
  // Et le lecteur d'écran entend ce qui a changé.
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ eclat: { cle: '🦊', brille: false } }), 'Tu portes sa version d’origine.')
  assert.equal(annonceDuChoix({ eclat: { cle: '🦊', brille: true } }), 'Tu portes sa version rare.')
})

test('un emoji de collection dit son niveau, à l’oreille et dans la barre de la loge', async () => {
  // Ils vivent à la rareté de leur niveau, comme dans l'album : communs, puis peu communs à partir du niveau 10.
  const cases = [...casesDe(await page('commune')), ...casesDe(await page('peucommune'))]
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
  // que montrer, légendaire, Divin, portrait ou emoji — et « Essayer » y mène.
  const dragon = await ficheDeLAlbum('lg:dragon', { aLui: true })
  assert.match(dragon, /À toi\. Il se porte dans <a class="link-inline" href="#avatar">«\sMon avatar\s»<\/a>\./)
  assert.match(dragon, /href="\?essayer=lg%3Adragon#avatar">Essayer</)
  const phenix = await ficheDeLAlbum('lg:phenix', { aLui: true, porte: true })
  assert.match(phenix, /À toi, et tu le portes\./)
  assert.doesNotMatch(phenix, /album-essayer/)
  assert.match(await ficheDeLAlbum('dv:seraphin', { aLui: true }), /À toi\./)
  const aGagner = await ficheDeLAlbum('lg:oracle')
  assert.doesNotMatch(aGagner, /À toi|album-essayer/)
  for (const html of [dragon, aGagner]) assert.doesNotMatch(html, /<button|Le porter|Il remplacera|Revenir à mon emoji/)
  assert.doesNotMatch(source('components/AlbumDesAvatars.tsx'), /enregistrer|onPorter|onEclat/)
})

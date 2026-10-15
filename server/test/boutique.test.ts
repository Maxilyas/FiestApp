// La boutique a quatre rayons — les thèmes, les compagnons, les fonds, les
// objets —, chacun son onglet, sous une barre fine (la remarque du
// propriétaire du 5 octobre 2026) : les vies, posées sous la vitrine des
// thèmes, ne se trouvaient qu'en la faisant défiler toute. Le rayon des vies
// est devenu celui des objets — les vies, le sablier de la série, et ce qui
// viendra —, en icônes : toucher l'une dit ce qu'on achète et combien (la
// remarque du 5 octobre 2026, au soir). Les compagnons sont venus entre les
// deux le 13 octobre 2026 (`compagnons.test.ts`), les fonds des savoirs le
// 15.
//
// Pas de serveur : la page de la boutique, rendue en HTML — la recette de
// `profil-atlas.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

const lieu = { pathname: '/boutique', search: '', hash: '', origin: 'http://banc' }
Object.assign(globalThis, { React, window: { location: lieu }, location: lieu })

/** Jeanne, 420 confettis en poche, trois thèmes à elle, et le fond du club de jazz. */
const JEANNE = {
  name: 'Jeanne',
  avatar: '🦊',
  finition: 'mat',
  legendaire: null,
  eclats: [],
  theme: 'ivoire',
  fonds: ['nuit', 'jazz'],
  fond: 'jazz',
  boutique: {
    confettis: { gagnes: 820, depenses: 400, solde: 420 },
    possedes: ['velours', 'ivoire', 'neige'],
    porte: null,
    jour: '2026-09-29',
  },
}

/** La boutique ouverte à cette adresse. */
async function boutique(hash = ''): Promise<string> {
  lieu.hash = hash
  const module = await import(new URL('../../client/src/components/PanneauxDuProfil.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(
    React.createElement(module.PanneauBoutique, { profil: JEANNE, busy: false, enregistrer: () => {}, acheter: async () => null, onSolde: () => {} }),
  )
}

/** Les onglets de la barre fine — la vitrine des thèmes a les siens, ses raretés. */
function onglets(html: string) {
  const debut = html.indexOf('class="onglets onglets-fins"')
  const barre = html.slice(debut, html.indexOf('</div>', debut))
  return [...barre.matchAll(/<button\b([^>]*role="tab"[^>]*)>(.*?)<\/button>/g)].map(m => ({
    nom: m[2].replace(/<[^>]+>/g, ''),
    choisi: /aria-selected="true"/.test(m[1]),
  }))
}

test('la boutique a quatre rayons, chacun son onglet, sous une barre fine', async () => {
  const html = await boutique()
  assert.deepEqual(onglets(html), [
    { nom: 'Thèmes', choisi: true },
    { nom: 'Compagnons', choisi: false },
    { nom: 'Fonds', choisi: false },
    { nom: 'Objets', choisi: false },
  ])
  assert.match(html, /class="onglets onglets-fins"/, 'la barre fine, pas les pilules')
  assert.match(html, /role="tabpanel"/)
  assert.match(html, /class="gemmes"/, 'la vitrine des thèmes d’abord')
  assert.doesNotMatch(html, /class="objets-grille"/, 'les objets attendent leur onglet')
  assert.doesNotMatch(html, /class="rayon-compagnons"/, 'les compagnons aussi')
  assert.doesNotMatch(html, /class="rayon-fonds"/, 'les fonds aussi')

  // À son adresse, le rayon des objets : un lien peut y mener.
  const objets = await boutique('#objets')
  assert.deepEqual(onglets(objets), [
    { nom: 'Thèmes', choisi: false },
    { nom: 'Compagnons', choisi: false },
    { nom: 'Fonds', choisi: false },
    { nom: 'Objets', choisi: true },
  ])
  assert.match(objets, /class="objets-grille"/)
  assert.doesNotMatch(objets, /class="gemmes"/)

  // Celui des compagnons de même : la boutique et l'album y mènent — et un compagnon, sa vitrine ouverte sur lui.
  for (const adresse of ['#compagnons', '#compagnon-tortue']) {
    const compagnons = await boutique(adresse)
    assert.deepEqual(
      onglets(compagnons).map(o => o.choisi),
      [false, true, false, false],
      adresse,
    )
    assert.match(compagnons, /class="rayon-compagnons"/)
    assert.doesNotMatch(compagnons, /class="gemmes"|class="objets-grille"/)
  }

  // Et celui des fonds : la loge et la collection y mènent, un fond sa fiche dépliée.
  const fonds = await boutique('#fonds')
  assert.deepEqual(
    onglets(fonds).map(o => o.choisi),
    [false, false, true, false],
  )
  assert.match(fonds, /class="rayon-fonds"/)
  assert.doesNotMatch(fonds, /id="detail-fond"/, 'rien de déplié à l’adresse du rayon')
  const vitrail = await boutique('#fond-vitrail')
  assert.deepEqual(
    onglets(vitrail).map(o => o.choisi),
    [false, false, true, false],
  )
  assert.match(vitrail, /id="detail-fond"[\s\S]*?Le Vitrail/)
  lieu.hash = ''
})

test('le rayon des fonds : les douze des savoirs, sa carte posée sur chacun, le prix ou ce qu’il en a — jamais ceux du trésor', async () => {
  const html = await boutique('#fonds')
  const cartes = [...html.matchAll(/<button type="button" class="(fond-vitrine[^"]*)"[^>]*aria-label="([^"]+)"/g)].map(m => ({ classe: m[1], dit: m[2] }))
  assert.equal(cartes.length, 12, 'un par catégorie')
  // Chacune porte sa carte : son prénom et son avatar, sur le fond — et le savoir qu'il habille.
  assert.equal(html.match(/<span class="fond-carte carte-fond fond-[\w-]+" aria-hidden="true"><span class="fond-carte-tete">/g)?.length, 12)
  assert.equal(html.match(/<b>Jeanne<\/b>/g)?.length, 12)
  assert.match(html, /<span class="fond-carte-savoir">Histoire<\/span>/)
  // Le club de jazz est à elle, et le porte : « Porté » ; les autres, à leur prix — elle en a de quoi.
  assert.deepEqual(cartes.find(c => /Le Club de jazz/.test(c.dit)), { classe: 'fond-vitrine fond-porte', dit: 'Le Club de jazz, Musique, porté' })
  assert.equal(html.match(/<span class="fond-vitrine-prix">🎊 250<\/span>/g)?.length, 11)
  // Le trésor ne se vend pas : il ne sort que du coffre de la semaine, et la collection dit où.
  assert.doesNotMatch(html, /fond-dragon|fond-voie-lactee|Le Dragon d’or/)
  assert.match(html, /1 sur 12 à toi : <a class="link-inline" href="\/profil#fond">le porter<\/a>/)
  // Déplié : la carte en grand, et l'achat — qui laisse ce qu'il restera.
  const fiche = await boutique('#fond-vitrail')
  assert.match(fiche, /<span class="fond-carte carte-fond fond-vitrail fond-carte-grande" aria-hidden="true">/)
  assert.match(fiche, /Il coûte 250 confettis : il t’en restera 170\./)
  assert.match(fiche, />L’acheter · 🎊 250<\/button>/)
  lieu.hash = ''
})

/** Les cases du rayon des objets : leur nom, leur prix, et si leur fiche est dépliée. */
function cases(html: string) {
  return [...html.matchAll(/<button\b[^>]*class="objet-case[^"]*"[^>]*aria-expanded="(true|false)"[^>]*>(.*?)<\/button>/g)].map(m => ({
    nom: /class="objet-nom">([^<]*)</.exec(m[2])?.[1],
    prix: /class="objet-prix">([^<]*)</.exec(m[2])?.[1],
    ouverte: m[1] === 'true',
  }))
}

test('les objets en icônes : une case par objet, sa fiche au toucher, avec la quantité', async () => {
  // Le rayon : des cases, rien de déplié — on voit tout ce qui s'achète d'un coup d'œil.
  const rayon = await boutique('#objets')
  assert.deepEqual(cases(rayon), [
    { nom: 'Vie', prix: '🎊 25', ouverte: false },
    { nom: 'Sablier', prix: '🎊 50', ouverte: false },
  ])
  assert.match(rayon, /class="objet-dessin"><svg class="coeur-de-vie"/, 'la vie a son cœur')
  assert.match(rayon, /class="objet-dessin"><svg class="sablier sablier-plein"/, 'le sablier, le sien')
  assert.doesNotMatch(rayon, /id="fiche-objet"/, 'aucune fiche avant le toucher')
  assert.match(rayon, /class="objet-compte" aria-hidden="true">0\/2</, 'ce qu’on a de sabliers, sur sa case')
  assert.match(rayon, /class="sr-only">Tu en as : 0 sur 2/, 'et en toutes lettres pour le lecteur d’écran')

  // L'adresse d'un objet ouvre sa fiche — le lien de la série, au quiz du
  // jour : ce que c'est, son prix, combien on en prend, le total.
  const sablier = await boutique('#objet-sablier')
  assert.deepEqual(
    cases(sablier).map(c => c.ouverte),
    [false, true],
  )
  const fiche = sablier.slice(sablier.indexOf('id="fiche-objet"'))
  assert.match(fiche, /aria-label="Sablier"/)
  assert.match(fiche, /class="galerie-detail-nom">Sablier</)
  assert.match(fiche, /class="detail-famille muted">Série du quiz du jour</, 'où il sert')
  assert.match(fiche, /Un jour sans quiz du jour en prend un/, 'ce qu’il fait')
  assert.match(fiche, /aria-label="Combien : 1 sablier"/, 'la quantité, un d’abord')
  assert.match(fiche, /1 sablier · 🎊 50/)
  assert.match(fiche, />Acheter · 🎊 50</)
  // C'est là que mène la feuille de la série, au quiz du jour.
  const { adresseDeLObjet } = await import(new URL('../../client/src/components/Objets.tsx', import.meta.url).href)
  assert.equal(adresseDeLObjet('sablier'), '/boutique#objet-sablier')
  assert.match(readFileSync(new URL('../../client/src/views/JourApp.tsx', import.meta.url), 'utf8'), /href=\{adresseDeLObjet\('sablier'\)\}/)

  // L'adresse d'avant, quand le rayon ne vendait que les vies, y mène encore.
  const vies = await boutique('#vies')
  assert.equal(onglets(vies).find(o => o.nom === 'Objets')?.choisi, true)
  assert.deepEqual(
    cases(vies).map(c => c.ouverte),
    [true, false],
  )
  assert.match(vies.slice(vies.indexOf('id="fiche-objet"')), /aria-label="Combien : 1 vie"/)
  lieu.hash = ''
})

test('la barre fine : un trait sous le texte, sans cadre ni pilule', () => {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const regle = (selecteur: string) => css.slice(css.indexOf(`${selecteur} {`)).split('}')[0]
  assert.match(regle('.onglets.onglets-fins'), /border: 0/)
  assert.match(regle('.onglets.onglets-fins'), /border-bottom: 1px solid var\(--edge\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /border-bottom-color: var\(--accent\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /box-shadow: none/)
})

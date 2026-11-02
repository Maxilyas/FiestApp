// La boutique, d'un seul tenant (la refonte du 1er novembre 2026, « la
// Galerie » et son panier, choisis par le propriétaire : « beaucoup plus
// esthétique et pratique à naviguer sur téléphone », et « pouvoir essayer
// sans acheter pour les éléments qui s'y prêtent ») : « À la une » en tête,
// puis les quatre rayons à la suite — les thèmes, une étagère par rareté ;
// les compagnons ; les fonds, sur sa propre carte ; le comptoir des objets —,
// des puces collées en haut qui y mènent. Quatre onglets, sous une barre fine,
// cachaient trois rayons sur quatre (le 5 octobre 2026), et le rayon des
// thèmes, une rareté sur cinq.
//
// Ce qui s'y prête s'essaie avant de s'acheter, et le panier additionne ce
// qu'on essaie (`shared/panier.ts`).
//
// Pas de serveur : la page de la boutique, rendue en HTML — la recette de
// `profil-atlas.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { ceQuiManque, lignesDuPanier, sansLaSorte, totalDuPanier } from '../../shared/panier'

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
    fondsAchetes: ['jazz'],
  },
}

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

/** La boutique ouverte à cette adresse. */
async function boutique(hash = '', profil: object = JEANNE): Promise<string> {
  lieu.hash = hash
  const module = await import(client('components/PanneauxDuProfil.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rien = async () => null
  return renderToStaticMarkup(
    React.createElement(module.PanneauBoutique, { profil, busy: false, enregistrer: () => {}, acheter: rien, acheterCompagnon: rien, acheterFond: rien, onSolde: () => {} }),
  )
}

/** Les puces des rayons : leur nom, leur adresse, la puce allumée. */
function puces(html: string) {
  const debut = html.indexOf('<nav class="boutique-rayons"')
  const barre = html.slice(debut, html.indexOf('</nav>', debut))
  return [...barre.matchAll(/<a href="([^"]+)"( aria-current="true")?>(.*?)<\/a>/g)].map(m => ({ nom: m[3], href: m[1], ici: !!m[2] }))
}

/** Une feuille ouverte : son nom, et ce qu'elle contient. */
function feuille(html: string): { titre: string; corps: string } | null {
  const m = /<div class="carte-feuille[^"]*" role="dialog" aria-modal="true" aria-label="([^"]+)"/.exec(html)
  return m ? { titre: m[1], corps: html.slice(m.index) } : null
}

test('la boutique est une seule page : « À la une », puis les quatre rayons à la suite, et des puces qui y mènent', async () => {
  const html = await boutique()
  assert.deepEqual(puces(html), [
    { nom: 'Thèmes', href: '#themes', ici: true },
    { nom: 'Compagnons', href: '#compagnons', ici: false },
    { nom: 'Fonds', href: '#fonds', ici: false },
    { nom: 'Objets', href: '#objets', ici: false },
  ])
  // Plus d'onglets : rien ne se cache, on descend.
  assert.doesNotMatch(html, /role="tab"|role="tabpanel"|onglets-fins/)
  // Les quatre rayons, dans l'ordre des puces, chacun sa tête.
  const rayons = [...html.matchAll(/<section id="rayon-(\w+)" class="rayon-de-la-boutique" aria-labelledby="titre-\w+"><header class="rayon-tete"><h2 id="titre-\w+">([^<]+)<\/h2>/g)].map(m => [m[1], m[2]])
  assert.deepEqual(rayons, [
    ['themes', 'Thèmes'],
    ['compagnons', 'Compagnons'],
    ['fonds', 'Fonds'],
    ['objets', 'Le comptoir'],
  ])
  assert.match(html, /Il vit dans ta niche, en haut de chaque page/)
  // « À la une » en tête : un compagnon, un thème, un fond — ce qu'elle n'a pas.
  const une = [...html.matchAll(/<li class="une-boutique-carte une-boutique-(\w+)"/g)].map(m => m[1])
  assert.deepEqual([...une].sort(), ['compagnon', 'fond', 'theme'])
  assert.ok(html.indexOf('class="une-boutique"') < html.indexOf('class="boutique-rayons"'), 'la une avant les puces')
  // Chaque carte s'essaie et se voit ; « L'essayer » est un interrupteur, son nom ne change pas.
  assert.equal(html.match(/<button type="button" class="btn btn-primary" aria-pressed="false">L’essayer<span class="sr-only">/g)?.length, 3)
  assert.doesNotMatch(html.slice(html.indexOf('class="une-boutique"'), html.indexOf('class="boutique-rayons"')), /Le Club de jazz/, 'rien de ce qu’elle a déjà')
  // Rien à l'essai, rien au panier : ni barre, ni feuille.
  assert.doesNotMatch(html, /class="boutique-panier"/)
  assert.equal(feuille(html), null)
  lieu.hash = ''
})

test('le rayon des thèmes montre toutes les raretés, chacune son étagère — une carte ouvre sa fiche, où il s’essaie et s’achète', async () => {
  const html = await boutique()
  const etageres = [...html.matchAll(/<h3 class="etagere-titre"><i aria-hidden="true"><\/i>([^<]+)<span class="muted">([^<]+)<\/span><\/h3>/g)].map(m => `${m[1]}${m[2]}`)
  assert.deepEqual(etageres, [
    'Commune · 🎊 150 le thème',
    'Peu commune · 🎊 250 le thème',
    'Rare · 🎊 400 le thème',
    'Épique · 🎊 650 le thème',
    'Légendaire · 🎊 1000 le thème',
  ])
  // Ce qu'elle a n'est pas en rayon ; ce qui coûte plus que son solde dit ce qui manque.
  assert.doesNotMatch(html, /aria-label="(Velours|Ivoire|Neige),/)
  assert.match(html, /aria-label="Aurore boréale, Légendaire, 1000 confettis, encore 580"/)
  // Ouverte depuis « À la une » (`#theme-aurore`) : sa feuille, son essai, ce qui manque — rien ne s'achète à ce prix-là.
  const aurore = feuille(await boutique('#theme-aurore'))
  assert.equal(aurore?.titre, 'Aurore boréale')
  assert.match(aurore!.corps, /<span class="detail-famille muted">Légendaire · 🎊 1000<\/span>/)
  assert.match(aurore!.corps, /<button type="button" class="btn btn-ghost" aria-pressed="false">L’essayer<\/button>/)
  assert.match(aurore!.corps, /<button type="button" class="btn btn-primary" aria-disabled="true">Encore 580 confettis<\/button>/)
  assert.match(aurore!.corps, /Essaie-le quand même\s: toute la page le porte, rien ne s’achète\./)
  // À sa portée : le prix, ce qui lui restera, « L'acheter ».
  const ocean = feuille(await boutique('#theme-ocean'))
  assert.match(ocean!.corps, /Il coûte 250 confettis : il t’en restera 170\./)
  assert.match(ocean!.corps, />L’acheter · 🎊 250<\/button>/)
  // Un thème offert n'a pas de fiche à la boutique ; hors de sa saison, ou qui se gagne, sa fiche dit pourquoi rien ne s'y achète.
  assert.equal(feuille(await boutique('#theme-velours')), null)
  const halloween = feuille(await boutique('#theme-halloween'))!
  assert.match(halloween.corps, /En boutique du 25 octobre au 1er novembre seulement/)
  assert.doesNotMatch(halloween.corps, /L’essayer|L’acheter/)
  assert.match(feuille(await boutique('#theme-babel'))!.corps, /Il ne se vend pas\s: il se gagne avec/)
  lieu.hash = ''
})

test('le rayon des fonds : sa carte en grand, douze décors en pastilles qui l’essaient — jamais ceux du trésor', async () => {
  const html = await boutique('#fonds')
  const pastilles = [...html.matchAll(/<button type="button" class="fond-pastille carte-fond fond-([\w-]+)" aria-pressed="(true|false)" aria-label="([^"]+)"/g)].map(m => ({
    cle: m[1],
    montre: m[2] === 'true',
    dit: m[3],
  }))
  assert.equal(pastilles.length, 12, 'un par catégorie')
  // Le club de jazz est à elle, et le porte : sa carte le montre d'office.
  assert.deepEqual(pastilles.find(p => p.cle === 'jazz'), { cle: 'jazz', montre: true, dit: 'Le Club de jazz, Musique, porté' })
  assert.equal(pastilles.filter(p => p.montre).length, 1)
  assert.equal(pastilles.filter(p => /, 250 confettis$/.test(p.dit)).length, 11)
  // Sa carte, son avatar et son prénom, posée sur le fond qu'elle montre.
  assert.match(html, /<span class="fond-carte carte-fond fond-carte-grande fond-jazz" aria-hidden="true"><span class="fond-carte-tete">/)
  assert.match(html, /<b>Jeanne<\/b>/)
  // Le trésor ne se vend pas : il ne sort que du coffre de la semaine, et la collection dit où.
  assert.doesNotMatch(html, /fond-dragon|fond-voie-lactee|Le Dragon d’or/)
  assert.match(html, /1 sur 12 à toi : <a class="link-inline" href="\/profil#fond">le porter<\/a>/)
  // `#fond-vitrail` — la fiche d'un fond dans « Ma collection » : sa carte l'essaie, et le panier le compte.
  const vitrail = await boutique('#fond-vitrail')
  assert.match(vitrail, /<span class="fond-carte carte-fond fond-carte-grande fond-vitrail" aria-hidden="true">/)
  assert.match(vitrail, /class="fond-pastille carte-fond fond-vitrail" aria-pressed="true"/)
  assert.match(vitrail, /Il coûte 250 confettis : il t’en restera 170\./)
  assert.match(vitrail, />L’acheter · 🎊 250<\/button>/)
  assert.match(vitrail, /<div class="boutique-panier" role="region" aria-label="Ton essai"><button type="button" class="boutique-panier-annuler" aria-label="Annuler l’essai">/)
  assert.match(vitrail, /<span class="boutique-panier-texte"><b>Le Vitrail<\/b><span class="muted small">À l’essai<\/span><\/span>/)
  assert.match(vitrail, />Prendre · 🎊 250<\/button>/)
  lieu.hash = ''
})

test('les compagnons : une étagère de cartes, la fiche de chacun dans une feuille, et l’essai dans la niche', async () => {
  const html = await boutique('#compagnons')
  const cartes = [...html.matchAll(/<button type="button" class="compagnon-vitrine[^"]*"[^>]*aria-haspopup="dialog" aria-label="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(cartes, ['Le Loup, encore 580', 'Le Chat des lanternes, encore 580', 'La Tortue-île, encore 580', 'La Luciole, encore 580', 'Le Panda roux, encore 580'])
  assert.equal(feuille(html), null, 'aucune fiche avant le toucher')
  // `#compagnon-tortue` — « À la une », l'album : sa fiche, sa scène, l'essayer dans sa niche.
  const tortue = feuille(await boutique('#compagnon-tortue'))
  assert.equal(tortue?.titre, 'La Tortue-île')
  assert.match(tortue!.corps, /aria-label="Caresser la tortue-île"/)
  assert.match(tortue!.corps, /<button type="button" class="btn btn-ghost btn-block" aria-pressed="false"><svg[^>]*>.*?<\/svg>L’essayer dans ma niche<\/button>/)
  lieu.hash = ''
})

/** Le comptoir : chaque case, son nom, son prix. */
function cases(html: string) {
  return [...html.matchAll(/<button type="button" class="comptoir-objet objet-(\w+)" aria-haspopup="dialog">(.*?)<\/button>/g)].map(m => ({
    nom: /class="objet-nom">([^<]*)</.exec(m[2])?.[1],
    prix: /class="objet-prix">([^<]*)</.exec(m[2])?.[1],
  }))
}

test('le comptoir des objets : une grande case chacun, ce qu’il change, sa fiche dans une feuille, avec la quantité', async () => {
  const comptoir = await boutique('#objets')
  assert.deepEqual(cases(comptoir), [
    { nom: 'Vie', prix: '🎊 25' },
    { nom: 'Sablier', prix: '🎊 50' },
    // Pour ceux qui n'ont pas de chance (le 31 octobre 2026).
    { nom: 'Éclat', prix: '🎊 3000' },
  ])
  assert.match(comptoir, /class="objet-dessin"><svg class="coeur-de-vie"/, 'la vie a son cœur')
  assert.match(comptoir, /class="objet-dessin"><svg class="sablier sablier-plein"/, 'le sablier, le sien')
  assert.match(comptoir, /class="objet-dessin"><svg class="gemme-d-eclat"/, 'l’Éclat, sa gemme')
  assert.match(comptoir, /Un jour manqué ne casse plus ta série\./, 'ce qu’il change pour elle')
  assert.match(comptoir, /class="comptoir-a-toi" aria-hidden="true">0\/2 · série de 0 jour</, 'ce qu’elle a de sabliers, sur sa case')
  assert.match(comptoir, /class="sr-only">Tu en as : 0 sur 2/, 'et en toutes lettres pour le lecteur d’écran')
  // L'Éclat montre son avatar tel qu'il est, puis éclaté.
  assert.match(comptoir, /<span class="comptoir-eclat" aria-hidden="true">/)
  assert.equal(feuille(comptoir), null, 'aucune fiche avant le toucher')

  // L'adresse d'un objet ouvre sa fiche — le lien de la série, au quiz du
  // jour : ce que c'est, son prix, combien on en prend, le total.
  const sablier = feuille(await boutique('#objet-sablier'))
  assert.equal(sablier?.titre, 'Sablier')
  assert.match(sablier!.corps, /id="fiche-objet" role="region" aria-label="Sablier"/)
  assert.match(sablier!.corps, /class="detail-famille muted">Série du quiz du jour</, 'où il sert')
  assert.match(sablier!.corps, /Un jour sans quiz du jour en prend un/, 'ce qu’il fait')
  assert.match(sablier!.corps, /aria-label="Combien : 1 sablier"/, 'la quantité, un d’abord')
  assert.match(sablier!.corps, /1 sablier · 🎊 50/)
  assert.match(sablier!.corps, />Acheter · 🎊 50</)
  // C'est là que mène la feuille de la série, au quiz du jour.
  const { adresseDeLObjet } = await import(client('components/Objets.tsx'))
  assert.equal(adresseDeLObjet('sablier'), '/boutique#objet-sablier')
  assert.match(readFileSync(new URL('../../client/src/views/JourApp.tsx', import.meta.url), 'utf8'), /href=\{adresseDeLObjet\('sablier'\)\}/)

  // L'adresse d'avant, quand le rayon ne vendait que les vies, y mène encore.
  const vies = feuille(await boutique('#vies'))
  assert.equal(vies?.titre, 'Vie')
  assert.match(vies!.corps, /aria-label="Combien : 1 vie"/)
  lieu.hash = ''
})

test('les adresses de la boutique mènent à leur rayon, à leur fiche, à leur fond', async () => {
  const { ceQueLAdresseOuvre } = await import(client('components/LaBoutique.tsx'))
  assert.deepEqual(ceQueLAdresseOuvre(''), { rayon: null, fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#compagnons'), { rayon: 'compagnons', fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#compagnon-chat'), { rayon: 'compagnons', fiche: { sorte: 'compagnon', cle: 'chat' } })
  assert.deepEqual(ceQueLAdresseOuvre('#compagnon-dragon'), { rayon: null, fiche: null }, 'un compagnon qui ne se vend pas')
  assert.deepEqual(ceQueLAdresseOuvre('#fonds'), { rayon: 'fonds', fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#fond-jazz'), { rayon: 'fonds', fiche: null, fond: 'jazz' })
  assert.deepEqual(ceQueLAdresseOuvre('#fond-dragon'), { rayon: null, fiche: null }, 'un fond du trésor ne s’essaie pas en boutique')
  assert.deepEqual(ceQueLAdresseOuvre('#objets'), { rayon: 'objets', fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#objet-eclat'), { rayon: 'objets', fiche: { sorte: 'objet', cle: 'eclat' } })
  assert.deepEqual(ceQueLAdresseOuvre('#vies'), { rayon: 'objets', fiche: { sorte: 'objet', cle: 'vie' } })
  assert.deepEqual(ceQueLAdresseOuvre('#theme-aurore'), { rayon: 'themes', fiche: { sorte: 'theme', cle: 'aurore' } })
  assert.deepEqual(ceQueLAdresseOuvre('#theme-ivoire'), { rayon: null, fiche: null }, 'un thème offert')
})

test('le panier compte ce qu’on essaie et qui s’achète — jamais ce qu’on a, ni ce qui ne se vend pas', () => {
  const deja = { themes: ['velours', 'ivoire', 'neige'], fonds: ['nuit', 'jazz'], compagnons: ['loup'], jour: '2026-09-29' }
  const lignes = lignesDuPanier({ theme: 'aurore', fond: 'vitrail', compagnon: 'chat' }, deja)
  assert.deepEqual(lignes, [
    { sorte: 'theme', cle: 'aurore', nom: 'Aurore boréale', detail: 'Thème · Légendaire', prix: 1000 },
    { sorte: 'fond', cle: 'vitrail', nom: 'Le Vitrail', detail: 'Fond · Arts & lettres', prix: 250 },
    { sorte: 'compagnon', cle: 'chat', nom: 'Le Chat des lanternes', detail: 'Compagnon', prix: 1000 },
  ])
  assert.equal(totalDuPanier(lignes), 2250)
  assert.equal(ceQuiManque(lignes, 420), 1830)
  assert.equal(ceQuiManque(lignes, 3000), 0)
  // Une soirée retirée a repris ses confettis : le solde sous zéro manque d'autant.
  assert.equal(ceQuiManque(lignes.slice(1, 2), -30), 280)
  // Ce qu'elle a s'essaie — le jazz sur sa carte, le loup qu'elle a déjà — sans entrer au panier.
  assert.deepEqual(lignesDuPanier({ fond: 'jazz', compagnon: 'loup', theme: 'neige' }, deja), [])
  // Un fond du trésor, un thème offert, un thème hors de sa saison, une clé inconnue : rien.
  assert.deepEqual(lignesDuPanier({ fond: 'dragon', theme: 'velours' }, deja), [])
  assert.deepEqual(lignesDuPanier({ theme: 'halloween' }, deja), [], 'Halloween, fin septembre')
  assert.equal(lignesDuPanier({ theme: 'halloween' }, { ...deja, jour: '2026-10-31' }).length, 1, 'pendant sa saison')
  assert.deepEqual(lignesDuPanier({ compagnon: 'dragon' }, deja), [])
  assert.deepEqual(sansLaSorte({ theme: 'aurore', fond: 'vitrail', compagnon: 'chat' }, 'theme', 'compagnon'), { fond: 'vitrail' })
})

test('l’essai habille la page et la niche, et quitter la boutique rend tout', () => {
  // Le thème essayé passe par l'essai de la loge (`essayerTheme`, `finirLEssai`) ; le compagnon, par la niche (`essayerNiche`).
  const source = readFileSync(new URL('../../client/src/components/LaBoutique.tsx', import.meta.url), 'utf8')
  assert.match(source, /if \(essai\.theme\) void essayerTheme\(essai\.theme\)\s*else finirLEssai\(\)/)
  assert.match(source, /useEffect\(\(\) => essayerNiche\(essai\.compagnon \?\? null\), \[essai\.compagnon\]\)/)
  assert.match(source, /\(\) => \(\) => \{\s*finirLEssai\(\)\s*essayerNiche\(null\)\s*\}/)
  // Acheté et porté, le thème essayé le devient sans repasser par l'ancien.
  assert.match(source, /if \(l\.sorte === 'theme'\) finirLEssai\(porter\)/)
})

test('la barre fine des onglets, que la boutique a quittée, garde son trait sous le texte — au quiz du jour et au défi, dans « Décorer »', () => {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const regle = (selecteur: string) => css.slice(css.indexOf(`${selecteur} {`)).split('}')[0]
  assert.match(regle('.onglets.onglets-fins'), /border: 0/)
  assert.match(regle('.onglets.onglets-fins'), /border-bottom: 1px solid var\(--edge\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /border-bottom-color: var\(--accent\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /box-shadow: none/)
})

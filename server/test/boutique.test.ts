// La boutique, en grilles (la refonte du 10 novembre 2026, la maquette
// validée par le propriétaire — `retours/2026-11-10/boutique/` : « J'ai
// l'impression que les utilisateurs ont du mal et ne voient pas grand-chose
// sur leur téléphone »). Une seule page dense : ses quatre rayons à la suite —
// les thèmes, trois par rangée ; les compagnons, les cinq sur une rangée ; les
// fonds, sa carte sur chacun ; le comptoir, en lignes —, la rangée des rayons
// collée en haut, qui y mène, et un seul présentoir pour tout ce qui se vend.
// « À la une », une étagère par rareté et la grande carte des fonds l'ont
// quittée : la boutique du 1er novembre montrait un article entier à
// l'arrivée en 360 × 640, et faisait six écrans.
//
// Ce qui s'y prête s'essaie avant de s'acheter, l'achat se fait en deux
// touchers au même endroit, et son envie se suit en tête (`shared/envie.ts`).
// Ce qui tient à l'écran se mesure au navigateur
// (`server/scripts/rendu-boutique.ts`).
//
// Pas de serveur : la page de la boutique, rendue en HTML — la recette de
// `profil-atlas.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { SORTES_DU_PANIER, ceQuiManque, lignesDuPanier, sansLaSorte, totalDuPanier } from '../../shared/panier'
import {
  LIGNE_DES_FONDS,
  LIGNE_DU_COMPTOIR,
  fondsEnRayon,
  gestesDuPresentoir,
  ligneDesCompagnons,
  ligneDesThemes,
  rangDansLeRayon,
  themesEnRayon,
  voisinDansLeRayon,
} from '../../shared/rayons'
import { FONDS_DU_TRESOR } from '../../shared/fonds'
import { prixDe } from '../../shared/themes'

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
type Profil = Omit<typeof JEANNE, 'boutique'> & { boutique: typeof JEANNE.boutique & { envie?: { sorte: string; cle: string } } }

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const rien = async () => null

/** La boutique ouverte à cette adresse. */
async function boutique(hash = '', profil: Profil = JEANNE): Promise<string> {
  lieu.hash = hash
  const module = await import(client('components/PanneauxDuProfil.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(
    React.createElement(module.PanneauBoutique, { profil, busy: false, enregistrer: () => {}, acheter: rien, acheterCompagnon: rien, acheterFond: rien, onSolde: () => {}, onEnvie: () => {} }),
  )
  lieu.hash = ''
  return html
}

/** Un présentoir, ouvert sur cet article, à cette étape. */
async function presentoir(ouvert: { sorte: string; cle: string }, props: object = {}): Promise<string> {
  const { Presentoir } = await import(client('components/Presentoir.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(
    React.createElement(Presentoir, {
      profil: JEANNE,
      ouvert,
      rayon: themesEnRayon(JEANNE.boutique.possedes, JEANNE.boutique.jour).map(t => t.key),
      essai: {},
      busy: false,
      comptoir: { possede: () => null, maximum: () => 1, acheter: async () => {} },
      onVoisin: () => {},
      onEssayer: () => {},
      onEnvie: rien,
      acheter: rien,
      acheterCompagnon: rien,
      acheterFond: rien,
      enregistrer: () => {},
      onFermer: () => {},
      ...props,
    }),
  )
}

/** Les segments des rayons : leur nom, leur adresse, celui qui est allumé. */
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

/** Les gestes au pied d'un présentoir : leur nom, s'il est le geste attendu, son état d'interrupteur. */
function gestes(html: string) {
  const debut = html.indexOf('<div class="presentoir-gestes')
  const pied = html.slice(debut, html.indexOf('</footer>', debut))
  return [...pied.matchAll(/<button type="button" class="btn (btn-primary|btn-ghost)"( aria-pressed="(true|false)")?( aria-disabled="true")?>(?:<svg[^>]*>.*?<\/svg>)?([^<]+)<\/button>/g)].map(m => ({
    nom: m[5],
    principal: m[1] === 'btn-primary',
    ...(m[3] && { presse: m[3] === 'true' }),
    ...(m[4] && { eteint: true }),
  }))
}

test('la boutique est une seule page : ses quatre rayons en grilles, chacun sa ligne, une rangée qui y mène — et plus de « À la une »', async () => {
  const html = await boutique()
  assert.deepEqual(puces(html), [
    { nom: 'Thèmes', href: '#themes', ici: true },
    { nom: 'Compagnons', href: '#compagnons', ici: false },
    { nom: 'Fonds', href: '#fonds', ici: false },
    { nom: 'Objets', href: '#objets', ici: false },
  ])
  // Plus d'onglets : rien ne se cache, on descend.
  assert.doesNotMatch(html, /role="tab"|role="tabpanel"|onglets-fins/)
  // Les quatre rayons, dans l'ordre des segments : son nom, et ce qu'on vient y chercher en une ligne.
  const enRayon = themesEnRayon(JEANNE.boutique.possedes, JEANNE.boutique.jour)
  const rayons = [...html.matchAll(/<section id="rayon-(\w+)" class="rayon-de-la-boutique" aria-labelledby="titre-\w+"><header class="rayon-tete"><h2 id="titre-\w+">([^<]+)<\/h2><p>([^<]+)<\/p><\/header>/g)].map(m => [m[1], m[2], m[3]])
  assert.deepEqual(rayons, [
    ['themes', 'Thèmes', ligneDesThemes(enRayon, 420)],
    ['compagnons', 'Compagnons', '1000 chacun'],
    ['fonds', 'Fonds', '250 chacun · derrière ta carte'],
    ['objets', 'Le comptoir', 'ce qui sert en jeu'],
  ])
  assert.match(rayons[0][2], /^\d+, dont \d+ à ta portée$/)
  // Un paragraphe par rayon expliquait ce qu'est un thème, un compagnon, un fond : il prenait la place de deux rangées.
  assert.doesNotMatch(html, /Il vit dans ta niche, en haut de chaque page|Ils habillent tes pages|Un décor par savoir/)
  // « À la une » a quitté la boutique : elle redisait, sur tout l'écran d'arrivée, trois articles que les rayons montrent.
  // Elle reste à l'accueil, d'où elle amène ici (`ALaUne.tsx`).
  assert.doesNotMatch(html, /une-boutique|À la une/)
  assert.ok(!existsSync(fileURLToPath(client('components/UneDeLaBoutique.tsx'))), 'son composant s’en va avec elle')
  assert.ok(existsSync(fileURLToPath(client('components/ALaUne.tsx'))), 'celui de l’accueil reste')
  // Rien n'y glisse plus de côté : ni étagère, ni cartes à faire défiler.
  assert.doesNotMatch(html, /etagere/)
  assert.doesNotMatch(source('styles.css').slice(source('styles.css').indexOf('.la-boutique {'), source('styles.css').indexOf('.confettis-sources li > span')), /scroll-snap/)
  // Rien à l'essai, pas d'envie : ni barre, ni carte, ni feuille.
  assert.doesNotMatch(html, /class="boutique-panier"|class="carte-envie"/)
  assert.equal(feuille(html), null)
})

test('chaque rayon dit en une ligne ce qu’on vient y chercher : ce qui reste, et ce que son solde paie déjà', () => {
  const enRayon = themesEnRayon(['velours', 'ivoire', 'neige'], '2026-09-29')
  // Ce qu'elle n'a pas et que la saison permet, dans l'ordre du catalogue : du moins cher au plus cher.
  assert.ok(enRayon.length > 15)
  assert.deepEqual(enRayon.map(prixDe), [...enRayon.map(prixDe)].sort((a, b) => a - b))
  for (const t of enRayon) assert.ok(t.rarete !== 'offert' && !t.gagne && !['velours', 'ivoire', 'neige'].includes(t.key), t.key)
  assert.ok(!enRayon.some(t => t.key === 'halloween'), 'Halloween, fin septembre')
  assert.ok(themesEnRayon([], '2026-10-31').some(t => t.key === 'halloween'), 'pendant sa saison')
  const n = enRayon.length
  const aPortee = (solde: number) => enRayon.filter(t => prixDe(t) <= solde).length
  assert.equal(ligneDesThemes(enRayon, 5000), `${n}, tous à ta portée`)
  assert.equal(ligneDesThemes(enRayon, 420), `${n}, dont ${aPortee(420)} à ta portée`)
  // Sans rien à sa portée, le premier prix : ce qu'il vise. Un solde sous zéro ne change rien à la phrase.
  assert.equal(ligneDesThemes(enRayon, 80), `${n} · le premier à 150`)
  assert.equal(ligneDesThemes(enRayon, -30), `${n} · le premier à 150`)
  assert.equal(ligneDesThemes(enRayon.slice(0, 1), 150), '1, à ta portée')
  assert.equal(ligneDesThemes([], 420), 'tu les as tous')
  assert.equal(ligneDesCompagnons(0), '1000 chacun')
  assert.equal(ligneDesCompagnons(2), '1000 chacun · 2 à toi')
  assert.equal(LIGNE_DES_FONDS, '250 chacun · derrière ta carte')
  assert.equal(LIGNE_DU_COMPTOIR, 'ce qui sert en jeu')
  // Les fonds en rayon : les douze des savoirs, moins les siens — jamais ceux du trésor.
  assert.equal(fondsEnRayon([]).length, 12)
  assert.equal(fondsEnRayon(['nuit', 'jazz']).length, 11, 'la Nuit étoilée n’est pas un fond des savoirs')
  for (const f of fondsEnRayon([])) assert.ok(f.savoir && !FONDS_DU_TRESOR.some(t => t.key === f.key), f.key)
  // Les flèches du présentoir : le voisin, en boucle ; rien hors du rayon, ni seul.
  assert.deepEqual(rangDansLeRayon(['a', 'b', 'c'], 'b'), { rang: 2, sur: 3 })
  assert.equal(rangDansLeRayon(['a', 'b', 'c'], 'z'), null)
  assert.equal(voisinDansLeRayon(['a', 'b', 'c'], 'c', 1), 'a')
  assert.equal(voisinDansLeRayon(['a', 'b', 'c'], 'a', -1), 'c')
  assert.equal(voisinDansLeRayon(['a', 'b', 'c'], 'z', 1), null)
  assert.equal(voisinDansLeRayon(['a'], 'a', 1), null)
})

test('le rayon des thèmes : une grille de tuiles, du moins cher au plus cher — une tuile ouvre son présentoir, où il s’essaie et s’achète', async () => {
  const html = await boutique()
  const enRayon = themesEnRayon(JEANNE.boutique.possedes, JEANNE.boutique.jour)
  const tuiles = [...html.matchAll(/<button type="button" class="article-boutique article-theme" style="--gemme:[^"]+" aria-haspopup="dialog" aria-label="([^"]+)">/g)].map(m => m[1])
  assert.equal(tuiles.length, enRayon.length, 'une tuile par thème en rayon')
  assert.deepEqual(tuiles.map(t => t.split(',')[0]), enRayon.map(t => t.nom), 'dans l’ordre du catalogue')
  // Ce qu'elle a n'est pas en rayon ; ce qui coûte plus que son solde dit ce qui manque.
  assert.doesNotMatch(html, /aria-label="(Velours|Ivoire|Neige),/)
  assert.ok(tuiles.includes('Aurore boréale, Légendaire, 1000 confettis, encore 580'))
  // Son nom entier, sur sa tuile : il passe à la ligne, il ne se coupe pas.
  assert.match(html, /<b class="article-nom">Aurore boréale<\/b>/)
  const css = source('styles.css')
  const regle = (selecteur: string) => new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
  assert.match(regle('.article-nom'), /overflow-wrap: anywhere;/)
  assert.doesNotMatch(regle('.article-nom'), /text-overflow|white-space: nowrap|line-clamp/)
  // Trois par rangée sur un téléphone ; quatre fonds.
  assert.match(regle('.grille-themes'), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/)
  assert.match(regle('.grille-fonds'), /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/)
  assert.match(html, /3 thèmes déjà à toi · <a class="link-inline" href="\/profil#theme">les porter<\/a>/)

  // Ouvert par son adresse (`#theme-aurore`, « À la une » de l'accueil) : son présentoir. Trop cher : il s'essaie quand
  // même, et son envie tient lieu d'achat — un bouton éteint, « Encore 580 confettis », n'offrait rien à faire.
  const aurore = feuille(await boutique('#theme-aurore'))
  assert.equal(aurore?.titre, 'Aurore boréale')
  assert.match(aurore!.corps, /<span class="presentoir-sorte"><i class="article-gemme" aria-hidden="true"><\/i>Thème · Légendaire<\/span><h3 class="presentoir-nom">Aurore boréale<\/h3>/)
  assert.match(aurore!.corps, /<div class="presentoir-prix"><b>🎊 1000<\/b><span class="presentoir-manque">Encore 🎊 580 à gagner<\/span><\/div>/)
  assert.deepEqual(gestes(aurore!.corps), [
    { nom: 'L’essayer', principal: false, presse: false },
    { nom: 'J’en ai envie', principal: true, presse: false },
  ])
  // À sa portée : ce qui lui restera, « L'acheter ». Sa barre le feuillette dans son rayon, et porte l'étoile de son envie.
  const ocean = feuille(await boutique('#theme-ocean'))
  assert.match(ocean!.corps, /<div class="presentoir-prix"><b>🎊 250<\/b><span>Il t’en restera 🎊 170<\/span><\/div>/)
  assert.deepEqual(gestes(ocean!.corps), [
    { nom: 'L’essayer', principal: false, presse: false },
    { nom: 'L’acheter · 🎊 250', principal: true },
  ])
  const rang = enRayon.findIndex(t => t.key === 'ocean') + 1
  assert.match(
    ocean!.corps,
    new RegExp(
      `<div class="presentoir-barre"><button type="button" class="presentoir-rond" aria-label="Le précédent">.*?</button><button type="button" class="presentoir-rond" aria-label="Le suivant">.*?</button><span class="presentoir-rang">${rang} sur ${enRayon.length}</span><button type="button" class="presentoir-rond presentoir-etoile" aria-pressed="false" aria-label="En faire mon envie">`,
    ),
  )
  assert.match(ocean!.corps, /l’écran commun garde le sien\./)
  // Un thème offert n'a pas de présentoir ; hors de sa saison, ou qui se gagne, il dit pourquoi rien ne s'y achète —
  // et n'a ni flèches, ni étoile : il n'est pas en rayon.
  assert.equal(feuille(await boutique('#theme-velours')), null)
  const halloween = feuille(await boutique('#theme-halloween'))!
  assert.match(halloween.corps, /En boutique du 25 octobre au 1er novembre seulement/)
  assert.deepEqual(gestes(halloween.corps), [{ nom: 'Fermer', principal: false }])
  assert.doesNotMatch(halloween.corps, /presentoir-rond|presentoir-prix/)
  assert.match(feuille(await boutique('#theme-babel'))!.corps, /Il ne se vend pas\s: il se gagne avec/)
})

test('le rayon des fonds : sa carte en petit sur chaque décor — jamais ceux du trésor, ni les siens', async () => {
  const html = await boutique('#fonds')
  const tuiles = [...html.matchAll(/<button type="button" class="article-boutique article-fond" aria-haspopup="dialog" aria-label="([^"]+)"><span class="article-carte carte-fond fond-([\w-]+)" aria-hidden="true">/g)].map(m => ({ dit: m[1], cle: m[2] }))
  // Le club de jazz est à elle : il a quitté le rayon, et la boutique dit où le porter.
  assert.equal(tuiles.length, 11)
  assert.ok(!tuiles.some(t => t.cle === 'jazz'))
  assert.ok(tuiles.every(t => /, 250 confettis$/.test(t.dit)), 'à sa portée, tous')
  assert.deepEqual(tuiles.find(t => t.cle === 'vitrail'), { cle: 'vitrail', dit: 'Le Vitrail, Arts &amp; lettres, 250 confettis' })
  // On habille sa carte : son avatar sur chaque décor, le savoir du fond dessous.
  assert.equal(html.match(/<span class="article-carte carte-fond fond-[\w-]+" aria-hidden="true"><span class="[^"]*article-carte-avatar[^"]*"/g)?.length, 11)
  assert.match(html, /<b class="article-nom">Arts &amp; lettres<\/b>/)
  assert.match(html, /1 fond déjà à toi · <a class="link-inline" href="\/profil#fond">le porter<\/a>/)
  // Le trésor ne se vend pas : il ne sort que du coffre de la semaine, et la collection dit où.
  assert.doesNotMatch(html, /fond-dragon|fond-voie-lactee|Le Dragon d’or/)
  // La grande carte et ses douze pastilles sont parties : un décor ne se montrait qu'en le touchant.
  assert.doesNotMatch(html, /fond-pastille|cabine-des-fonds/)
  assert.equal(feuille(html), null, 'aucun présentoir avant le toucher')

  // `#fond-vitrail` — la fiche d'un fond dans « Ma collection » : son présentoir, sa carte posée dessus, son prénom.
  const vitrail = feuille(await boutique('#fond-vitrail'))
  assert.equal(vitrail?.titre, 'Le Vitrail')
  assert.match(vitrail!.corps, /<span class="fond-carte carte-fond fond-carte-grande fond-vitrail" aria-hidden="true"><span class="fond-carte-tete">/)
  assert.match(vitrail!.corps, /<b>Jeanne<\/b>/)
  assert.match(vitrail!.corps, /<span class="presentoir-sorte">Fond de carte · Arts &amp; lettres<\/span>/)
  assert.match(vitrail!.corps, /<b>🎊 250<\/b><span>Il t’en restera 🎊 170<\/span>/)
  // Un fond ne s'essaie plus à part : son présentoir le montre déjà sur sa carte. Un seul geste, et rien dans la barre de l'essai.
  assert.deepEqual(gestes(vitrail!.corps), [{ nom: 'L’acheter · 🎊 250', principal: true }])
  assert.doesNotMatch(vitrail!.corps, /boutique-panier/)
  // Celui qu'elle porte : ouvert par son adresse, il le dit, et ne se vend plus.
  const jazz = feuille(await boutique('#fond-jazz'))!
  assert.match(jazz.corps, /Il tapisse ta carte\./)
  assert.deepEqual(gestes(jazz.corps), [{ nom: 'Fermer', principal: false }])
})

test('les compagnons : les cinq sur une rangée, le présentoir de chacun, et l’essai dans la niche', async () => {
  const html = await boutique('#compagnons')
  const medaillons = [...html.matchAll(/<button type="button" class="compagnon-vitrine[^"]*"[^>]*aria-haspopup="dialog" aria-label="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(medaillons, ['Le Loup, encore 580', 'Le Chat des lanternes, encore 580', 'La Tortue-île, encore 580', 'La Luciole, encore 580', 'Le Panda roux, encore 580'])
  assert.match(html, /<ul class="rang-des-compagnons" aria-label="Les compagnons">/)
  assert.match(source('styles.css'), /\n\.rang-des-compagnons \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/)
  // Hors de portée : leur prix en gris.
  assert.equal(html.match(/<span class="article-prix article-prix-loin">🎊 1000<\/span>/g)?.length, 5)
  assert.equal(feuille(html), null, 'aucun présentoir avant le toucher')
  // `#compagnon-tortue` — « À la une », l'album : son présentoir, lui dans son médaillon, l'essayer dans sa niche.
  const tortue = feuille(await boutique('#compagnon-tortue'))
  assert.equal(tortue?.titre, 'La Tortue-île')
  assert.match(tortue!.corps, /aria-label="Caresser la tortue-île"/)
  assert.match(tortue!.corps, /<span class="presentoir-rang">3 sur 5<\/span>/)
  assert.deepEqual(gestes(tortue!.corps), [
    { nom: 'L’essayer', principal: false, presse: false },
    { nom: 'J’en ai envie', principal: true, presse: false },
  ])
})

/** Le comptoir : chaque ligne, son nom, son prix, s'il est hors de portée. */
function lignesDuComptoir(html: string) {
  return [...html.matchAll(/<button type="button" class="comptoir-objet objet-(\w+)" aria-haspopup="dialog">(.*?)<\/button>/g)].map(m => ({
    nom: /class="objet-nom">([^<]*)</.exec(m[2])?.[1],
    prix: /class="article-prix[^"]*">([^<]*)</.exec(m[2])?.[1],
    loin: /article-prix-loin/.test(m[2]),
  }))
}

test('le comptoir des objets : une ligne chacun, ce qu’il change, son présentoir avec la quantité', async () => {
  const comptoir = await boutique('#objets')
  assert.deepEqual(lignesDuComptoir(comptoir), [
    { nom: 'Vie', prix: '🎊 25', loin: false },
    { nom: 'Sablier', prix: '🎊 50', loin: false },
    // Pour ceux qui n'ont pas de chance (le 31 octobre 2026) — hors de portée de ses 420 confettis.
    { nom: 'Éclat', prix: '🎊 3000', loin: true },
  ])
  assert.match(comptoir, /<ul class="comptoir" aria-label="Les objets">/)
  assert.match(comptoir, /class="objet-dessin"><svg class="coeur-de-vie"/, 'la vie a son cœur')
  assert.match(comptoir, /class="objet-dessin"><svg class="sablier sablier-plein"/, 'le sablier, le sien')
  assert.match(comptoir, /class="objet-dessin"><svg class="gemme-d-eclat"/, 'l’Éclat, sa gemme')
  assert.match(comptoir, /Un jour manqué ne casse plus ta série\./, 'ce qu’il change pour elle')
  assert.match(comptoir, /class="comptoir-a-toi" aria-hidden="true"> Tu en as 0 sur 2\.</, 'ce qu’elle a de sabliers, sur sa ligne')
  assert.match(comptoir, /class="sr-only">Tu en as : 0 sur 2/, 'et en toutes lettres pour le lecteur d’écran')
  assert.equal(feuille(comptoir), null, 'aucun présentoir avant le toucher')

  // L'adresse d'un objet ouvre son présentoir — le lien de la série, au quiz du
  // jour : ce que c'est, son prix, combien on en prend, le total.
  const sablier = feuille(await boutique('#objet-sablier'))
  assert.equal(sablier?.titre, 'Sablier')
  assert.match(sablier!.corps, /<span class="presentoir-sorte">Série du quiz du jour<\/span><h3 class="presentoir-nom">Sablier<\/h3>/, 'où il sert')
  assert.match(sablier!.corps, /Un jour sans quiz du jour en prend un/, 'ce qu’il fait')
  assert.match(sablier!.corps, /Tu en as : 0 sur 2 · ta série : 0 jour/)
  assert.match(sablier!.corps, /aria-label="Combien : 1 sablier"/, 'la quantité, un d’abord')
  assert.match(sablier!.corps, /1 sablier · 🎊 50/)
  assert.deepEqual(gestes(sablier!.corps), [{ nom: 'Acheter · 🎊 50', principal: true }])
  // C'est là que mène la feuille de la série, au quiz du jour.
  const { adresseDeLObjet } = await import(client('components/Objets.tsx'))
  assert.equal(adresseDeLObjet('sablier'), '/boutique#objet-sablier')
  assert.match(source('views/JourApp.tsx'), /href=\{adresseDeLObjet\('sablier'\)\}/)

  // L'adresse d'avant, quand le rayon ne vendait que les vies, y mène encore.
  const vies = feuille(await boutique('#vies'))
  assert.equal(vies?.titre, 'Vie')
  assert.match(vies!.corps, /aria-label="Combien : 1 vie"/)
  // L'Éclat, hors de portée : son avatar tel qu'il est, puis éclaté, et son envie à la place de l'achat.
  const eclat = feuille(await boutique('#objet-eclat'))!
  assert.match(eclat.corps, /<span class="comptoir-eclat" aria-hidden="true">/)
  assert.match(eclat.corps, /Encore 🎊 2580 à gagner/)
  assert.deepEqual(gestes(eclat.corps), [{ nom: 'J’en ai envie', principal: true, presse: false }])
})

test('les adresses de la boutique mènent à leur rayon, et à leur présentoir', async () => {
  const { ceQueLAdresseOuvre } = await import(client('components/LaBoutique.tsx'))
  assert.deepEqual(ceQueLAdresseOuvre(''), { rayon: null, fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#compagnons'), { rayon: 'compagnons', fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#compagnon-chat'), { rayon: 'compagnons', fiche: { sorte: 'compagnon', cle: 'chat' } })
  assert.deepEqual(ceQueLAdresseOuvre('#compagnon-dragon'), { rayon: null, fiche: null }, 'un compagnon qui ne se vend pas')
  assert.deepEqual(ceQueLAdresseOuvre('#fonds'), { rayon: 'fonds', fiche: null })
  // Un fond a son présentoir, comme tout article — son adresse le posait sur la grande carte du rayon, à l'essai.
  assert.deepEqual(ceQueLAdresseOuvre('#fond-jazz'), { rayon: 'fonds', fiche: { sorte: 'fond', cle: 'jazz' } })
  assert.deepEqual(ceQueLAdresseOuvre('#fond-dragon'), { rayon: null, fiche: null }, 'un fond du trésor n’est pas en boutique')
  assert.deepEqual(ceQueLAdresseOuvre('#objets'), { rayon: 'objets', fiche: null })
  assert.deepEqual(ceQueLAdresseOuvre('#objet-eclat'), { rayon: 'objets', fiche: { sorte: 'objet', cle: 'eclat' } })
  assert.deepEqual(ceQueLAdresseOuvre('#vies'), { rayon: 'objets', fiche: { sorte: 'objet', cle: 'vie' } })
  assert.deepEqual(ceQueLAdresseOuvre('#theme-aurore'), { rayon: 'themes', fiche: { sorte: 'theme', cle: 'aurore' } })
  assert.deepEqual(ceQueLAdresseOuvre('#theme-ivoire'), { rayon: null, fiche: null }, 'un thème offert')
})

test('un achat se fait en deux touchers, au même endroit : « L’acheter », qui ne dépense rien, puis « Confirmer » — puis « Le porter » ou « Plus tard »', async () => {
  const theme_ = { sorte: 'theme', etat: 'a-vendre', prix: 250 } as const
  // La fiche, puis la confirmation, puis ce qu'on en fait : deux gestes à chaque étape, le geste attendu à droite.
  assert.deepEqual(gestesDuPresentoir({ ...theme_, etape: 'fiche' }), [
    { geste: 'essayer', nom: 'L’essayer', presse: false },
    { geste: 'acheter', nom: 'L’acheter · 🎊 250', principal: true },
  ])
  assert.deepEqual(gestesDuPresentoir({ ...theme_, etape: 'confirmer' }), [
    { geste: 'annuler', nom: 'Annuler' },
    { geste: 'confirmer', nom: 'Confirmer · 🎊 250', principal: true },
  ])
  assert.deepEqual(gestesDuPresentoir({ sorte: 'theme', etat: 'a-toi', prix: 250, etape: 'achete', aPorter: true }), [
    { geste: 'fermer', nom: 'Plus tard' },
    { geste: 'porter', nom: 'Le porter', principal: true },
  ])
  // Chaque sorte a ses mots : un compagnon s'adopte et s'installe, un fond se pose, un objet s'achète — et n'a rien à porter.
  assert.equal(gestesDuPresentoir({ sorte: 'compagnon', etat: 'a-vendre', prix: 1000, etape: 'fiche' })[1].nom, 'L’adopter · 🎊 1000')
  assert.equal(gestesDuPresentoir({ sorte: 'compagnon', etat: 'a-toi', prix: 1000, etape: 'achete', aPorter: true })[1].nom, 'L’installer')
  assert.equal(gestesDuPresentoir({ sorte: 'fond', etat: 'a-toi', prix: 250, etape: 'achete', aPorter: true })[1].nom, 'Le poser')
  assert.deepEqual(gestesDuPresentoir({ sorte: 'fond', etat: 'a-vendre', prix: 250, etape: 'fiche' }), [{ geste: 'acheter', nom: 'L’acheter · 🎊 250', principal: true }], 'un fond ne s’essaie pas à part')
  assert.deepEqual(gestesDuPresentoir({ sorte: 'objet', etat: 'a-vendre', prix: 50, etape: 'fiche' }), [{ geste: 'acheter', nom: 'Acheter · 🎊 50', principal: true }])
  assert.deepEqual(gestesDuPresentoir({ sorte: 'objet', etat: 'a-vendre', prix: 50, etape: 'achete' }), [{ geste: 'fermer', nom: 'Fermer', principal: true }])
  // Un compagnon que sa niche vide a déjà accueilli : rien à choisir.
  assert.deepEqual(gestesDuPresentoir({ sorte: 'compagnon', etat: 'a-toi', prix: 1000, etape: 'achete', aPorter: false }), [{ geste: 'fermer', nom: 'Fermer', principal: true }])
  // Trop cher : son envie à la place de l'achat — et jamais de « Confirmer », même ouvert sur cette étape (« Garder »).
  for (const etape of ['fiche', 'confirmer'] as const) {
    assert.deepEqual(gestesDuPresentoir({ sorte: 'theme', etat: 'trop-cher', prix: 1000, etape, sonEnvie: true }), [
      { geste: 'essayer', nom: 'L’essayer', presse: false },
      { geste: 'envie', nom: 'J’en ai envie', presse: true, principal: false },
    ])
  }
  // Plusieurs vies d'un coup, au-delà de son solde : le geste dit ce qui manque, éteint.
  assert.deepEqual(gestesDuPresentoir({ sorte: 'objet', etat: 'a-vendre', prix: 75, manque: 30, etape: 'fiche' }), [{ geste: 'acheter', nom: 'Il te manque 30 confettis', eteint: true }])
  assert.equal(gestesDuPresentoir({ sorte: 'objet', etat: 'a-vendre', prix: 26, manque: 1, etape: 'fiche' })[0].nom, 'Il te manque 1 confetti')
  // Déjà à lui, hors saison, un sablier de trop : rien ne s'y achète.
  for (const etat of ['a-toi', 'ferme'] as const) assert.deepEqual(gestesDuPresentoir({ sorte: 'theme', etat, prix: 250, etape: 'fiche' }), [{ geste: 'fermer', nom: 'Fermer' }])
  // Un seul geste attendu par étape, au plus : l'or plein.
  for (const sorte of ['theme', 'compagnon', 'fond', 'objet'] as const)
    for (const etape of ['fiche', 'confirmer', 'achete'] as const)
      for (const etat of ['a-vendre', 'trop-cher', 'a-toi', 'ferme'] as const) {
        const g = gestesDuPresentoir({ sorte, etape, etat, prix: 100, aPorter: true })
        assert.ok(g.length >= 1 && g.length <= 2, `${sorte} ${etape} ${etat}`)
        assert.ok(g.filter(x => x.principal).length <= 1, `${sorte} ${etape} ${etat}`)
      }

  // Le présentoir ouvert sur « Confirmer » — « Garder », dans la barre de l'essai — : ni flèches ni étoile, ce qu'on confirme ne bouge plus.
  const confirmer = await presentoir({ sorte: 'theme', cle: 'ocean' }, { etapeDeDepart: 'confirmer' })
  assert.deepEqual(gestes(confirmer), [
    { nom: 'Annuler', principal: false },
    { nom: 'Confirmer · 🎊 250', principal: true },
  ])
  assert.doesNotMatch(confirmer, /presentoir-rond/)
  // Sans de quoi : il retombe sur la fiche, qui dit ce qui manque.
  assert.deepEqual(gestes(await presentoir({ sorte: 'theme', cle: 'aurore' }, { etapeDeDepart: 'confirmer' })).map(g => g.nom), ['L’essayer', 'J’en ai envie'])

  // « L'acheter » ne dépense rien : seul « Confirmer » appelle le serveur, et achète sans porter — on choisit ensuite.
  const code = source('components/Presentoir.tsx')
  assert.match(code, /if \(g\.geste === 'acheter'\) return aller\('confirmer'\)/)
  const confirmation = code.slice(code.indexOf('const confirmer = async'), code.indexOf('const porter = async'))
  assert.match(confirmation, /if \(t\) return acheter\(t\.key, false\)\s*if \(c\) return acheterCompagnon\(c\.key, installe\)\s*if \(f\) return acheterFond\(f\.key, false\)/)
  assert.match(confirmation, /await comptoir\.acheter\(o!, nombre\)/)
  assert.equal(code.match(/\bacheter\(t\.key|acheterCompagnon\(c\.key|acheterFond\(f\.key|comptoir\.acheter\(/g)?.length, 4, 'nulle part ailleurs')
  // Plus de dialogue posé sur la feuille : « Acheter et porter », « L'acheter seulement », « Plus tard » se lisaient avant d'avoir rien acheté.
  for (const f of ['LaBoutique', 'Presentoir', 'Boutique', 'RayonDesCompagnons', 'RayonDesFonds', 'Comptoir', 'PanierDeLaBoutique']) {
    assert.doesNotMatch(source(`components/${f}.tsx`), /choixDialog|confirmDialog/, f)
  }
  // « Confirmer » tombe sous « L'acheter » : les deux gestes gardent leurs parts d'une étape à l'autre, et le focus suit le geste attendu.
  assert.match(source('styles.css'), /\n\.presentoir-gestes \{ display: grid; grid-template-columns: minmax\(0, 2fr\) minmax\(0, 3fr\); gap: 8px; \}/)
  assert.match(code, /gestesAuPied\.current\?\.querySelector<HTMLElement>\('\.btn-primary'\)\?\.focus\(\{ preventScroll: true \}\)\s*\}, \[ici\.etape\]\)/)
})

test('son envie — l’article pour lequel on économise — se suit en tête de la boutique, sur sa tuile et dans son présentoir', async () => {
  const avecEnvie = (envie: { sorte: string; cle: string }): Profil => ({ ...JEANNE, boutique: { ...JEANNE.boutique, envie } })
  const html = await boutique('', avecEnvie({ sorte: 'theme', cle: 'aurore' }))
  // Sa carte, sous la rangée des rayons : ce qu'elle vise, sa jauge, ce qui manque.
  assert.match(html, /<\/nav><button type="button" class="carte-envie" aria-haspopup="dialog" aria-label="Ton envie : Aurore boréale, encore 580 confettis">/)
  assert.match(html, /<span class="carte-envie-nom">Ton envie · <b>Aurore boréale<\/b><\/span><span class="jauge-fine" aria-hidden="true"><span style="width:42%"><\/span><\/span>/)
  assert.match(html, /<span class="carte-envie-reste">encore<b>🎊 580<\/b><\/span>/)
  // Sa tuile la marque, et le dit à l'oreille.
  assert.match(html, /aria-label="Aurore boréale, Légendaire, 1000 confettis, encore 580, ton envie">.*?<span class="article-marque"><svg[^>]*>.*?<\/svg>envie<\/span>/)
  assert.equal(html.match(/, ton envie"/g)?.length, 1, 'une envie à la fois')
  // Dans son présentoir : l'étoile pressée, et « J'en ai envie » n'est plus le geste attendu — c'est fait.
  const aurore = await presentoir({ sorte: 'theme', cle: 'aurore' }, { profil: avecEnvie({ sorte: 'theme', cle: 'aurore' }) })
  assert.match(aurore, /class="presentoir-rond presentoir-etoile" aria-pressed="true" aria-label="En faire mon envie"/)
  assert.deepEqual(gestes(aurore)[1], { nom: 'J’en ai envie', principal: false, presse: true })
  // À sa portée : la carte le dit, et l'ouvre.
  const aPortee = await boutique('', avecEnvie({ sorte: 'theme', cle: 'ocean' }))
  assert.match(aPortee, /aria-label="Ton envie : Océan, à ta portée">/)
  assert.match(aPortee, /<span class="carte-envie-reste"><b>À ta portée<\/b><\/span>/)
  // Toute sorte d'article : un compagnon, un fond, un objet du comptoir.
  assert.match(await boutique('', avecEnvie({ sorte: 'compagnon', cle: 'chat' })), /aria-label="Ton envie : Le Chat des lanternes, encore 580 confettis">.*aria-label="Le Chat des lanternes, encore 580, ton envie"/)
  assert.match(await boutique('', avecEnvie({ sorte: 'fond', cle: 'vitrail' })), /aria-label="Ton envie : Le Vitrail, à ta portée">.*aria-label="Le Vitrail, Arts &amp; lettres, 250 confettis, ton envie"/)
  assert.match(await boutique('', avecEnvie({ sorte: 'objet', cle: 'eclat' })), /aria-label="Ton envie : Éclat, encore 2580 confettis">.*<span class="sr-only">Ton envie\.<\/span>/)
  // C'est le serveur qui la retient, et la refuse en clair ; un objet se rachète : acheté, la page retire son envie.
  assert.match(source('components/LaBoutique.tsx'), /const r = await api\.joueur\.envie\(voulue\)\s*onEnvie\(r\.envie\)\s*return null\s*\} catch \(e\) \{\s*return motifDe\(e\)/)
  assert.match(source('components/Presentoir.tsx'), /if \(o && sonEnvie\) void onEnvie\(null\)/)
  assert.match(source('views/ProfilApp.tsx'), /boutique: envie \? \{ \.\.\.sansEnvie, envie \} : sansEnvie/)
})

test('le panier compte ce qu’on essaie et qui s’achète — jamais ce qu’on a, ni ce qui ne se vend pas', () => {
  const deja = { themes: ['velours', 'ivoire', 'neige'], compagnons: ['loup'], jour: '2026-09-29' }
  const lignes = lignesDuPanier({ theme: 'aurore', compagnon: 'chat' }, deja)
  assert.deepEqual(lignes, [
    { sorte: 'theme', cle: 'aurore', nom: 'Aurore boréale', detail: 'Thème · Légendaire', prix: 1000 },
    { sorte: 'compagnon', cle: 'chat', nom: 'Le Chat des lanternes', detail: 'Compagnon', prix: 1000 },
  ])
  assert.equal(totalDuPanier(lignes), 2000)
  assert.equal(ceQuiManque(lignes, 420), 1580)
  assert.equal(ceQuiManque(lignes, 3000), 0)
  // Une soirée retirée a repris ses confettis : le solde sous zéro manque d'autant.
  assert.equal(ceQuiManque(lignes.slice(0, 1), -30), 1030)
  // Ce qu'elle a s'essaie — le loup qu'elle a déjà, Neige — sans entrer au panier.
  assert.deepEqual(lignesDuPanier({ compagnon: 'loup', theme: 'neige' }, deja), [])
  // Un thème offert, un thème hors de sa saison, une clé inconnue : rien.
  assert.deepEqual(lignesDuPanier({ theme: 'velours' }, deja), [])
  assert.deepEqual(lignesDuPanier({ theme: 'halloween' }, deja), [], 'Halloween, fin septembre')
  assert.equal(lignesDuPanier({ theme: 'halloween' }, { ...deja, jour: '2026-10-31' }).length, 1, 'pendant sa saison')
  assert.deepEqual(lignesDuPanier({ compagnon: 'dragon' }, deja), [])
  assert.deepEqual(sansLaSorte({ theme: 'aurore', compagnon: 'chat' }, 'theme'), { compagnon: 'chat' })
  // Un fond ne s'essaie plus à part : son présentoir le montre sur sa carte, et il n'entre jamais dans la barre de l'essai.
  assert.deepEqual(SORTES_DU_PANIER, ['theme', 'compagnon'])
})

test('l’essai habille la page et la niche, attend dans une barre au-dessus du menu, et quitter la boutique rend tout', async () => {
  // Le thème essayé passe par l'essai de la loge (`essayerTheme`, `finirLEssai`) ; le compagnon, par la niche (`essayerNiche`).
  const code = source('components/LaBoutique.tsx')
  assert.match(code, /if \(essai\.theme\) void essayerTheme\(essai\.theme\)\s*else finirLEssai\(\)/)
  assert.match(code, /useEffect\(\(\) => essayerNiche\(essai\.compagnon \?\? null\), \[essai\.compagnon\]\)/)
  assert.match(code, /\(\) => \(\) => \{\s*finirLEssai\(\)\s*essayerNiche\(null\)\s*\}/)
  // Gardé ou porté, le thème essayé devient le sien sans repasser par l'ancien.
  assert.match(code, /if \(l\.sorte === 'theme'\) finirLEssai\(true\)/)
  assert.match(code, /if \(article\.sorte === 'theme' && essai\.theme === article\.cle\) finirLEssai\(true\)/)
  // La barre : un seul article — son prix et son nom, la croix qui le retire, « Garder », qui ouvre son présentoir sur
  // « Confirmer » ; plusieurs — leur compte, « Voir ».
  const { BarreDuPanier, FeuilleDuPanier } = await import(client('components/PanierDeLaBoutique.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const deja = { themes: ['velours'], compagnons: [], jour: '2026-09-29' }
  const barre = (essai: object) => renderToStaticMarkup(React.createElement(BarreDuPanier, { lignes: lignesDuPanier(essai, deja), onRetirer: () => {}, onGarder: () => {}, onVoir: () => {} }))
  const un = barre({ compagnon: 'chat' })
  assert.match(un, /<div class="boutique-panier" role="region" aria-label="Ton essai">/)
  assert.match(un, /<span class="boutique-panier-texte"><span class="boutique-panier-sur">À l’essai · 🎊 1000<\/span><b>Le Chat des lanternes<\/b><\/span>/)
  assert.match(un, /<button type="button" class="boutique-panier-annuler" aria-label="Retirer Le Chat des lanternes de l’essai">/)
  assert.match(un, /<button type="button" class="btn btn-primary" aria-haspopup="dialog">Garder<\/button>/)
  const deux = barre({ compagnon: 'chat', theme: 'ocean' })
  assert.match(deux, /<span class="boutique-panier-sur">À l’essai · 🎊 1250<\/span><b>2 articles<\/b>/)
  assert.match(deux, /aria-label="Tout retirer de l’essai"/)
  assert.match(deux, />Voir<\/button>/)
  assert.match(code, /onGarder=\{l => ouvrir\(\{ sorte: l\.sorte, cle: l\.cle \}, 'confirmer'\)\}/)
  // Ce qu'on essaie, à plusieurs : chaque ligne et sa croix, le total, ce qui manque, « Tout retirer » ou « Tout garder ».
  const lignes = lignesDuPanier({ compagnon: 'chat', theme: 'ocean' }, deja)
  const ceQuOnEssaie = (solde: number) => renderToStaticMarkup(React.createElement(FeuilleDuPanier, { lignes, solde, busy: false, pris: null, onRetirer: () => {}, onGarder: () => {}, onFermer: () => {} }))
  const riche = ceQuOnEssaie(2000)
  assert.equal(feuille(riche)?.titre, 'Ce que tu essaies')
  assert.deepEqual([...riche.matchAll(/aria-label="Retirer ([^"]+) de l’essai"/g)].map(m => m[1]), ['Océan', 'Le Chat des lanternes'])
  assert.match(riche, /<p class="panier-total"><span>Total<\/span><b>🎊 1250<\/b><\/p>/)
  assert.match(riche, /<button type="button" class="btn btn-ghost">Tout retirer<\/button><button type="button" class="btn btn-primary">Tout garder · 🎊 1250<\/button>/)
  const pauvre = ceQuOnEssaie(420)
  assert.match(pauvre, /Il te manque 🎊 830 pour tout garder/)
  assert.match(pauvre, /<button type="button" class="btn btn-primary" aria-disabled="true">Tout garder · 🎊 1250<\/button>/)
  // Plus de cases à cocher ni de « Les porter tout de suite » : ce qu'on garde d'ici, on le porte — la page le montre déjà.
  assert.doesNotMatch(riche, /type="checkbox"|porter tout de suite/)
})

test('son solde se touche : « Tes confettis » dit d’où ils viennent', async () => {
  const { FeuilleDesConfettis } = await import(client('components/LaBoutique.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(FeuilleDesConfettis, { solde: 420, onFermer: () => {} }))
  assert.equal(feuille(html)?.titre, 'Tes confettis')
  assert.match(html, /<p class="confettis-solde">🎊 420<\/p>/)
  assert.match(html, /Une bonne réponse, un confetti/)
  assert.deepEqual(
    [...html.matchAll(/<li>(?:<span>|<a class="link-inline" href="[^"]+">)([^<]+)<\/(?:span|a)><span>([^<]+)<\/span><\/li>/g)].map(m => `${m[1]} — ${m[2]}`),
    [
      'Le quiz du jour — jusqu’à 10 par jour',
      'La campagne, les sentiers, les duels — 1 par bonne réponse',
      'Une soirée entre amis — 1 par bonne réponse',
      'Les missions du jour — jusqu’à 60 par jour',
      'Le coffre de la semaine — en plus',
    ],
  )
  assert.match(html, /<a class="btn btn-primary" href="\/jour">Jouer le quiz du jour<\/a>/)
  // Une soirée retirée a repris ses confettis : elle le dit là, et la page aussi.
  assert.match(renderToStaticMarkup(React.createElement(FeuilleDesConfettis, { solde: -30, onFermer: () => {} })), /Ce que tu as acheté te reste\./)
  // En tête de la page : un bouton, sur une cible de doigt.
  assert.match(source('views/ProfilApp.tsx'), /<button type="button" className="solde-puce" aria-haspopup="dialog" title="Une bonne réponse, un confetti" onClick=\{\(\) => setConfettis\(true\)\}>/)
  assert.match(source('styles.css'), /\n\.solde-puce \{[^}]*min-height: 44px;/)
})

test('la rangée des rayons, collée en haut, tient en entier à côté de la niche, boîte comprise : rien ne passe sous elle quand la page défile', async () => {
  // Le retour du propriétaire du 2 novembre 2026 : « lorsque l'on scroll vers le bas, la barre thèmes / compagnons […] est
  // superposée avec la niche ». Un `padding-right` sur la bande ne gardait que la fin de ce qui défile : « Fonds » et « Objets »
  // passaient sous elle, repliée au coin. La bande colle de bord à bord, sur son sol plein ; ses segments défilent dans un cadre à
  // eux, qui s'arrête avant la niche par sa marge — la règle de toute première ligne (`margin-right`, pas `padding-right`).
  const html = await boutique()
  assert.match(html, /<nav class="boutique-rayons" aria-label="Les rayons de la boutique"><div class="boutique-rayons-defile"><a href="#themes"/)
  const css = source('styles.css')
  const regle = (selecteur: string) => new RegExp(`(?:^|\\n)${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
  // Et la place qu'il lui garde est celle de la niche repliée, pas dépliée : avec ses 60 pixels, « Objets » passait derrière
  // la marge (« on ne voit plus la barre », le même jour) ; un seul cadre, des segments qui se partagent sa largeur, tient les
  // quatre rayons à côté d'elle en 360 de large — mesuré au navigateur, rien ne déborde.
  assert.match(regle('body.avec-niche .boutique-rayons-defile'), /margin-right: var\(--niche-repliee\);/)
  assert.match(css, /\nbody\.avec-niche \{ --niche-repliee: 40px; \}/)
  assert.match(regle('.boutique-rayons a'), /flex: 1 0 auto;/, 'les segments se partagent la largeur')
  // Une cible de doigt : 36 px jusqu'au 10 novembre 2026.
  assert.match(regle('.boutique-rayons a'), /min-height: 44px;/)
  assert.match(regle('.boutique-rayons-defile'), /overflow-x: auto;/, 'ce qui défile, au texte agrandi, c’est le cadre des rayons')
  assert.doesNotMatch(regle('.boutique-rayons'), /overflow/, 'pas la bande, qui garde sa largeur et son sol')
  assert.doesNotMatch(css, /body\.avec-niche \.boutique-rayons \{/, 'plus de retrait sur la bande elle-même')
  // Et la niche reste en vue sous la rangée collée — on y essaie un compagnon : la boutique ne rejoint pas les pages à tête collée, qui l'effacent.
  assert.doesNotMatch(/body:has\(([^)]*)\) \.niche\.repliee/.exec(css)?.[1] ?? '', /boutique/)
})

test('la barre fine des onglets, que la boutique a quittée, garde son trait sous le texte — au quiz du jour et au défi, dans « Décorer »', () => {
  const css = source('styles.css')
  const regle = (selecteur: string) => css.slice(css.indexOf(`${selecteur} {`)).split('}')[0]
  assert.match(regle('.onglets.onglets-fins'), /border: 0/)
  assert.match(regle('.onglets.onglets-fins'), /border-bottom: 1px solid var\(--edge\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /border-bottom-color: var\(--accent\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /box-shadow: none/)
})

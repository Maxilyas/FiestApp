// Le classement des collections ne bouge plus sous le doigt.
//
// « J'ai vu un bug dans le classement des collections, ça a l'air de “bouger”
// quand on navigue dedans, je ne sais pas trop comment décrire, mais on dirait
// que c'est instable » (le propriétaire, le 9 novembre 2026). Filmé image par
// image en 360 × 640 (`rendu-collectionneurs.ts`, sa passe « ce qui bouge »),
// quatre choses bougeaient :
//
// - sa place, en tête, changeait de hauteur avec la catégorie — de 74 à 107
//   pixels —, et tout ce qui la suit sautait d'autant : les puces, sous le
//   doigt qui venait de les toucher ;
// - une carte du podium grandissait de 26 pixels quand son joueur garde un
//   Divin : le troisième plus haut que le deuxième, le podium de 162 à 187
//   pixels d'une catégorie à l'autre, la liste poussée d'autant ;
// - d'une catégorie à l'autre, seules les lignes que la page déplaçait
//   rejouaient leur entrée — deux sur sept, jamais les mêmes ;
// - dans la vitrine d'un joueur, ses tableaux s'écrivaient d'abord, puis ses
//   pièces maîtresses se posaient au-dessus en arrivant : 228 pixels de saut.
//
// Et, en sortant la vue de la page en fonction pure : onzième, on lisait le
// dixième deux fois, de part et d'autre de « Voir la suite ».
//
// Pas de navigateur : le vrai classement du serveur, la vue pure que la page
// en tire, ses composants rendus en HTML, et la feuille de style. Le rendu se
// regarde par le script ; ici, ce qui le décide. Chaque épreuve échouait avant.
//
// Depuis le 10 novembre 2026, il garde aussi le premier écran (plus bas) : la
// page s'est resserrée pour montrer son podium sans défiler, et ce qui se
// resserre ne devait rien faire bouger de plus.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { Collectionneurs, TETE_DU_CLASSEMENT, type DepsDesCollectionneurs, type ProfilDuCollectionneur } from '../src/core/collectionneurs'
import { LEGENDAIRES } from '../../shared/legendaires'
import {
  CATEGORIES_DE_COLLECTION,
  CERCLES_DE_COLLECTION,
  vueDuClassement,
  vuesDuClassement,
  type ClassementDesCollections,
  type FicheDeCollectionneur,
  type VitrineDUnCollectionneur,
} from '../../shared/collectionneurs'
import type { ProfileRec } from '../src/auth/profiles'

// Le client compile son JSX pour un `React` global, et ses routes lisent l'adresse en s'évaluant.
Object.assign(globalThis, { React, window: { location: { pathname: '/collectionneurs', search: '', hash: '', origin: 'http://banc' } } })

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const CSS = source('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const REGLES = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ selecteurs: sel.split(',').map(s => s.trim()), corps }))

/** Le corps de la règle qui porte ce sélecteur. */
function regle(selecteur: string): string {
  const r = REGLES.find(r => r.selecteurs.includes(selecteur))
  assert.ok(r, `la règle ${selecteur} existe`)
  return r.corps
}

async function rendu(composant: string, props: object): Promise<string> {
  const module = await import(new URL('../../client/src/views/Collectionneurs.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  assert.ok(module[composant], `${composant} est un composant de la page`)
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const NOMS = ['Agathe', 'Basile', 'Clara', 'Denis', 'Elsa', 'Farid', 'Gaëlle', 'Hugo', 'Inès', 'Jules', 'Karim', 'Léa', 'Max', 'Nina']
const id = (i: number) => `p${String(i + 1).padStart(2, '0')}`

/** Quatorze collectionneurs, du niveau 30 au niveau 17 : au niveau, chacun sa place, dans l'ordre. Un légendaire chacun : tous ex æquo. */
const profil = (i: number): ProfilDuCollectionneur => ({
  id: id(i),
  nom: NOMS[i],
  creeLe: i,
  avatar: '🦊',
  apparence: {},
  bordure: null,
  niveau: 30 - i,
  legendaires: [LEGENDAIRES[0].key],
  scelles: [],
  divins: [],
  compagnons: [],
  eclatsPoses: 0,
  eclates: [],
  matieres: {},
  portees: {},
  hautsFaits: [],
  prix: [],
  calendrier: { pages: [], dorees: [], mois: '', joursCeMois: 0 },
  titresDates: [],
  sentiers: {},
  bordures: [],
  themes: [],
  fonds: [],
  gerbes: [],
  finitions: ['mat'],
  timbres: 0,
})

/** Le vrai classement du serveur, sur des magasins inventés : ce que la page de `moi` reçoit, ses amis compris. */
async function classement(moi: string, amis: string[] = []): Promise<{ etat: ClassementDesCollections; fiches: Map<string, FicheDeCollectionneur>; serveur: Collectionneurs }> {
  const ids = NOMS.map((_, i) => id(i))
  const deps: DepsDesCollectionneurs = {
    profiles: {
      byIds: async (lus: readonly string[]) => lus.map(x => ({ id: x, name: x, createdAt: 0 }) as ProfileRec),
      cached: () => undefined,
      idsExistants: async () => new Set(ids),
      collectionDe: (p: ProfileRec) => profil(ids.indexOf(p.id)),
      themesAchetes: async () => new Map(),
      lireLaMeta: async () => null,
      ecrireLaMeta: async () => {},
    } as unknown as DepsDesCollectionneurs['profiles'],
    campagne: {
      collectionneurDe: async () => ({ paliers: {}, amis }),
      paliersDeTous: async () => new Map(),
      liguesDeTous: async () => new Map(),
    } as unknown as DepsDesCollectionneurs['campagne'],
    jour: {
      resumeDe: async () => ({ joues: 0, victoires: 0 }),
      resumesDeTous: async () => new Map(),
      estMasque: () => false,
      versionDesExclus: () => '0#0',
    } as unknown as DepsDesCollectionneurs['jour'],
  }
  const serveur = new Collectionneurs(deps)
  await serveur.relever()
  const etat = await serveur.pour(moi)
  return { etat, fiches: new Map(etat.fiches.map(f => [f.id, f])), serveur }
}

test('onzième, le dixième ne s’écrit pas deux fois : ses voisins sont ceux que la liste ne montre pas', async () => {
  const { etat, fiches } = await classement(id(10))
  // Ce que le serveur envoie : sa tête, et autour de lui — le dixième, lui, le douzième.
  assert.deepEqual(
    etat.categories.niveau.tete.map(p => p.id),
    Array.from({ length: TETE_DU_CLASSEMENT }, (_, i) => id(i)),
  )
  assert.deepEqual(
    etat.categories.niveau.autour.map(p => p.id),
    [id(9), id(10), id(11)],
  )
  const vue = vueDuClassement(etat, fiches, 'niveau', 'tous')
  assert.deepEqual(
    vue.autour.map(p => p.fiche.nom),
    ['Karim', 'Léa'],
    'Jules, dixième, ferme la liste : il ne rouvre pas ses voisins',
  )
  const montres = [...vue.tete, ...vue.autour].map(p => p.fiche.id)
  assert.equal(new Set(montres).size, montres.length, 'personne deux fois sur la page')
  assert.deepEqual([vue.place?.rang, vue.classes, vue.restants], [11, 14, 4])
  assert.deepEqual([vue.devant?.fiche.nom, vue.devant?.manque], ['Jules', 2], 'celui à passer : le dixième, à un niveau de lui')
})

test('la suite lue prolonge la liste, chacun une fois, et ses voisins s’effacent quand elle descend jusqu’à lui', async () => {
  const { etat, fiches, serveur } = await classement(id(12))
  const suite = await serveur.suite('niveau', TETE_DU_CLASSEMENT)
  for (const f of suite.fiches) if (!fiches.has(f.id)) fiches.set(f.id, f)
  // Un relevé qui a bougé entre deux paquets renvoie quelqu'un de la tête : il ne s'écrit qu'une fois.
  const vue = vueDuClassement(etat, fiches, 'niveau', 'tous', { places: [etat.categories.niveau.tete[9], ...suite.places], finie: true })
  assert.deepEqual(
    vue.tete.map(p => p.fiche.id),
    NOMS.map((_, i) => id(i)),
  )
  assert.deepEqual([vue.autour.length, vue.restants], [0, 0])
  assert.deepEqual([vue.devant?.fiche.nom, vue.devant?.manque], ['Léa', 2])
  // Entre amis, reclassés par la page, lui compris : sa place parmi eux.
  const entreAmis = await classement(id(12), [id(0), id(13)])
  const amis = vueDuClassement(entreAmis.etat, entreAmis.fiches, 'niveau', 'amis')
  assert.deepEqual(
    amis.tete.map(p => [p.fiche.nom, p.rang]),
    [
      ['Agathe', 1],
      ['Max', 2],
      ['Nina', 3],
    ],
  )
  assert.deepEqual([amis.place?.rang, amis.classes, amis.tous, amis.devant?.fiche.nom], [2, 3, 3, 'Agathe'])
})

test('sa place tient la même case dans chaque catégorie et chaque cercle : changer de puce ne déplace rien dessous', async () => {
  const { etat, fiches } = await classement(id(10), [id(0)])
  const vues = vuesDuClassement(etat, fiches)
  const html = await rendu('SaPlace', { moi: fiches.get(etat.moi), vues, c: 'niveau', cercle: 'tous' })
  const cases = [...html.matchAll(/<span class="cl-sa-place-texte"( aria-hidden="true")?>(.*?)<\/span>(?=<span class="cl-sa-place-texte"|<\/span><\/section>)/g)]
  assert.equal(cases.length, CATEGORIES_DE_COLLECTION.length * CERCLES_DE_COLLECTION.length, 'une case par catégorie et par cercle')
  const montrees = cases.filter(c => !c[1])
  assert.equal(montrees.length, 1, 'une seule se montre')
  const texte = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  assert.equal(texte(montrees[0][2]), 'Tu es 11ᵉ sur 14 niveau 20 Encore 2 niveaux pour passer Jules')
  // Les autres s'écrivent d'avance, cachées : la plus haute donne sa hauteur au bloc.
  const cachees = cases.filter(c => c[1]).map(c => texte(c[2]))
  assert.ok(cachees.includes('Tu es 2ᵉ sur 2 niveau 20 Encore 11 niveaux pour passer Agathe'), `entre amis, au niveau : ${cachees.join(' | ')}`)
  assert.ok(
    cachees.some(t => t.startsWith('Pas encore au classement')),
    'ce qu’il n’a pas, aussi',
  )
  // Toutes dans la même case de la grille, une seule visible — et rien à lire deux fois pour un lecteur d'écran.
  assert.match(regle('.cl-sa-place-cases'), /display:\s*grid/)
  assert.match(regle('.cl-sa-place-cases > .cl-sa-place-texte'), /grid-area:\s*1\s*\/\s*1/)
  assert.match(regle(".cl-sa-place-cases > [aria-hidden='true']"), /visibility:\s*hidden/)
  // La même page, une autre puce : les mêmes cases, une autre montrée — le bloc ne change pas de contenu, donc pas de taille.
  const ailleurs = await rendu('SaPlace', { moi: fiches.get(etat.moi), vues, c: 'legendaires', cercle: 'amis' })
  const sansEtat = (h: string) => texte(h.replace(/ aria-hidden="true"/g, ''))
  assert.equal(sansEtat(ailleurs), sansEtat(html))
})

test('une carte du podium garde la taille de son rang : ses Divins ne la grandissent pas', () => {
  // Posée sous sa valeur, leur pastille ajoutait 26 pixels à la carte : hors du flux, à cheval sur son pied.
  const pastille = regle('.cl-carte .cl-opale-pastille')
  assert.match(pastille, /position:\s*absolute/)
  assert.doesNotMatch(pastille, /margin-top/)
  assert.match(regle('.cl-carte-dedans'), /position:\s*relative/, 'elle se pose sur l’intérieur de la carte')
  // Le podium lui garde la place dessous, qu'un Divin y soit ou non : la liste ne monte ni ne descend.
  const [, bas] = /margin:\s*\S+\s+\S+\s+(\d+)px/.exec(regle('.cl-podium')) ?? []
  const [, depasse] = /bottom:\s*-(\d+)px/.exec(pastille) ?? []
  assert.ok(Number(depasse) > 0 && Number(bas) + 10 > Number(depasse), `la pastille dépasse de ${depasse} px, le podium garde ${bas} px et la liste 10`)
})

test('les lignes du classement ne rejouent pas leur entrée d’une catégorie à l’autre', () => {
  // Les lignes de tous les classements entrent en glissant…
  assert.match(regle('.lb-row'), /animation:\s*slide-in/)
  // … pas celles-ci : la page en déplace quelques-unes à chaque puce, et elles seules repartaient.
  assert.match(regle('.cl-liste .lb-row'), /animation:\s*none/)
  // Aucune règle plus précise ne la leur rend.
  const rendue = REGLES.filter(r => r.selecteurs.some(s => /\.cl-(liste|ligne)\b/.test(s)) && /animation(-name)?:\s*(?!none|\s)/.test(r.corps))
  assert.deepEqual(
    rendue.map(r => r.selecteurs.join(', ')),
    [],
  )
})

test('la vitrine s’ouvre sur son nom, sa collection arrive d’un bloc : rien de ce qu’on lit ne descend', async () => {
  const { etat, fiches, serveur } = await classement(id(10))
  const gestes = { onComparer: () => {}, onCarte: () => {}, onFermer: () => {} }
  const lui = fiches.get(id(0))!
  // Avant sa réponse : qui il est, de la fiche que la page a déjà — et pas un tableau, que ses pièces pousseraient.
  const avant = await rendu('VitrineOuverte', { id: lui.id, moi: fiches.get(etat.moi), connue: lui, vitrine: null, erreur: '', ...gestes })
  assert.match(avant, /class="carte-feuille cl-vitrine-feuille"/)
  assert.match(avant, /La vitrine de Agathe/)
  assert.match(avant, /class="cl-vitrine-tete"/)
  assert.match(avant, /Chargement…/)
  assert.doesNotMatch(avant, /cl-gemmes|cl-style-pieces|cl-socles/)
  assert.match(avant, /Comparer/, 'ses gestes sont déjà là')
  // À l'arrivée : ses pièces maîtresses, puis ses tableaux, dans l'ordre.
  const vitrine = (await serveur.vitrine(etat.moi, lui.id)) as VitrineDUnCollectionneur
  assert.ok(vitrine.pieces.length > 0)
  const apres = await rendu('VitrineOuverte', { id: lui.id, moi: fiches.get(etat.moi), connue: lui, vitrine, erreur: '', ...gestes })
  assert.doesNotMatch(apres, /Chargement…/)
  const ordre = ['cl-vitrine-tete', 'cl-socles', 'cl-gemmes"', 'cl-gemmes cl-familles', 'cl-style-pieces'].map(c => apres.indexOf(c))
  assert.ok(
    ordre.every((x, i) => x >= 0 && (i === 0 || x > ordre[i - 1])),
    `sa tête, ses pièces, gemme par gemme, famille par famille, ses trophées et son style : ${ordre.join(', ')}`,
  )
  // Sa feuille a sa hauteur dès l'ouverture : elle ne grandit pas quand sa collection arrive.
  assert.match(regle('.carte-feuille.cl-vitrine-feuille'), /height:\s*92%/)
  assert.match(regle('.carte-feuille'), /max-height:\s*92%/, 'la hauteur que la feuille ne dépasse jamais')
})

// ── Le premier écran ──────────────────────────────────────────────────────
//
// « J'aimerais bien que tu regardes les écrans, m'habiller, mon compagnon, classement des collections. Dans la mesure du
// possible j'aimerais que l'on puisse avoir tout sur le même écran ou presque » (le propriétaire, le 10 novembre 2026).
// Un classement défile par nature : sa liste est son contenu. Le « presque », ici : sa place, les Divins, les puces et
// le podium au-dessus de la barre du menu. Mesuré au navigateur ce jour-là (`rendu-collectionneurs.ts`, les états
// `25-…`), le podium finissait dessous partout, sauf sur le plus grand téléphone : de 289 px en 360 × 640, de 230 en
// 390 × 664, de 189 en 360 × 740, de 82 en 412 × 800, de 50 en 390 × 844. Il tient depuis aux six tailles — 21, 45, 39,
// 112, 86 et 113 px au-dessus du menu —, et sous l'encoche d'un iPhone (35 px, `ENCOCHE=47`). Rien n'a changé de place,
// ni un nom, ni un geste : ce qui s'est resserré, ce sont des mesures, et rien ne bouge davantage d'une puce à l'autre
// — le script le mesure dans les quatorze vues de chaque taille. Ici, ce que la feuille en décide.

/** La section des collectionneurs de la feuille, ses commentaires compris. */
const FEUILLE = source('styles.css')
const BLOC = FEUILLE.slice(FEUILLE.indexOf('/* ── Les collectionneurs'), FEUILLE.indexOf("/* ── L'accueil compact"))
/** Ce que cette section règle à un pas de hauteur d'écran : le corps de chaque `@media (min-height …)` ou `(max-height …)`. */
const PAS = [...BLOC.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@media \((min|max)-height: (\d+)px\) \{([\s\S]*?)\n\}/g)].map(m => ({ sens: m[1], de: Number(m[2]), corps: m[3] }))

test('le premier écran se règle par des variables posées sur la page, à des pas de hauteur d’écran — et une tablette garde les mesures d’avant', () => {
  assert.ok(BLOC.length > 1000, 'la section des collectionneurs, de son titre à celui de l’accueil compact')
  // Le petit téléphone d'abord, puis quatre pas : chacun redit ce que la page a de plus large.
  const base = /\n\.cl-page \{([^}]*)\}/.exec(BLOC.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? ''
  const pas = PAS.filter(p => p.sens === 'min' && /^\s*\.cl-page \{/.test(p.corps))
  assert.deepEqual(
    pas.map(p => p.de),
    [720, 820, 900, 1000],
  )
  /** Les valeurs d'une variable, du petit téléphone au plus grand écran : là où elle change. */
  const suite = (variable: string) => [base, ...pas.map(p => p.corps)].flatMap(corps => new RegExp(`--cl-${variable}: ([^;]+);`).exec(corps)?.[1] ?? [])
  // L'écart entre ses blocs ne fait que grandir ; les marges d'avant ne reviennent qu'à 1000 px de haut — une tablette,
  // un ordinateur : sur un téléphone, même grand, l'encoche et la barre d'accueil prennent leur place.
  assert.deepEqual(suite('ecart'), ['8px', '10px', '14px', '16px', '18px'])
  assert.deepEqual(suite('air'), ['0', '1'])
  assert.match(pas[3].corps, /--cl-air: 1;/)
  assert.deepEqual(suite('haut'), ['12px', '16px', '24px'])
  // La rangée des Divins et les cartes du podium, à l'échelle : à leur taille d'avant dès 820 px.
  assert.deepEqual(suite('divins'), ['0.76', '0.88', '1'])
  assert.deepEqual(suite('podium'), ['0.78', '0.9', '1'])
  assert.match(pas[1].corps, /--cl-divins: 1; --cl-podium: 1;/)
  // Le titre tient sur une ligne en 360 de large à chaque pas : à 2 rem, il lui fallait 334 px pour 320.
  assert.deepEqual(suite('titre'), ['1.6rem', '1.75rem', 'min(2rem, 8.2vw)'])
  // La page les lit — et garde la place d'une encoche, comme toute coquille.
  assert.match(base, /padding-top: max\(var\(--cl-haut\), env\(safe-area-inset-top\)\);/)
  assert.match(base, /gap: var\(--cl-ecart\);/)
  assert.match(regle('.cl-page > .piece-tete h1'), /font-size: var\(--cl-titre\)/)
  assert.match(regle('.cl-sa-place'), /padding: var\(--cl-place\) 12px var\(--cl-place\) 6px/)
  assert.match(regle('.cl-divins-case'), /height: calc\(3\.4rem \* var\(--cl-divins\)\)/)
  assert.match(regle('.cl-carte-premier .cl-carte-illu'), /height: calc\(5\.4rem \* var\(--cl-podium\)\)/)
  assert.match(regle('.cl-carte-podium .cl-carte-illu'), /height: calc\(4\.3rem \* var\(--cl-podium\)\)/)
  // Une variable ne se pose que sur la page, jamais sur une vue ni sur un bloc : sa valeur ne dépend que de l'écran, et
  // rien ne change de taille d'une puce à l'autre.
  const posent = REGLES.filter(r => /(^|[;{\s])--cl-[\w-]+:/.test(r.corps)).flatMap(r => r.selecteurs)
  assert.deepEqual([...new Set(posent)], ['.cl-page'])
  // Ce qui se lit ne passe pas à l'échelle : aucun texte de la section sous le plancher (`--t-label`, 0,6875 rem).
  const tailles = [...BLOC.matchAll(/font-size: ([\d.]+)rem/g)].map(m => Number(m[1]))
  assert.ok(tailles.length > 20 && Math.min(...tailles) >= 0.6875, `le plus petit texte de la section : ${Math.min(...tailles)} rem`)
  assert.match(regle('.cl-carte-nom'), /font-size: 0\.8rem/, 'le nom d’une carte du podium garde sa taille')
  assert.doesNotMatch(regle('.cl-carte-valeur'), /var\(--cl-podium\)/, 'sa valeur aussi')
})

test('sur un téléphone, les sept puces tiennent en deux rangées, dans leur ordre : la valeur et ce que chacun a fait, puis ses avatars', () => {
  // L'ordre des puces est celui des catégories : il n'a pas changé.
  assert.deepEqual([...CATEGORIES_DE_COLLECTION], ['collection', 'niveau', 'maitres', 'cabinet', 'legendaires', 'scelles', 'eclats'])
  // Au large — une tablette, un téléphone de 900 px de haut —, la valeur seule sur sa rangée, les six autres trois par trois.
  assert.match(regle('.onglets.cl-puces'), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(regle('.cl-puces .onglet:first-child'), /grid-column: 1 \/ -1/)
  // Dessous, deux rangées : leur troisième prenait 44 px au podium.
  const telephone = PAS.find(p => p.sens === 'max' && p.de === 899 && p.corps.includes('.onglets.cl-puces'))
  assert.ok(telephone, 'les puces se rangent autrement sous 900 px de haut')
  const colonnes = Number(/\.onglets\.cl-puces \{ grid-template-columns: repeat\((\d+), minmax\(0, 1fr\)\); \}/.exec(telephone.corps)?.[1])
  const prend = (selecteur: string) => Number(new RegExp(`${selecteur.replace(/[.()]/g, '\\$&')} \\{ grid-column: span (\\d+);`).exec(telephone.corps)?.[1])
  const [toutes, valeur, niveau, maitresEtCabinet] = [prend('.cl-puces .onglet'), prend('.cl-puces .onglet:first-child'), prend('.cl-puces .onglet:nth-child(2)'), prend('.cl-puces .onglet:nth-child(4)')]
  // La première rangée s'arrête au Cabinet, pile au bord ; la seconde va par tiers. « Collection », le plus long de ses
  // noms, a la plus large de ses cases.
  assert.equal(valeur + niveau + 2 * maitresEtCabinet, colonnes, 'quatre puces font la première rangée')
  assert.equal(3 * toutes, colonnes, 'trois font la seconde')
  assert.ok(valeur > maitresEtCabinet && maitresEtCabinet > niveau, `des cases à la largeur de leur nom : ${valeur}, ${niveau}, ${maitresEtCabinet}, ${maitresEtCabinet}`)
  assert.match(telephone.corps, /\.cl-puces \.onglet:nth-child\(3\),\s*\.cl-puces \.onglet:nth-child\(4\) \{/)
})

test('une puce plus basse qu’un doigt se touche sur 44 px, sans mordre sur sa voisine — le barème et le retour aussi', () => {
  const px = (corps: string, propriete: string) => Number(new RegExp(`(?:^|[;\\s])${propriete}:\\s*(-?\\d+)px`).exec(corps)?.[1])
  // Une puce fait 36 px de haut, « Tous · Mes amis » 32 : leur cible déborde d'elles, comptée de l'intérieur de leur bord.
  const bord = px(regle('.onglets-puces .onglet'), 'border')
  const touche = (hauteur: number, deborde: number) => hauteur - 2 * bord + 2 * deborde
  const [puce, cercle] = [px(regle('.onglets-puces .onglet'), 'min-height'), px(regle('.cl-cercle-petit .onglet'), 'min-height')]
  const [autourDUnePuce, autourDuCercle] = [-px(regle('.cl-puces .onglet::after'), 'inset'), -px(regle('.cl-cercle-petit .onglet::after'), 'inset')]
  assert.deepEqual([bord, puce, cercle], [1, 36, 32])
  assert.ok(touche(puce, autourDUnePuce) >= 44, `une puce se touche sur ${touche(puce, autourDUnePuce)} px`)
  assert.ok(touche(cercle, autourDuCercle) >= 44, `« Tous · Mes amis » se touche sur ${touche(cercle, autourDuCercle)} px`)
  for (const s of ['.cl-puces .onglet::after', '.cl-cercle-petit .onglet::after']) assert.match(regle(s), /position: absolute;[^}]*content: ''/)
  assert.match(regle('.cl-puces .onglet'), /justify-content: center/)
  assert.ok(REGLES.some(r => r.selecteurs.includes('.cl-puces .onglet') && r.selecteurs.includes('.cl-cercle-petit .onglet') && /position: relative/.test(r.corps)), 'leur cible se pose sur elles')
  // D'une rangée de puces à l'autre, les cibles se suivent sans se recouvrir…
  const [, entreRangees] = /gap: (\d+)px \d+px/.exec(regle('.onglets.cl-puces')) ?? []
  assert.ok(Number(entreRangees) >= 2 * (autourDUnePuce - bord), `${entreRangees} px entre deux rangées, ${autourDUnePuce - bord} px de cible de part et d’autre`)
  // … et de « Tous · Mes amis » aux puces, dix pixels au moins, quel que soit l'écart de la page.
  assert.equal(autourDuCercle - bord + (autourDUnePuce - bord), 10)
  assert.match(regle('.cl-classement-tete'), /margin: [^;]*calc\(10px - var\(--cl-ecart\)\)\)/)
  // Le titre du barème se touche sur toute sa boîte, pas sur sa seule ligne (28 px).
  assert.equal(px(regle('.cl-bareme summary'), 'min-height'), 48)
  // « ← Mon profil » garde ses 44 px : le titre, remonté sous lui, ne passe pas devant sa cible.
  assert.equal(px(regle('.jour-sortie'), 'min-height'), 44)
  assert.match(regle('.cl-page > .jour-sortie'), /position: relative; z-index: 1/)
})

test('ce qu’un petit écran tait reste dit à l’oreille : le surtitre de la page, et qui l’on passerait', async () => {
  // « Encore 2 niveaux pour passer Jules » en deux morceaux : ce qui manque, puis qui — la phrase d'avant, mot pour mot.
  const { etat, fiches } = await classement(id(10), [id(0)])
  const html = await rendu('SaPlace', { moi: fiches.get(etat.moi), vues: vuesDuClassement(etat, fiches), c: 'niveau', cercle: 'tous' })
  assert.match(html, /<span class="cl-sa-place-manque"><span class="cl-sa-place-combien">Encore 2 niveaux<\/span><span class="cl-sa-place-qui"> pour passer Jules<\/span><\/span>/)
  const dites = [...html.matchAll(/<span class="cl-sa-place-combien">([^<]*)<\/span><span class="cl-sa-place-qui">([^<]*)<\/span>/g)].map(m => m[1] + m[2])
  assert.ok(dites.includes('Encore 11 niveaux pour passer Agathe') && dites.every(d => /^Encore \d+ \S.* pour passer \S/.test(d)), dites.join(' | '))
  // Sous 720 px de haut, sa rangée n'a qu'une ligne : « pour passer Jules » s'y montre entier, ou passe dessous — jamais
  // coupé au milieu d'un prénom. Sur deux lignes dans une seule des quatorze vues, il donnait sa hauteur au bloc dans toutes.
  const petit = PAS.filter(p => p.sens === 'max' && p.de === 719).map(p => p.corps).join('\n')
  assert.match(petit, /\.cl-sa-place-manque \{ display: flex; flex: 1; flex-wrap: wrap; align-content: flex-start; height: calc\(1em \* var\(--cl-place-interligne\)\); min-width: 0; overflow: clip; \}/)
  assert.match(petit, /\.cl-sa-place-combien \{ min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \}/)
  assert.match(petit, /\.cl-sa-place-qui \{ flex: none; white-space: pre; \}/)
  // Au-delà, la phrase reprend ses deux lignes : ses morceaux ne sont réglés nulle part ailleurs.
  assert.equal(REGLES.filter(r => r.selecteurs.some(s => /\.cl-sa-place-(manque|combien|qui)\b/.test(s))).length, 3)
  // Le surtitre de la page, caché à l'œil seulement — les déclarations de `.sr-only` : sous `display: none`, le lecteur
  // d'écran ne le lirait plus.
  assert.match(petit, /\.cl-page > \.piece-tete \.label \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\); white-space: nowrap; \}/)
  // Et aucun pas de hauteur de la section ne retire quoi que ce soit.
  assert.ok(PAS.length >= 6, `les pas de hauteur de la section sont lus (${PAS.length})`)
  for (const p of PAS) assert.doesNotMatch(p.corps, /display:\s*none|visibility:\s*hidden/, `sous ${p.sens}-height: ${p.de}px`)
})

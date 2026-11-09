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

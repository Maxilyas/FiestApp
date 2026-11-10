// Sa gestion (le 19 octobre 2026, le propriétaire : « il n'y a pas
// d'interface de gestion de compagnon quand on clique dessus ? Pouvoir
// choisir son compagnon, le customiser ») : la niche est sa maison, l'avatar
// une autre affaire. L'adoption l'y installe sans le faire porter ; celui qui
// y vit, son nom, la forme qu'il y montre se règlent chez lui — « Mon
// compagnon », au profil : sa plaque, « Décorer », « Tes compagnons » —, et
// ce qu'on y choisit ne bouge plus quand on change d'avatar. Toucher la niche
// n'ouvre plus qu'une bulle, pour le caresser et voir où il en est (le 20
// octobre 2026 : « uniquement pouvoir interagir avec lui ? »).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import React from 'react'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { MONTREE_DE_LA_METAMORPHOSE, NOM_D_UN_COMPAGNON_MAX, compagnon, formeDansLaNiche } from '../../shared/compagnons'
import { readFileSync } from 'node:fs'
import { tirerLeCoffre } from '../../shared/tresor'
import type { ObjetDuTresor } from '../../shared/coffre'
import { CATEGORIES } from '../../shared/categories'

ProfileStore.tirageEclat = () => false

// ── La règle, pure ────────────────────────────────────────────────────────

test('la forme de sa niche : celle qu’il a choisie parmi celles qu’il a atteintes, sinon la plus grande', () => {
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 2 })?.key, 'cp:loup-adulte', 'd’office la plus grande : il grandit sous ses yeux')
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 2, montree: 0 })?.key, 'cp:loup-louveteau')
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 1, montree: 3 })?.key, 'cp:loup-jeune', 'jamais une forme qu’il n’a pas atteinte')
  assert.equal(formeDansLaNiche({ compagnon: 'dragon' as never, rang: 0 }), undefined)
  assert.equal(NOM_D_UN_COMPAGNON_MAX, 16)
  // Sa métamorphose, une forme de plus : choisie, à sa forme ultime, l'Éclat sur lui.
  const meta = MONTREE_DE_LA_METAMORPHOSE
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 3, montree: meta, eclat: true })?.key, 'cp:loup-tempete')
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 3, eclat: true })?.key, 'cp:loup-ultime', 'd’office, sa forme ultime : rien ne change tant qu’il ne la choisit pas')
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 3, montree: meta })?.key, 'cp:loup-ultime', 'sans l’Éclat, elle se referme')
  assert.equal(formeDansLaNiche({ compagnon: 'loup', rang: 2, montree: meta, eclat: true })?.key, 'cp:loup-adulte', 'pas avant sa forme ultime')
})

// ── Au téléphone ──────────────────────────────────────────────────────────

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

test('le téléphone retient son nom, la forme de sa niche et son Éclat, et ne relit rien d’abîmé', async () => {
  const retenu = new Map<string, string>()
  Object.assign(globalThis, {
    document: { body: { classList: { toggle: () => true } } },
    localStorage: { getItem: (k: string) => retenu.get(k) ?? null, setItem: (k: string, v: string) => retenu.set(k, v), removeItem: (k: string) => retenu.delete(k) },
  })
  try {
    const niche = await import(client('niche.ts'))
    let appels = 0
    niche.abonnerNiche(() => appels++)
    const nox = { compagnon: 'loup', rang: 2, montree: 0, nom: 'Nox' }
    niche.porterNiche({ niche: 'loup', compagnons: [nox] })
    assert.deepEqual(niche.nicheActuelle(), nox)
    niche.porterNiche({ niche: 'loup', compagnons: [{ ...nox }] })
    assert.equal(appels, 1, 'la même niche ne refait rien')
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 2, nom: 'Nox' }] })
    assert.equal(appels, 2, 'une autre forme montrée : la niche la prend')
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 2, nom: 'Noxou' }] })
    assert.equal(appels, 3, 'un nom changé aussi')
    assert.deepEqual(JSON.parse(retenu.get('quizz.niche')!), { compagnon: 'loup', rang: 2, nom: 'Noxou' })
    // Son Éclat, que le serveur dit de lui (`CompagnonPossede.eclat`) : à sa forme ultime, il lui ouvre sa métamorphose.
    niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 2, nom: 'Noxou', eclat: true }] })
    assert.equal(appels, 4, 'éclaté, la niche le prend')
    assert.deepEqual(JSON.parse(retenu.get('quizz.niche')!), { compagnon: 'loup', rang: 2, nom: 'Noxou', eclat: true })
    // Sa métamorphose se dit par le même nombre qu'au serveur : le téléphone ne lit pas le catalogue.
    const meta = MONTREE_DE_LA_METAMORPHOSE
    for (const [brut, lu] of [
      [{ compagnon: 'loup', rang: 1, montree: 0, nom: 'Nox' }, { compagnon: 'loup', rang: 1, montree: 0, nom: 'Nox' }],
      [{ compagnon: 'loup', rang: 1, montree: 2 }, { compagnon: 'loup', rang: 1 }],
      [{ compagnon: 'loup', rang: 1, montree: -1, nom: 42 }, { compagnon: 'loup', rang: 1 }],
      [{ compagnon: 'loup', rang: 1, nom: '' }, { compagnon: 'loup', rang: 1 }],
      [{ compagnon: 'loup', rang: 3, eclat: true }, { compagnon: 'loup', rang: 3, eclat: true }],
      [{ compagnon: 'loup', rang: 3, eclat: 'oui' }, { compagnon: 'loup', rang: 3 }],
      [{ compagnon: 'loup', rang: 3, montree: meta, eclat: true }, { compagnon: 'loup', rang: 3, montree: meta, eclat: true }],
      [{ compagnon: 'loup', rang: 3, montree: meta }, { compagnon: 'loup', rang: 3 }],
      [{ compagnon: 'loup', rang: 2, montree: meta, eclat: true }, { compagnon: 'loup', rang: 2, eclat: true }],
    ]) {
      retenu.set('quizz.niche', JSON.stringify(brut))
      niche.poserNicheRetenue()
      assert.deepEqual(niche.nicheActuelle(), lu, JSON.stringify(brut))
    }
  } finally {
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('caressé dans sa fiche, il est réveillé : chez lui, il ne dort plus volets fermés l’instant d’après', async () => {
  const retenu = new Map<string, string>()
  Object.assign(globalThis, {
    document: { body: { classList: { toggle: () => true } } },
    localStorage: { getItem: (k: string) => retenu.get(k) ?? null, setItem: (k: string, v: string) => retenu.set(k, v), removeItem: (k: string) => retenu.delete(k) },
  })
  try {
    const niche = await import(client('niche.ts'))
    assert.equal(niche.reveilleAujourdhui('2026-10-20', 'loup'), false, 'au premier passage du jour, il dort')
    niche.retenirLeReveil('2026-10-20', 'loup')
    assert.equal(niche.reveilleAujourdhui('2026-10-20', 'loup'), true)
    assert.equal(niche.reveilleAujourdhui('2026-10-20', 'chat'), false, 'un autre des siens dort encore')
    assert.equal(niche.reveilleAujourdhui('2026-10-21', 'loup'), false, 'le lendemain, il redort')
  } finally {
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
  // La caresse de sa fiche le retient, comme le réveil de sa page.
  const source = readFileSync(new URL('../../client/src/components/Niche.tsx', import.meta.url), 'utf8')
  const fiche = source.slice(source.indexOf('export function FicheDeLaNiche'), source.indexOf('export function SaNicheSEmbellit'))
  const caresser = fiche.slice(fiche.indexOf('const caresser = () => {'), fiche.indexOf('\n  }\n', fiche.indexOf('const caresser = () => {')))
  assert.ok(caresser.includes('retenirLeReveil(soins.jour, niche.compagnon)'), caresser)
})

/** Un composant de la niche, rendu tel que la page le montre. */
async function rendre(composant: string, props: object): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(client('components/Niche.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Un composant de sa page, chez lui (`/profil#compagnon`), rendu tel qu'il s'ouvre — ses soins pas encore lus. */
async function rendreChezLui(composant: string, props: object): Promise<string> {
  Object.assign(globalThis, { React })
  const module = await import(client('components/MonCompagnon.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Sa page entière, pour ce compagnon dans sa niche. */
const chezLui = (niche: { compagnon: string; rang: number }) =>
  rendreChezLui('MonCompagnon', { niche, profil: { niche: niche.compagnon, compagnons: [niche] }, occupee: false, onAdopter: async () => null, onInstaller: async () => true })

test('la niche montre la forme qu’il a choisie, et l’appelle par son nom', async () => {
  const { DESSINS } = await import(client('components/compagnons-peints.ts'))
  const html = await rendre('Niche', { compagnon: 'loup', rang: 2, montree: 0, nom: 'Nox' })
  assert.match(html, /aria-label="Nox, dans ta niche : sa fiche"/)
  assert.ok(html.includes(`src="${DESSINS['cp:loup-louveteau'].perso[0]}"`), 'le louveteau, qu’il a choisi')
  assert.ok(!html.includes(DESSINS['cp:loup-adulte'].perso[0]), 'pas sa plus grande forme')
})

test('sa métamorphose, une forme de plus : rien ne change d’office ; choisie, sa niche la montre — son décor, son buste, son nom', async () => {
  const { DESSINS } = await import(client('components/compagnons-peints.ts'))
  const rare = DESSINS['cp:loup-tempete']
  // Éclaté, il garde sa forme ultime tant qu'il ne choisit pas (le propriétaire, le 19 octobre 2026 : « je veux que ce soit un choix »).
  const etoiles = await rendre('Niche', { compagnon: 'loup', rang: 3, eclat: true })
  assert.ok(etoiles.includes(DESSINS['cp:loup-ultime'].perso[0]) && !etoiles.includes(rare.perso[0]))
  const tempete = await rendre('Niche', { compagnon: 'loup', rang: 3, montree: MONTREE_DE_LA_METAMORPHOSE, eclat: true })
  assert.ok(tempete.includes(`src="${rare.perso[0]}"`), 'le loup-tempête, en buste')
  assert.ok(tempete.includes(`background-image:url(${rare.disque[1]})`), 'dans son décor')
  assert.ok(!tempete.includes(DESSINS['cp:loup-ultime'].perso[0]), 'plus le loup des étoiles')
  assert.match(tempete, /aria-label="Le loup-tempête, dans ta niche : sa fiche"/)
  // De face, il regarde déjà la page : son cadrage ne le retourne pas.
  assert.doesNotMatch(tempete, /niche-bete miroir/)
  // Sa fiche le nomme et le montre comme il se montre ; l'avatar se choisit dans la loge, plus d'ici (le 20 octobre 2026).
  const tempeteIci = { compagnon: 'loup', rang: 3, montree: MONTREE_DE_LA_METAMORPHOSE, eclat: true }
  const fiche = await rendre('FicheDeLaNiche', { niche: tempeteIci, onFermer: () => {} })
  assert.match(fiche, /class="niche-fiche-nom">Le loup-tempête<\/b>/)
  assert.match(fiche, /Métamorphose · légendaire/)
  assert.ok(fiche.includes(`src="${rare.perso[0]}"`), 'en grand, le loup-tempête')
  assert.doesNotMatch(fiche, /porter en avatar/)
  // Ses cinq formes, dans « Décorer » : les quatre atteintes, et elle, pressée.
  const formes = await rendre('SesFormes', { niche: tempeteIci, busy: false, onMontrer: () => {} })
  assert.equal(formes.match(/<button type="button" class="niche-choix/g)?.length, 5)
  assert.match(formes, /aria-pressed="true" aria-label="Le loup-tempête"/)
  assert.match(formes, /aria-pressed="false" aria-label="Le loup des étoiles"/)
  // Ses compagnons en petites niches, chez lui, chacun sous la forme qu'il montre : le chat éclaté garde la sienne.
  const siens = await rendreChezLui('TesCompagnons', {
    siens: [
      { compagnon: 'loup', rang: 3, justes: 520, montree: MONTREE_DE_LA_METAMORPHOSE, eclat: true },
      { compagnon: 'chat', rang: 3, justes: 600, eclat: true },
    ],
    niche: tempeteIci,
    busy: false,
    onInstaller: () => {},
    onVoir: () => {},
  })
  assert.ok(siens.includes(rare.perso[0]))
  assert.ok(siens.includes(DESSINS['cp:chat-esprit'].perso[0]) && !siens.includes(DESSINS['cp:chat-soleil'].perso[0]), 'le chat-soleil attend qu’on le choisisse')
})

test('« Décorer » la propose parmi ses formes, marquée d’un point rouge tant qu’il ne l’a pas vue — et seulement ouverte', async () => {
  const formes = (niche: object, neuves?: string[]) => rendre('SesFormes', { niche, busy: false, neuves, onMontrer: () => {} })
  const neuve = await formes({ compagnon: 'loup', rang: 3, eclat: true }, ['cp:loup-tempete'])
  assert.match(neuve, /<button type="button" class="niche-choix neuve" aria-pressed="false" aria-label="Le loup-tempête, nouveau">/)
  assert.match(neuve, /<span class="niche-choix-nom">Loup-tempête<\/span>/)
  assert.match(neuve, /aria-pressed="true" aria-label="Le loup des étoiles"/, 'sa forme ultime reste dans sa niche')
  assert.equal(neuve.match(/ neuve"/g)?.length, 1, 'ses formes atteintes n’ont rien de neuf')
  // Vue, plus de point ; sans l'Éclat, ou avant sa forme ultime, pas de cinquième.
  assert.doesNotMatch(await formes({ compagnon: 'loup', rang: 3, eclat: true }), /neuve/)
  for (const niche of [
    { compagnon: 'loup', rang: 3 },
    { compagnon: 'loup', rang: 2, eclat: true },
  ]) {
    assert.doesNotMatch(await formes(niche, ['cp:loup-tempete']), /tempête/, JSON.stringify(niche))
  }
  // Le point rouge de la loge, sur la petite niche.
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.niche-choix\.neuve \.niche-mini::after \{[^}]*background: #d93025;/)
})

test('sa fiche, une bulle : lui, le caresser, chez lui — rien à y régler ; son nom, ses formes et ses compagnons se règlent chez lui', async () => {
  const { DESSINS } = await import(client('components/compagnons-peints.ts'))
  const noxIci = { compagnon: 'loup', rang: 2, montree: 0, nom: 'Nox' }
  const nox = await rendre('FicheDeLaNiche', { niche: noxIci, onFermer: () => {} })
  assert.match(nox, /role="dialog" aria-modal="true" aria-labelledby=/)
  assert.match(nox, /class="niche-fiche-nom">Nox<\/b>/)
  assert.match(nox, /Le louveteau · Première forme · commune/)
  assert.ok(nox.includes(DESSINS['cp:loup-louveteau'].perso[0]) && !nox.includes(DESSINS['cp:loup-ultime'].perso[0]), 'la forme qu’il montre, pas une autre')
  assert.match(nox, />Le caresser<\/button>/)
  // « Tu peux enlever le lien vers mon avatar » (le propriétaire, le 20 octobre 2026) : sa page, où l'on s'occupe de lui, en prend la place.
  assert.match(nox, /<a class="chez-pastille" href="\/profil#compagnon">.*?Chez lui<\/a>/)
  assert.doesNotMatch(nox, /porter en avatar/)
  // « Uniquement pouvoir interagir avec lui ? Et de savoir où il en est » (le
  // propriétaire, le 20 octobre 2026) : ni nom à changer, ni forme, ni
  // compagnon à installer, ni boutique — un second endroit pour ce que sa page règle.
  assert.doesNotMatch(nox, /Renommer|Lui donner un nom|niche-choix|Adopter|\/boutique/)

  // Son nom, sur sa plaque, chez lui : la toucher le change.
  assert.match(await chezLui(noxIci), /class="chez-plaque"[^>]*aria-label="Nox : le renommer"/)
  // Ses formes, dans « Décorer » : ses trois atteintes, la choisie pressée ; pas la quatrième, qu'il n'a pas.
  const formes = await rendre('SesFormes', { niche: noxIci, busy: false, onMontrer: () => {} })
  assert.equal(formes.match(/<button type="button" class="niche-choix"/g)?.length, 3)
  assert.match(formes, /<button type="button" class="niche-choix" aria-pressed="true" aria-label="Le louveteau">/)
  assert.match(formes, /aria-pressed="false" aria-label="Le loup adulte"/)
  assert.ok(!formes.includes(DESSINS['cp:loup-ultime'].perso[0]))
  // Ses compagnons, chez lui, sous leur titre : le profil les montre en attendant leur lecture.
  const page = await chezLui(noxIci)
  assert.match(page, /aria-labelledby="chez-amis"/)
  assert.match(page, /aria-pressed="true" aria-label="Nox"/)

  const tortueIci = { compagnon: 'tortue', rang: 0 }
  const tortue = await rendre('FicheDeLaNiche', { niche: tortueIci, onFermer: () => {} })
  assert.match(tortue, /class="niche-fiche-nom">La petite tortue<\/b>/)
  assert.match(tortue, />La caresser<\/button>/)
  assert.match(tortue, /Chez elle<\/a>/)
  assert.match(await chezLui(tortueIci), /class="chez-plaque sans-nom"[^>]*aria-label="Lui donner un nom"/)
  const uneForme = await rendre('SesFormes', { niche: tortueIci, busy: false, onMontrer: () => {} })
  assert.doesNotMatch(uneForme, /class="niche-choix"/, 'une seule forme : rien à choisir')
  assert.match(uneForme, /Elle en prendra trois autres en grandissant/)
})

test('« Tes compagnons », chez lui : celui qui y vit, les autres à installer d’un toucher, puis ceux à adopter — leur prix', async () => {
  const { DESSINS } = await import(client('components/compagnons-peints.ts'))
  // Le Cabinet fermé, en le disant : ouvert ou fermé, la rangée dit la même chose depuis que la luciole s'achète
  // (le 31 octobre 2026, `album-des-avatars.test.ts`).
  const tes = (siens: object[], niche: object) => rendreChezLui('TesCompagnons', { siens, niche, busy: false, onInstaller: () => {}, onVoir: () => {}, cabinet: false })
  const deux = await tes(
    [
      { compagnon: 'loup', rang: 2, justes: 320, montree: 0, nom: 'Nox' },
      { compagnon: 'tortue', rang: 1, justes: 120 },
    ],
    { compagnon: 'loup', rang: 2, montree: 0, nom: 'Nox' },
  )
  // Un nom fixe : celui qui y vit se dit par aria-pressed, jamais par son libellé (`design.test.ts`).
  assert.match(deux, /aria-pressed="true" aria-label="Nox"/)
  assert.match(deux, /aria-pressed="false" aria-label="La Tortue-île"/)
  assert.match(deux, /<span class="chez-ami-nom">Nox<\/span>/)
  assert.match(deux, /<span class="chez-ami-nom">Tortue-île<\/span>/)
  assert.ok(deux.includes(DESSINS['cp:loup-louveteau'].perso[0]), 'le loup, sous la forme qu’il montre')
  assert.ok(deux.includes(DESSINS['cp:tortue-jeune'].perso[0]))
  // Les siens d'abord ; puis le chat, à son prix — sa fiche dans la galerie, où l'on adopte sur place —, et la luciole
  // aussi : elle se gagnait en expédition, elle s'achète depuis le 31 octobre 2026, l'Expédition effacée.
  assert.match(deux, /aria-label="Le Chat des lanternes : 1000 confettis, voir comment l’avoir"/, 'le chat attend qu’on l’adopte')
  assert.match(deux, /aria-label="La Luciole : 1000 confettis, voir comment l’avoir"/)
  assert.match(deux, /aria-label="Le Panda roux : 1000 confettis, voir comment l’avoir"/, 'le panda, le dernier venu, attend aussi')
  assert.ok(deux.indexOf('Tortue-île') < deux.indexOf('Chat des lanternes'), 'les siens d’abord')
  const tous = await tes(
    [
      { compagnon: 'loup', rang: 0, justes: 0 },
      { compagnon: 'chat', rang: 0, justes: 0 },
      { compagnon: 'tortue', rang: 0, justes: 0 },
      { compagnon: 'luciole', rang: 0, justes: 0 },
      { compagnon: 'panda', rang: 0, justes: 0 },
    ],
    { compagnon: 'chat', rang: 0 },
  )
  assert.doesNotMatch(tous, /confettis, voir comment/, 'tous adoptés : rien à acheter de plus')
  assert.match(tous, /aria-pressed="true" aria-label="Le Chat des lanternes"/)
})

test('sa fiche dit ses envies du jour sans un reproche, et son cadeau quand il attend ; une caresse sur deux, un tour qu’il sait', async () => {
  const { sonJour, gesteDeLaCaresse } = await import(client('components/Niche.tsx'))
  const loup = compagnon('loup')!
  const tortue = compagnon('tortue')!
  const soins = (envies: object, autres: object = {}) => ({ compagnon: 'loup', envies: { gouter: false, calin: false, jeu: false, ...envies }, cadeau: null, complicite: 0, record: 0, jardin: {}, ...autres })
  const toutes = { gouter: true, calin: true, jeu: true }
  assert.deepEqual(sonJour(loup, undefined), { faites: [], cadeau: null, phrase: 'Ses trois envies du jour t’attendent' }, 'jamais soigné : rien ne lui manque, tout l’attend')
  assert.equal(sonJour(loup, soins({ gouter: true })).phrase, '1 envie comblée sur 3')
  assert.deepEqual(sonJour(loup, soins({ gouter: true, jeu: true })).faites, ['gouter', 'jeu'])
  assert.deepEqual(sonJour(loup, soins(toutes)), { faites: ['gouter', 'calin', 'jeu'], cadeau: 'petit', phrase: 'Un cadeau t’attend chez lui !' })
  assert.deepEqual(sonJour(tortue, soins(toutes, { complicite: 6 })), { faites: ['gouter', 'calin', 'jeu'], cadeau: 'grand', phrase: 'Un grand cadeau t’attend chez elle !' }, 'le septième jour')
  assert.deepEqual(sonJour(loup, soins(toutes, { cadeau: { objet: 'coussin', grand: false } })), { faites: ['gouter', 'calin', 'jeu'], cadeau: null, phrase: 'Trois envies comblées · à demain !' })
  // Ses tours, appris de leur complicité : une caresse sur deux, s'il en sait — la caresse reste une caresse.
  for (const n of [1, 2, 3, 4]) assert.equal(gesteDeLaCaresse(0, n), 'saute', 'sans tour appris')
  assert.deepEqual([1, 2, 3, 4].map(n => gesteDeLaCaresse(3, n)), ['saute', 'pirouette', 'saute', 'pirouette'])
  for (let i = 0; i < 20; i++) assert.ok(['pirouette', 'salut'].includes(gesteDeLaCaresse(10, 2)), 'un des tours qu’il sait')
})

// ── Chez lui, tout sur un écran — ou presque ──────────────────────────────
// « J'aimerais bien que tu regardes les écrans, m'habiller, mon compagnon, classement des collections. Dans la mesure
// du possible j'aimerais que l'on puisse avoir tout sur le même écran ou presque » (le propriétaire, le 10 novembre
// 2026). Sa page faisait 951 px en 360 × 640, pour 575 visibles au-dessus du menu : sa scène, ses envies coupées de
// 4 px, son chemin et ses compagnons dessous. Rien n'y change de place, rien ne s'y ajoute, rien ne s'y renomme : la
// place se gagne sur ses mesures. Ce qui tient, taille par taille, se mesure au navigateur
// (`server/scripts/rendu-compagnon.ts`, la passe `tailles`).

test('chez lui, sur un écran : rien n’y change de place, sa page porte ses mesures dès qu’on y est, et la ligne de son cadeau se dit en morceaux — la phrase d’avant à l’oreille', async () => {
  // L'ordre d'avant, ses boutons par leur nom : sa tête et « Comment ça marche », sa scène — sa niche, sa plaque,
  // « Décorer » —, ses envies, son chemin, ses compagnons et « Tous les voir ». Trois cartes, pas une de plus.
  const page = await chezLui({ compagnon: 'loup', rang: 2 })
  const reperes = [
    '<h1>Mon compagnon</h1>',
    'aria-label="Comment ça marche"',
    'class="chez-scene"',
    'aria-label="Caresser ton loup"',
    'aria-label="Lui donner un nom"',
    'Décorer</button>',
    'id="chez-envies">Ses envies du jour</h2>',
    'id="chez-chemin">Son chemin</h2>',
    'id="chez-amis">Tes compagnons</h2>',
    'Tous les voir',
    'aria-label="Tes compagnons : touche l’un des tiens pour l’installer dans ta niche"',
  ]
  const places = reperes.map(r => page.indexOf(r))
  assert.ok(places.every(p => p >= 0), `chaque repère y est : ${reperes.filter((_, i) => places[i] < 0).join(' ; ')}`)
  assert.deepEqual(places, [...places].sort((a, b) => a - b), 'dans l’ordre d’avant')
  assert.equal(page.match(/<section class="card chez-carte"/g)?.length, 3, 'ses envies, son chemin, ses compagnons : aucun bloc de plus')
  // Sa page porte ses mesures dès qu'on y est (`.chez-page`, sur la coquille) : avant même que son code n'arrive, et sans
  // compagnon aussi — posées par sa page à lui (`.chez-lui`), la tête aurait bougé à son arrivée.
  const profilApp = readFileSync(new URL('../../client/src/views/ProfilApp.tsx', import.meta.url), 'utf8')
  assert.match(profilApp, /<div className=\{ecran === 'compagnon' \? 'player-shell chez-page' : 'player-shell'\} onClick=\{suivreUnLien\}>/)
  // La ligne de son cadeau, sous son titre : l'essentiel, puis ses suites, chacune avec son espace et sa ponctuation.
  // Bout à bout, la phrase d'avant, mot pour mot — le lecteur d'écran la lit d'un trait, un grand écran la montre entière.
  const { CE_QUE_DIT_LE_GRAND_CADEAU, ceQueDitLeCadeau } = await import(client('components/MonCompagnon.tsx'))
  assert.equal(CE_QUE_DIT_LE_GRAND_CADEAU.join(''), 'Sept jours de complicité de plus : une rare ou une épique')
  assert.equal(ceQueDitLeCadeau(14).join(''), 'Ses trois envies sont comblées · grand cadeau à 14 jours')
  for (const morceaux of [CE_QUE_DIT_LE_GRAND_CADEAU, ceQueDitLeCadeau(14), ceQueDitLeCadeau(105)] as string[][]) {
    // En 360 de large, à côté du paquet et du chevron, la ligne montre une trentaine de caractères : au-delà, l'essentiel se couperait au bout.
    assert.ok(morceaux[0].length <= 30, `« ${morceaux[0]} » (${morceaux[0].length} caractères) tient à côté du paquet`)
    assert.ok(morceaux.length > 1 && morceaux.slice(1).every(s => s.startsWith(' ')), 'ses suites commencent par leur espace')
  }
  const source = readFileSync(new URL('../../client/src/components/MonCompagnon.tsx', import.meta.url), 'utf8')
  assert.match(
    source,
    /<span className="chez-cadeau-detail">\s*\{\(grand \? CE_QUE_DIT_LE_GRAND_CADEAU : ceQueDitLeCadeau\(prochainGrandCadeau\(complicite\)\)\)\.map\(\(morceau, i\) => \(\s*<span key=\{morceau\} className=\{i === 0 \? 'chez-cadeau-essentiel' : 'chez-cadeau-suite'\}>/,
  )
})

// Ce que la feuille en fait. Mesuré au navigateur le 10 novembre 2026 (`rendu-compagnon.ts`, la passe `tailles`), ses
// trois envies à combler : en 360 × 640, sa scène, ses envies, son chemin et le titre de « Tes compagnons » au-dessus du
// menu (41 px de libre sous son chemin ; la page défilait de 407 px, elle défile de 99) ; en 390 × 664, de même ; en
// 360 × 740, 412 × 800, 390 × 844 et 412 × 915, tout tient et la page ne défile plus — 8, 28, 51 et 44 px de libre,
// 16 sous l'encoche d'un iPhone en 390 × 844.
test('chez lui, dans la feuille : ses mesures suivent la hauteur utile de l’écran, sa scène se rogne sans le rapetisser, et ce qu’un téléphone tait se lit encore', async () => {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const section = css.slice(css.indexOf('CHEZ LUI — « MON COMPAGNON »'), css.indexOf('/* ── « Décorer » : son jardin et sa niche, en deux onglets ── */'))
  const bloc = section.slice(section.indexOf('/* ── Tout chez lui sur un écran, ou presque ──'), section.indexOf('.chez-lui { display: flex;'))
  assert.ok(section.length > 0 && bloc.length > 0, 'sa section, et le bloc de ses mesures')
  // Une pente, pas des pas de `min-height` : ce que l'écran a de hauteur utile au-delà de 800 px, jusqu'à 280 de plus —
  // sans l'encoche ni la barre du bas, que `min-height` ne voit pas. Un iPhone en application installée (390 × 844,
  // 81 px d'encoche et de barre) prenait au pas de 820 px les mesures d'un écran plus grand que lui : « Tes compagnons »
  // passait de 40 px sous le menu. `svh` sous `@supports` : une variable qui lit `svh` ne retombe pas sur `vh`.
  assert.match(bloc, /\.chez-page \{\s*--chez-aise: clamp\(0px, calc\(100vh - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\) - 800px\), 280px\);/)
  assert.match(bloc, /@supports \(height: 100svh\) \{\s*\.chez-page \{ --chez-aise: clamp\(0px, calc\(100svh - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\) - 800px\), 280px\); \}\s*\}/)
  assert.doesNotMatch(bloc, /@media \(min-height/)
  // Chaque mesure : le plus serré, plus ce qu'elle reprend au bout de la pente — où elle retrouve celle d'avant, au pixel.
  const enPixels = (n: string, unite: string) => Math.round(Number(n) * (unite === 'rem' ? 16 : 1) * 100) / 100
  const mesures = Object.fromEntries(
    [...bloc.matchAll(/--chez-([a-z-]+): calc\((-?[\d.]+)(px|rem) \+ var\(--chez-aise\) \* ([\d.]+) \/ 280\);/g)].map(m => [m[1], [enPixels(m[2], m[3]), Math.round((enPixels(m[2], m[3]) + Number(m[4])) * 100) / 100]]),
  )
  assert.deepEqual(mesures, {
    // La page : ses marges, de « ← Mon profil » à son titre, son titre (1,4 à 2 rem), l'écart entre ses blocs.
    haut: [2, 24],
    bas: [0, 24],
    'sous-le-retour': [-11, 6],
    'grand-titre': [22.4, 32],
    ecart: [5, 14],
    // Une carte : ses marges, l'écart sous son titre, son titre (1,1 à 1,25 rem), sa tête, le texte de sa pastille — jamais sous une étiquette (`--t-label`, 11 px).
    'carte-marge': [7, 18],
    'carte-bord': [14, 18],
    'carte-ecart': [6, 12],
    titre: [17.6, 20],
    tete: [22, 26],
    puce: [11, 12],
    lien: [22, 40],
    // Ses envies, son chemin, ses compagnons.
    rond: [42, 54],
    'rond-ecart': [2, 6],
    etape: [44, 50],
    'etape-ecart': [2, 6],
    'chemin-haut': [8, 12],
    'chemin-remonte': [-6, 0],
    'ami-marge': [3, 6],
    'ami-ecart': [2, 4],
    // Ce que sa page prend hors de sa scène : sa scène a ce que l'écran laisse.
    reste: [417, 684],
  })
  // Aucune mesure de sa page n'échappe à la pente, et chacune est lue par sa règle.
  assert.equal(bloc.match(/^\s+--chez-(?!aise)[a-z-]+:/gm)?.length, Object.keys(mesures).length, 'chaque variable du bloc suit la pente')
  const regles = section.replace(/--chez-[a-z-]+:[^;]*;/g, '')
  for (const nom of Object.keys(mesures)) assert.ok(regles.includes(`var(--chez-${nom})`), `--chez-${nom} est lue par une règle`)
  assert.match(bloc, /\.chez-page \{[^}]*padding-top: max\(var\(--chez-haut\), env\(safe-area-inset-top\)\);/)
  assert.match(bloc, /body\.avec-menu \.player-shell\.chez-page \{ padding-bottom: var\(--chez-bas\); \}/)
  assert.match(section, /\.chez-lui \{ display: flex; flex-direction: column; gap: var\(--chez-ecart\); \}/)
  assert.match(section, /\.chez-carte \{ display: flex; flex-direction: column; gap: var\(--chez-carte-ecart\); padding: var\(--chez-carte-marge\) var\(--chez-carte-bord\); \}/)
  // Une cible de doigt ne descend pas sous 44 px. Le bouton d'une envie garde les siens — son rond n'est que son dessin —,
  // « ← Mon profil » passe devant le titre qui remonte dans sa boîte, « Tous les voir » déborde de sa ligne, et la plaque
  // de son nom, les flèches de son jardin et ses places libres, qui en faisaient 34, 34 et 41, les atteignent.
  assert.match(section, /\.chez-envie \{[^}]*min-height: 44px;/)
  assert.match(section, /\.chez-envie-rond \{[^}]*width: var\(--chez-rond\); height: var\(--chez-rond\);/)
  assert.match(bloc, /\.chez-page > \.jour-sortie \{ position: relative; z-index: 1; margin-bottom: calc\(var\(--chez-sous-le-retour\) - 18px\); \}/)
  assert.match(section, /\.chez-lien \{ position: relative;[^}]*min-height: var\(--chez-lien\);/)
  assert.match(section, /\.chez-lien::before \{ content: ''; position: absolute; inset: min\(0px, calc\(\(var\(--chez-lien\) - 46px\) \* 0\.75\)\) -6px min\(0px, calc\(\(var\(--chez-lien\) - 46px\) \* 0\.25\)\); \}/)
  assert.match(section, /\.chez-plaque \{[^}]*height: 34px;/)
  assert.match(section, /\.chez-plaque b::before \{ content: ''; position: absolute; inset: -6px 0; \}/)
  assert.match(section, /\.jardin-fleche \{[^}]*width: 34px; height: 34px;/)
  assert.match(section, /\.chez-scene \.jardin-fleche::before \{ content: ''; position: absolute; inset: -6px; border-radius: 50%; \}/)
  assert.match(section, /\.jardin-libre::before \{ content: ''; position: absolute; inset: -9px; border-radius: 50%; \}\n[^\n]*\n\.chez-scene \.jardin-libre::before \{ inset: -11px; \}/)
  // Sa scène : la hauteur de sa cour, jusqu'à ce que l'écran lui laisse au-dessus du menu — puis elle se rogne par le bas,
  // jamais sous ce qu'il lui faut (sa niche, sa plaque, 8 px d'air, la pastille de ses gestes : 180,6 à son échelle, et
  // 88 px), et jamais en changeant son échelle : il reste aussi grand. Passé 1080 px de haut, rien ne la borne.
  const plancher = 'calc(var(--k) * 180.6px + 88px)'
  const laisse = (h: string) => `calc(${h} - var(--haut-du-menu, 0px) - var(--haut-du-bandeau, 0px) - max(var(--chez-haut), env(safe-area-inset-top)) - var(--chez-reste))`
  const borne = section.slice(section.indexOf('@media (max-height: 1079px) {\n  .chez-scene {'))
  assert.ok(borne.startsWith(`@media (max-height: 1079px) {\n  .chez-scene { max-height: max(${plancher}, ${laisse('100vh')}); }\n  @supports (height: 100svh) {\n    .chez-scene { max-height: max(${plancher}, ${laisse('100svh')}); }\n  }\n}`), borne.slice(0, 600))
  // Rognée, son terrain s'arrête avec elle : plus haut que son cadre, son jardin aurait de quoi défiler de haut en bas.
  assert.match(section, /\.chez-scene \.jardin-terrain \{ max-height: 100%; \}/)
  // Ce plancher est celui de sa cour : le haut de sa plaque à son échelle — sa niche (`NICHE`, `jardin.ts` : 46, puis
  // 112 × 62 / 54 de haut), sa plaque 6 plus bas (`MonCompagnon.tsx`) —, puis, en pixels, sa plaque (34), 8 d'air, la
  // pastille de ses gestes (38), à 6 du bord, et les deux bords de la scène. Une niche déplacée, une plaque ou une
  // pastille plus haute : le plancher suit, ici et dans la feuille.
  const { NICHE } = await import(client('components/jardin.ts'))
  assert.equal(Math.round((NICHE.haut + (NICHE.l * 62) / 54 + 6) * 10) / 10, 180.6)
  assert.ok(readFileSync(new URL('../../client/src/components/MonCompagnon.tsx', import.meta.url), 'utf8').includes('top: (NICHE.haut + (NICHE.l * 62) / 54 + 6) * k'))
  assert.match(section, /\.chez-gestes \{[^}]*bottom: 6px;/)
  assert.match(section, /\.chez-pastille \{[^}]*height: 38px;/)
  assert.match(section, /\.chez-scene \{[^}]*border: 1px solid/)
  assert.equal(34 + 8 + 38 + 6 + 2, 88)
  // Ce qu'un téléphone tait n'est caché qu'à l'œil, comme `.sr-only` : « Mon profil », au-dessus du titre, que
  // « ← Mon profil » dit déjà juste au-dessus. Jamais `display: none` : le lecteur d'écran ne le lirait plus.
  const cache = '{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }'
  assert.ok(bloc.includes(`@media (max-height: 1079px) {\n  .chez-page > .piece-tete .label,\n  .chez-lui > .piece-tete .label ${cache}\n}`))
  assert.doesNotMatch(bloc, /display: none/)
  // La ligne de son cadeau : une rangée haute d'une ligne, où ses morceaux passent entiers ou pas du tout — sur un
  // téléphone ; passé 1080 px de haut, la phrase entière, comme avant.
  const cadeau = section.slice(section.indexOf('@media (max-height: 1079px) {\n  .chez-cadeau-texte b'))
  assert.ok(
    cadeau.startsWith(
      '@media (max-height: 1079px) {\n  .chez-cadeau-texte b { line-height: 1.25; }\n  .chez-cadeau-detail { display: flex; flex-wrap: wrap; align-content: flex-start; height: 1.3em; line-height: 1.3; overflow: clip; }\n  .chez-cadeau-essentiel { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n  .chez-cadeau-suite { flex: none; white-space: pre; }\n',
    ),
    cadeau.slice(0, 500),
  )
})

// ── Sur un serveur jetable ────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris : aucune saison. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const BASE = baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] })

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT, baseDeLaCampagne: BASE })
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

function enBase<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) => enBase(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Des confettis : une partie du quiz du jour d'avant, avec ses bonnes réponses. */
function confettis(banc: Banc, profileId: string, justes: number) {
  enBase(banc, db =>
    db
      .prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, ?, 1, 0)`,
      )
      .run(profileId, justes),
  )
}

/** Une série de campagne d'avant, ses `n` bonnes réponses données avec `compagnon` dans sa niche. */
function serieAvec(banc: Banc, profileId: string, id: string, n: number, compagnon: string) {
  enBase(banc, db => {
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES (?, ?, '[]', ?, 3, ?, 1, 2)`).run(id, profileId, n, n)
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1, 2, ?)')
    db.transaction(() => {
      for (let i = 0; i < n; i++) reponse.run(id, i, `${id}-${i}`, compagnon)
    })()
  })
}

const lire = async (banc: Banc, cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
const reponse = async (r: Response) => ({ status: r.status, corps: (await r.json()) as any })
const adopter = (banc: Banc, cookie: string, corps: object) => ecrire(banc.url, '/api/joueur/compagnons', corps, cookie).then(reponse)
const regler = (banc: Banc, cookie: string | undefined, cle: string, corps: object) => ecrire(banc.url, `/api/joueur/compagnons/${cle}`, corps, cookie, 'PUT').then(reponse)
const changer = (banc: Banc, cookie: string, patch: object) => ecrire(banc.url, '/api/joueur/moi', patch, cookie, 'PUT').then(reponse)

test('adopté, il s’installe dans sa niche sans devenir son avatar ; le suivant y entre, ou attend son tour', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    confettis(banc, idDe(banc, 'alice'), 3000)

    const loup = await adopter(banc, cookie, { compagnon: 'loup' })
    assert.equal(loup.status, 200, loup.corps.error)
    assert.equal(loup.corps.profile.niche, 'loup')
    assert.equal(loup.corps.profile.legendaire, null, 'sa maison, pas son avatar : il se porte en le choisissant, dans la loge')
    // Le suivant, s'il le veut : le loup garde sa niche.
    const chat = await adopter(banc, cookie, { compagnon: 'chat', installer: false })
    assert.equal(chat.status, 200, chat.corps.error)
    assert.equal(chat.corps.profile.niche, 'loup')
    // Une page d'avant demandait à le porter : l'adoption ne touche plus à l'avatar.
    const tortue = await adopter(banc, cookie, { compagnon: 'tortue', porter: true })
    assert.equal(tortue.corps.profile.niche, 'tortue')
    assert.equal(tortue.corps.profile.legendaire, null)
    assert.equal((await lire(banc, cookie)).avatar, '🦊')
  }))

test('son nom et la forme qu’il montre : à lui seul, vérifiés, gardés au réveil — une forme atteinte reprend la place', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const alice = idDe(banc, 'alice')
    confettis(banc, alice, 1000)
    assert.equal((await adopter(banc, cookie, { compagnon: 'loup' })).status, 200)
    assert.equal((await regler(banc, undefined, 'loup', { nom: 'Nox' })).status, 401, 'sans profil, pas de niche')

    // Son nom, nettoyé et borné ; vide, il redevient le loup.
    const nomme = await regler(banc, cookie, 'loup', { nom: '  Nox   le   Grand ' })
    assert.equal(nomme.status, 200, nomme.corps.error)
    assert.deepEqual(nomme.corps.profile.compagnons, [{ compagnon: 'loup', rang: 0, nom: 'Nox le Grand' }])
    assert.equal((await regler(banc, cookie, 'loup', { nom: 'Grandiosissimeloup' })).corps.profile.compagnons[0].nom, 'Grandiosissimelo')
    assert.deepEqual((await regler(banc, cookie, 'loup', { nom: '' })).corps.profile.compagnons, [{ compagnon: 'loup', rang: 0 }])
    // Ce qu'il n'a pas est refusé en clair.
    const chat = await regler(banc, cookie, 'chat', { nom: 'Mistigri' })
    assert.equal(chat.status, 400)
    assert.equal(chat.corps.error, 'Le Chat des lanternes s’achète d’abord, à la boutique')
    assert.equal((await regler(banc, cookie, 'dragon', { nom: 'Smaug' })).corps.error, 'Ce compagnon n’existe pas')
    assert.equal((await regler(banc, cookie, 'loup', { montree: 1 })).corps.error, 'Le jeune loup arrive à 100 bonnes réponses données avec lui')
    for (const montree of [7, -1, 0.5, 'x']) assert.equal((await regler(banc, cookie, 'loup', { montree })).corps.error, 'Cette forme n’existe pas', String(montree))

    // Grandi d'une forme : le louveteau peut revenir dans sa niche.
    serieAvec(banc, alice, 's1', 120, 'loup')
    const louveteau = await regler(banc, cookie, 'loup', { montree: 0, nom: 'Nox' })
    assert.equal(louveteau.status, 200, louveteau.corps.error)
    assert.deepEqual(louveteau.corps.profile.compagnons, [{ compagnon: 'loup', rang: 1, montree: 0, nom: 'Nox' }])
    // Sa plus grande forme, choisie, n'est plus un choix : elle suivra sa croissance.
    assert.deepEqual((await regler(banc, cookie, 'loup', { montree: 1 })).corps.profile.compagnons, [{ compagnon: 'loup', rang: 1, nom: 'Nox' }])
    assert.equal((await regler(banc, cookie, 'loup', { montree: 0 })).status, 200)
    // Retenus par le serveur, pour tous ses appareils : un réveil les garde.
    await banc.redemarrer({ disqueEfface: true })
    assert.deepEqual((await lire(banc, cookie)).compagnons, [{ compagnon: 'loup', rang: 1, montree: 0, nom: 'Nox' }])

    // Une forme atteinte reprend la place : il grandit pour de bon, sous ses yeux.
    serieAvec(banc, alice, 's2', 200, 'loup')
    const grandi = await lire(banc, cookie)
    assert.deepEqual(grandi.compagnons, [{ compagnon: 'loup', rang: 2, nom: 'Nox' }])
    assert.equal(enBase(banc, db => (db.prepare('SELECT montree FROM profile_compagnons WHERE profile_id = ?').get(alice) as { montree: number | null }).montree), null)

    // Sa fiche lit tous ses compagnons, et où chacun en est.
    const fiche = (await (await fetch(`${banc.url}/api/joueur/niche`, { headers: { Cookie: cookie } })).json()) as any
    assert.deepEqual(fiche, {
      niche: { compagnon: 'loup', rang: 2, nom: 'Nox', justes: 320 },
      compagnons: [{ compagnon: 'loup', rang: 2, nom: 'Nox', justes: 320 }],
      neuves: [],
    })
    // La carte que la salle ouvre montre le compagnon de sa niche avec son nom
    // (le propriétaire, le 19 octobre 2026 : « Le compagnon sur la carte doit
    // avoir son nom » ; il n'était qu'à lui jusque-là) — l'instantané, lui,
    // n'en dit toujours rien.
    const carte = ((await (await fetch(`${banc.url}/api/joueur/carte`, { headers: { Cookie: cookie } })).json()) as any).profil
    assert.deepEqual(carte.compagnon, { compagnon: 'loup', rang: 2, nom: 'Nox' })
  }))

test('une niche jamais choisie se fige au démarrage : changer d’avatar ne déménage plus personne', () =>
  avecBanc(async banc => {
    const cookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    await inscrireProfil(banc.url, 'bruno', 'Bruno', '🐻')
    const alice = idDe(banc, 'alice')
    const bruno = idDe(banc, 'bruno')
    // D'avant la niche : Alice porte son louveteau, sa tortue est plus grande ;
    // Bruno porte une forme du loup qu'il n'a pas atteinte — elle ne compte pas.
    enBase(banc, db => {
      const ligne = db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, ?, 1)')
      ligne.run(alice, 'tortue', 2)
      ligne.run(alice, 'loup', 0)
      ligne.run(bruno, 'loup', 0)
      ligne.run(bruno, 'chat', 1)
      db.prepare(`UPDATE profiles SET legendaire = 'cp:loup-louveteau', niche = NULL WHERE id = ?`).run(alice)
      db.prepare(`UPDATE profiles SET legendaire = 'cp:loup-jeune', niche = NULL WHERE id = ?`).run(bruno)
      db.prepare(`DELETE FROM meta WHERE key = 'niches_installees'`).run()
    })
    await banc.redemarrer()
    const niches = enBase(banc, db => db.prepare('SELECT login, niche FROM profiles WHERE id IN (?, ?) ORDER BY login').all(alice, bruno))
    assert.deepEqual(niches, [
      { login: 'alice', niche: 'loup' },
      { login: 'bruno', niche: 'chat' },
    ], 'celui qu’il portait — c’était le seul qui grandissait —, sinon le plus grand des siens')
    // Ôter le loup de son avatar ne le fait plus déménager.
    assert.equal((await changer(banc, cookie, { avatar: '🦊' })).corps.profile.niche, 'loup')
    // Une fois pour toutes : une niche rendue vide après coup le reste en base, et vaut le plus grand des siens.
    assert.equal((await changer(banc, cookie, { niche: null })).corps.profile.niche, 'tortue')
    await banc.redemarrer()
    assert.equal(enBase(banc, db => (db.prepare('SELECT niche FROM profiles WHERE id = ?').get(alice) as { niche: string | null }).niche), null)
  }))

/** Le hasard qui fait tirer ce compagnon d'un coffre royal, cherché par le tirage lui-même. */
function hasardPour(voulu: string, siens: ReadonlySet<string>): () => number {
  const possede = (o: ObjetDuTresor) => o.sorte === 'compagnon' && siens.has(o.cle)
  for (let a = 0; a < 100; a++) {
    for (let b = 0; b < 100; b++) {
      const suite = [a / 100, b / 100]
      let i = 0
      const { objet } = tirerLeCoffre('royal', { possede, hasard: () => suite[i++] ?? 0, jour: '2026-10-19' })
      if (objet.sorte === 'compagnon' && objet.cle === voulu) {
        let j = 0
        return () => suite[j++] ?? 0
      }
    }
  }
  throw new Error(`aucun tirage ne donne ${voulu}`)
}

test('un compagnon que donne le coffre s’installe dans une niche vide, jamais à la place de celui qui y vit', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-ma-niche-'))
  const profils = new ProfileStore(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`)
  try {
    await profils.init()
    const { profile } = await profils.register({ login: 'lea', password: 'motdepasse1', name: 'Léa', avatar: '🦊' })
    const ouvrir = (semaine: string, voulu: string, siens: string[]) =>
      profils.ouvrirUnCoffre(profile.id, semaine, 7, { hasard: hasardPour(voulu, new Set(siens)), jour: '2026-10-19', quand: Date.now() })
    assert.deepEqual((await ouvrir('2026-10-05', 'chat', [])).objet, { sorte: 'compagnon', cle: 'chat' })
    assert.equal(profils.toPublic((await profils.byId(profile.id))!).niche, 'chat')
    // Le loup, premier du catalogue, à la même forme : il aurait pris la niche vide.
    assert.deepEqual((await ouvrir('2026-10-12', 'loup', ['chat'])).objet, { sorte: 'compagnon', cle: 'loup' })
    assert.equal(profils.toPublic((await profils.byId(profile.id))!).niche, 'chat')
    const db = new Database(path.join(dir, 'permanente.db'))
    try {
      assert.equal((db.prepare('SELECT niche FROM profiles WHERE id = ?').get(profile.id) as { niche: string }).niche, 'chat', 'écrit en base')
    } finally {
      db.close()
    }
  } finally {
    ;(profils as any).close?.()
    rmSync(dir, { recursive: true, force: true })
  }
})

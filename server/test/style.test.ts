// Le style de « Ma collection » en albums, et la loge qui ne montre que ce
// qu'on a (le souhait du propriétaire du 13 octobre 2026 : « savoir s'il
// manque des choses » dans le style, et « des finitions / bordures non
// débloquées qui apparaissent dans M'habiller alors que l'on ne les a pas » —
// « quelque chose d'homogène, cohérent et design »).
//
// Les fonds, les gerbes, les finitions et — nouvelles dans la collection —
// les bordures de ligue s'y rangent comme les avatars et les trophées : une
// case chacun, en couleur s'il est à lui, éteint sinon, ce qu'il faut sous sa
// case ; sa fiche dit comment l'avoir et où il en est, ou « Essayer », qui
// ouvre la loge avec lui sur la carte. Dans la loge, ce qui reste se compte,
// sans se montrer, et mène à la collection.
// Pas de serveur : des règles pures, et des composants rendus en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { objetsDuStyle } from '../../shared/style'
import { essaiDemande } from '../../shared/loge'
import { FONDS } from '../../shared/fonds'
import { GERBES } from '../../shared/gerbes'
import { FINITIONS } from '../../shared/profil'
import { LIGUES } from '../../shared/duels'
import { formatNumber } from '../../shared/typographie'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(url(`${fichier}.tsx`))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Un haut fait de carrière tel que la page le reçoit : son palier atteint, sa valeur. */
const piste = (key: string, fois: number, valeur: number) => ({ key, famille: 'carriere' as const, emoji: '', title: '', rule: '', ton: 'eclat' as const, fois, valeur })

/**
 * Maya, en route : niveau 12 et quatre finitions, douze jours de quiz du
 * jour, quatre d'affilée, une victoire — Le Laurier, et ses ballons —, la
 * bordure de bronze sertie et trois crans à celle d'argent ; aucun fond.
 */
const MAYA = {
  id: 'p1',
  login: 'maya',
  name: 'Maya',
  avatar: '🦊',
  niveau: 12,
  finition: 'holo',
  finitionChoisie: 'auto',
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  eclats: [],
  legendaire: null,
  legendaires: [],
  divins: [],
  sentiers: {},
  compagnons: [],
  hautsFaits: [
    piste('hf:assidu', 1, 12),
    piste('hf:infatigable', 0, 4),
    piste('hf:champion-du-jour', 1, 1),
    { key: 'hf:laurier', famille: 'soiree' as const, emoji: '🌿', title: 'Le Laurier', rule: '', ton: 'eclat' as const, fois: 1 },
  ],
  titre: null,
  titresDates: [],
  vitrine: [],
  vitrineChoisie: null,
  fonds: [],
  fond: null,
  gerbes: ['confettis', 'ballons'],
  gerbe: 'ballons',
  bordures: [
    { ligue: 'bronze', crans: 12 },
    { ligue: 'argent', crans: 3 },
  ],
  bordureChoisie: 'auto',
  theme: null,
}

const loge = { essai: {}, essayer: () => {}, busy: false }

test('le style se dit comme les albums : chaque objet, ce qu’il faut, où, et où il en est — aux règles qui l’ouvrent', () => {
  const p = MAYA as any
  for (const [partie, n] of [['fonds', FONDS.length], ['gerbes', GERBES.length], ['finitions', FINITIONS.length], ['bordures', LIGUES.length]] as const) {
    assert.equal(objetsDuStyle(partie, p).length, n, partie)
  }
  const fonds = new Map(objetsDuStyle('fonds', p).map(o => [o.cle, o]))
  // La Nuit étoilée : L'Assidu · Argent, trente jours — elle en a douze.
  assert.deepEqual(fonds.get('nuit'), {
    cle: 'nuit',
    nom: 'Nuit étoilée',
    aLui: false,
    porte: false,
    court: '30 jours',
    etape: { lieu: 'jour', titre: 'Au quiz du jour : L’Assidu · Argent', regle: '30 jours de quiz du jour', progres: { acquis: 12, requis: 30, dit: '12 sur 30' } },
  })
  // L'Aurore boréale vient du niveau, de tout ce qu'on joue ; le Kintsugi, d'une étape sans métal ; le Cabinet, des maîtres ; le Triomphe, d'un titre.
  assert.deepEqual(fonds.get('aurore')!.etape, { lieu: 'niveau', titre: 'Au niveau 20', regle: 'Toute l’expérience compte, où que tu joues', progres: { acquis: 12, requis: 20, dit: 'niveau 12 sur 20' } })
  assert.equal(fonds.get('aurore')!.court, 'niv. 20')
  assert.equal(fonds.get('kintsugi')!.etape.titre, 'Au quiz du jour : Le Champion du jour, 10 victoires')
  assert.deepEqual(fonds.get('kintsugi')!.etape.progres, { acquis: 1, requis: 10, dit: '1 sur 10' })
  assert.deepEqual([fonds.get('cabinet')!.etape.titre, fonds.get('cabinet')!.etape.progres?.dit], ['Sur les sentiers : 3 maîtres', '0 sur 3'])
  assert.deepEqual([fonds.get('triomphe')!.etape.titre, fonds.get('triomphe')!.etape.progres, fonds.get('triomphe')!.court], ['Au quiz du jour : champion du mois', null, 'champion'])
  // Un fond des savoirs s'achète : ses confettis comptent vers son prix — un solde sous zéro, pour rien.
  const enPoche = (solde: number) => objetsDuStyle('fonds', { ...p, boutique: { confettis: { gagnes: 0, depenses: 0, solde } } }).find(o => o.cle === 'jazz')!
  assert.deepEqual(enPoche(120), {
    cle: 'jazz',
    nom: 'Le Club de jazz',
    aLui: false,
    porte: false,
    court: '🎊 250',
    etape: { lieu: 'boutique', titre: 'En boutique : 250 confettis', regle: 'Un fond par savoir — celui-ci habille Musique', progres: { acquis: 120, requis: 250, dit: '🎊 120 sur 250' } },
  })
  assert.equal(enPoche(-40).etape.progres?.dit, '🎊 0 sur 250')
  // Un fond du trésor ne se vend pas : le coffre seul, à sa rareté.
  assert.deepEqual([fonds.get('dragon')!.etape.lieu, fonds.get('dragon')!.court, fonds.get('dragon')!.rarete], ['coffre', 'coffre', 'legendaire'])
  assert.equal(fonds.get('jazz')!.rarete, undefined, 'un fond de la boutique n’a pas de rareté : un seul prix')

  const gerbes = new Map(objetsDuStyle('gerbes', p).map(o => [o.cle, o]))
  // Les confettis, à tout profil ; les ballons, portés, du Laurier ; un palier dit son métal, et où il en est.
  assert.deepEqual([gerbes.get('confettis')!.aLui, gerbes.get('confettis')!.etape.lieu, gerbes.get('confettis')!.court], [true, 'profil', 'offerte'])
  assert.deepEqual([gerbes.get('ballons')!.aLui, gerbes.get('ballons')!.porte, gerbes.get('ballons')!.etape.titre], [true, true, 'Au quiz du jour : « Le Laurier »'])
  assert.deepEqual(gerbes.get('petales')!.etape, {
    lieu: 'jour',
    titre: 'Au quiz du jour : L’Infatigable · Bronze',
    regle: '7 jours d’affilée',
    progres: { acquis: 4, requis: 7, dit: '4 sur 7' },
  })
  assert.equal(gerbes.get('etoiles')!.court, 'Le Sans-Faute · Bronze')
  assert.equal(gerbes.get('etoiles')!.etape.progres, null, 'un seul sans-faute : rien à compter')

  const finitions = objetsDuStyle('finitions', p)
  // « Auto » porte la plus belle : c'est elle qu'on voit, cochée.
  assert.deepEqual(finitions.filter(o => o.porte).map(o => o.cle), ['holo'])
  // Les cinq de prestige à leur suite, du 30 au 50 (le 1er novembre 2026).
  assert.deepEqual(finitions.map(o => `${o.cle}${o.aLui ? '' : ` ${o.court}`}`), [
    'mat',
    'argent',
    'or',
    'holo',
    'prisme niv. 15',
    'aurore niv. 20',
    'constellation niv. 25',
    'abysses niv. 30',
    'orage niv. 35',
    'envol niv. 40',
    'disco niv. 45',
    'singularite niv. 50',
  ])
  assert.deepEqual(finitions.find(o => o.cle === 'prisme')!.etape.progres, { acquis: 12, requis: 15, dit: 'niveau 12 sur 15' })
  assert.deepEqual([finitions[0].etape.titre, finitions[0].etape.progres], ['Dès le niveau 1', null])

  const bordures = objetsDuStyle('bordures', p)
  // Sertie, trois crans, puis les ligues à atteindre, chacune sa cote ; d'office, la plus haute qui a un cran.
  assert.deepEqual(
    bordures.map(o => `${o.cle} ${o.court}${o.porte ? ' portée' : ''}`),
    ['bronze sertie', 'argent 3/12 portée', ...LIGUES.slice(2).map(l => `${l.cle} cote ${formatNumber(l.depuis)}`)],
  )
  assert.deepEqual(bordures[2].etape, {
    lieu: 'duels',
    titre: 'Aux duels : la ligue d’or',
    regle: `Une cote de ${formatNumber(1200)}, une fois : elle reste, même si ta cote redescend`,
    progres: null,
  })
  // Avant le premier duel classé, le serveur les tait : six à gagner, la première au premier duel.
  const debutant = objetsDuStyle('bordures', { ...p, bordures: undefined })
  assert.deepEqual([debutant.filter(o => o.aLui).length, debutant[0].court, debutant[0].etape.titre], [0, '1ᵉʳ duel', 'Aux duels : ton premier duel classé'])
})

test('l’album du style : ce qu’il a en couleur, ce qui reste éteint — la fiche dit comment l’avoir, ou « Essayer »', async () => {
  const cases = (html: string) =>
    [...html.matchAll(/<button type="button" class="trophee-case style-case( trophee-manque)?"[^>]*aria-label="([^"]+)"/g)].map(m => `${m[2]}${m[1] ? ' (éteint)' : ''}`)
  const finitions = await rendu('components/AlbumDuStyle', 'AlbumDuStyle', { partie: 'finitions', profil: MAYA })
  assert.deepEqual(cases(finitions), [
    'Mat, à toi',
    'Argent, à toi',
    'Or, à toi',
    'Holo, portée',
    'Prisme, à gagner : niv. 15 (éteint)',
    'Aurore, à gagner : niv. 20 (éteint)',
    'Constellation, à gagner : niv. 25 (éteint)',
    'Abysses, à gagner : niv. 30 (éteint)',
    'Orage, à gagner : niv. 35 (éteint)',
    'Envol, à gagner : niv. 40 (éteint)',
    'Disco, à gagner : niv. 45 (éteint)',
    'Singularité, à gagner : niv. 50 (éteint)',
  ])
  // Les cases de l'album des trophées : l'aperçu, son nom, ce qu'il faut dessous — rien ne s'y porte.
  assert.match(finitions, /<div class="trophees-grille style-grille style-finitions">/)
  assert.doesNotMatch(finitions, /aria-pressed|Le porter/)
  const bordures = await rendu('components/AlbumDuStyle', 'AlbumDuStyle', { partie: 'bordures', profil: MAYA })
  assert.match(bordures, /aria-label="Le Perlé, portée"><span class="trophee-medaillon" aria-hidden="true">.*?<span class="album-coche">/)
  assert.match(bordures, /<span class="trophee-nom" aria-hidden="true">Le Perlé<\/span><span class="trophee-sous" aria-hidden="true">3\/12<\/span>/)

  // La fiche d'une finition à gagner : où il en est, et pas d'écran où aller — le niveau vient de tout ce qu'on joue.
  const fiche = async (partie: string, cle: string) => {
    const o = objetsDuStyle(partie as any, MAYA as any).find(x => x.cle === cle)!
    return rendu('components/AlbumDuStyle', 'FicheDuStyle', { o, partie, visuel: null })
  }
  const prisme = await fiche('finitions', 'prisme')
  assert.match(prisme, /<b class="galerie-detail-nom">Prisme<\/b><span class="album-detail-rarete">Finition<\/span>/)
  assert.match(prisme, /<span class="label album-etiquette">Comment l’obtenir<\/span><div class="album-etape"><span class="album-etape-icone" aria-hidden="true"><svg/)
  assert.match(prisme, /<b>Au niveau 15<\/b>.*<span>niveau 12 sur 15<\/span>/)
  assert.doesNotMatch(prisme, /album-essayer|album-aller|À toi/)
  // Un fond à gagner : le chemin de l'écran qui le donne.
  assert.match(await fiche('fonds', 'nuit'), /<a class="btn btn-small album-aller" href="\/jour">Jouer le quiz du jour<\/a>/)
  assert.match(await fiche('bordures', 'or'), /<a class="btn btn-small album-aller" href="\/duels">Aller aux duels<\/a>/)
  // À lui : « Essayer », qui ouvre la loge avec elle sur la carte ; sans jauge ni chemin.
  const or = await fiche('finitions', 'or')
  assert.match(or, /<p class="small album-a-toi"><svg[^>]*>.*?<\/svg><span>À toi\.<\/span><\/p>/)
  assert.match(or, /<a class="btn btn-small album-essayer" href="\?essayer=finition%3Aor#avatar">Essayer<\/a>/)
  // Accordée à ce qu'elle montre : une finition, une gerbe, une bordure se gagnent « elle » ; un fond, « il ».
  assert.match(or, /<span class="label album-etiquette">Comment elle se gagne<\/span><div class="album-etape album-tenue">/)
  assert.doesNotMatch(or, /album-progres|album-aller/)
  assert.match(await fiche('gerbes', 'confettis'), /Comment elle se gagne/)
  const nuit = objetsDuStyle('fonds', { ...MAYA, fonds: ['nuit'] } as any).find(x => x.cle === 'nuit')!
  assert.match(await rendu('components/AlbumDuStyle', 'FicheDuStyle', { o: nuit, partie: 'fonds', visuel: null }), /Comment il se gagne/)
  // Un fond de la boutique : sa fiche ouvre la sienne, dans le rayon ; acheté, il ne s'est pas gagné.
  assert.match(await fiche('fonds', 'jazz'), /<a class="btn btn-small album-aller" href="\/boutique#fond-jazz">Le voir en boutique<\/a>/)
  const jazz = objetsDuStyle('fonds', { ...MAYA, fonds: ['jazz'] } as any).find(x => x.cle === 'jazz')!
  const achete = await rendu('components/AlbumDuStyle', 'FicheDuStyle', { o: jazz, partie: 'fonds', visuel: null })
  assert.match(achete, /Comment il s’achète/)
  assert.doesNotMatch(achete, /album-aller/)
  // Un fond du trésor dit sa rareté au coffre, et mène aux missions qui le remplissent.
  const dragon = await fiche('fonds', 'dragon')
  assert.match(dragon, /<span class="album-detail-rarete">Fond de carte · Légendaire<\/span>/)
  assert.match(dragon, /<a class="btn btn-small album-aller" href="\/#missions">Mes missions du jour<\/a>/)
  // Ce qu'il porte déjà : rien de neuf à essayer. Une bordure dit ses crans, et ce qui manque pour la sertir.
  const perle = await fiche('bordures', 'argent')
  assert.match(perle, /À toi, et tu la portes\./)
  assert.doesNotMatch(perle, /album-essayer/)
  assert.match(perle, /3 crans sur 12\s: encore 9 victoires dans sa ligue pour la sertir\./)
  assert.match(perle, /<span class="album-detail-rarete">Bordure de ligue · Argent<\/span>/)
  // Une gerbe touchée éclate, même à gagner : on sait ce qu'on vise.
  assert.match(source('components/AlbumDuStyle.tsx'), /if \(partie === 'gerbes'\) setEclat\(e => \(\{ cle: o\.cle, n: \(e\?\.n \?\? 0\) \+ 1 \}\)\)/)
})

test('« Essayer », d’une fiche de la collection : la loge s’ouvre l’objet sur la carte — seulement ce qui est à lui', async () => {
  const p = MAYA as any
  // Les clés de la loge : celles de ses nouveautés (`ceQuIlAPorter`).
  assert.deepEqual(essaiDemande('avatar', 'finition:or', p), { finition: 'or' })
  assert.deepEqual(essaiDemande('avatar', 'finition:prisme', p), {}, 'pas encore à elle')
  assert.deepEqual(essaiDemande('avatar', 'bordure:bronze', p), { bordure: 'bronze' })
  assert.deepEqual(essaiDemande('avatar', 'bordure:or', p), {}, 'une ligue pas atteinte')
  assert.deepEqual(essaiDemande('avatar', 'bordure:bronze:sertie', p), {}, 'une nouveauté, pas une bordure')
  assert.deepEqual(essaiDemande('fond', 'finition:or', p), {}, 'sur la pièce de l’adresse seulement')
  // Un avatar de l'album : un légendaire, un portrait, une forme de compagnon — à elle.
  assert.deepEqual(essaiDemande('avatar', 'lg:phenix', { ...p, legendaires: ['lg:phenix'] }), { legendaire: 'lg:phenix' })
  assert.deepEqual(essaiDemande('avatar', 'lg:phenix', p), {})
  assert.deepEqual(essaiDemande('avatar', 'br:ecureuil', { ...p, sentiers: { foret: 2 } }), { legendaire: 'br:ecureuil' })
  assert.deepEqual(essaiDemande('avatar', 'cp:loup-louveteau', { ...p, compagnons: [{ compagnon: 'loup', rang: 0 }] }), { legendaire: 'cp:loup-louveteau' })
  // Ce qu'il porte déjà ne s'essaie pas : rien de neuf sur la carte.
  assert.deepEqual(essaiDemande('gerbe', 'ballons', p), {})
  assert.deepEqual(essaiDemande('gerbe', 'confettis', p), { gerbe: 'confettis' })

  // L'adresse de chaque objet, et le lien suivi sans recharger la page : la loge lit l'essai en s'ouvrant.
  const { adresseDeLEssaiDuStyle } = await import(url('components/AlbumDuStyle.tsx'))
  const bordure = objetsDuStyle('bordures', p).find(o => o.cle === 'bronze')
  assert.equal(adresseDeLEssaiDuStyle('bordures', bordure), '?essayer=bordure%3Abronze#avatar')
  assert.equal(adresseDeLEssaiDuStyle('gerbes', objetsDuStyle('gerbes', p)[0]), '?essayer=confettis#gerbe')
  const profil = source('views/ProfilApp.tsx')
  assert.match(profil, /closest\?\.\('a\[href\^="#"\], a\[href\^="\?essayer="\]'\)/)
  assert.match(profil, /ouvrir\(cible, adresse, lien\.startsWith\('\?'\) \? lien\.slice\(0, diese\) : window\.location\.search\)/)
  assert.match(profil, /history\.pushState\(\{ \.\.\.history\.state, \[DEPUIS\]: lireEcran\(\) \}, '', `\$\{window\.location\.pathname\}\$\{requete\}#\$\{adresse\}`\)/)
})

test('dans la loge, les finitions et les bordures qu’il n’a pas se comptent au bout de la rangée, sans se montrer', async () => {
  const bordures = await rendu('components/Apparence', 'MesBordures', { profil: MAYA, ...loge })
  // Auto, Sans, ses deux ligues, puis « +4 » : ni fantôme, ni lien aux duels au milieu des siennes.
  assert.deepEqual([...bordures.matchAll(/<button type="button" class="finition-choix bordure-choix[^"]*"[^>]*aria-label="([^"]+)"/g)].map(m => m[1].split(',')[0]), [
    'Auto',
    'Sans bordure',
    'Le Moletage',
    'Le Perlé',
  ])
  assert.doesNotMatch(bordures, /bordure-fermee|href="\/duels"/)
  assert.match(
    bordures,
    /<a class="finition-choix pastille-a-gagner" href="#collection-bordures" aria-label="4 bordures à gagner : où et comment, dans « Ma collection »"><i class="finition-teinte teinte-a-gagner" aria-hidden="true">\+4<\/i><span aria-hidden="true">à gagner<\/span><\/a>/,
  )
  // Peu de pastilles : à gauche.
  assert.match(bordures, /<div class="loge-finitions-rangee rangee-courte loge-bordures-rangee" role="group"/)
  // Ses six ligues : rien à compter.
  const toutes = await rendu('components/Apparence', 'MesBordures', { profil: { ...MAYA, bordures: LIGUES.map(l => ({ ligue: l.cle, crans: 1 })) }, ...loge })
  assert.doesNotMatch(toutes, /pastille-a-gagner/)
  // Sans duel classé : comment ouvrir la première, et le chemin des duels.
  const sansDuel = await rendu('components/Apparence', 'MesBordures', { profil: { ...MAYA, bordures: undefined }, ...loge })
  assert.match(sansDuel, /Ton premier duel classé ouvre la bordure de ta ligue/)
  assert.match(sansDuel, /<a href="\/duels">Jouer un duel<\/a>/)
  // La pastille et la rangée courte ont leurs règles.
  const CSS = source('styles.css')
  assert.match(CSS, /\.loge-finitions-rangee\.rangee-courte \{ justify-content: flex-start;/)
  assert.match(CSS, /\.teinte-a-gagner \{ border: 1\.5px dashed var\(--edge-strong\);/)
  assert.doesNotMatch(CSS, /\.finition-fermee|\.bordure-fermee/)
})

test('chaque pièce de la loge finit par le même lien : « N à gagner : où ? », vers sa ligne de la collection', async () => {
  const fond = await rendu('components/Apparence', 'MonFond', { profil: MAYA, ...loge })
  // Les six fonds et les six gerbes du trésor du coffre de la semaine comptés avec les autres ; les
  // douze fonds des savoirs, qui s'achètent, à la boutique — comme les thèmes : deux liens.
  assert.match(fond, /<a class="loge-a-gagner" href="#collection-fonds">13 fonds à gagner\s:\soù\s\?<svg/)
  assert.match(fond, /<a class="link-inline lien-boutique" href="\/boutique#fonds"><svg[^>]*>.*?<\/svg>12 autres à la boutique<\/a>/)
  const gerbe = await rendu('components/Apparence', 'MaGerbe', { profil: MAYA, ...loge })
  // Et les huit des fêtes, du 1er novembre 2026.
  assert.match(gerbe, /<a class="loge-a-gagner" href="#collection-gerbes">23 gerbes à gagner\s:\soù\s\?<svg/)
  const titre = await rendu('components/Apparence', 'MonTitre', { profil: MAYA, ...loge })
  // Un seul de ses quatre trophées lui reste : au singulier.
  assert.match(titre, /<a class="loge-a-gagner" href="#collection-trophees">1 titre à gagner\s:\soù\s\?<svg/)
  // Plus d'autre façon de le dire : ni cadenas parmi les titres, ni « où et comment » au long. Le
  // seul autre lien d'une pièce, depuis que les fonds des savoirs s'achètent (le 15 octobre 2026),
  // mène à la boutique — celui des thèmes, à l'identique.
  const APPARENCE = source('components/Apparence.tsx')
  assert.doesNotMatch(APPARENCE, /AGagnerDansLaCollection|titre-choix ferme|lien-boutique" href=\{?[`"']#collection/)
  assert.equal(APPARENCE.match(/lien-boutique/g)?.length, 1, 'un seul, celui du fond')
  assert.match(APPARENCE, /<a className="link-inline lien-boutique" href="\/boutique#fonds">/)
  assert.match(source('components/Boutique.tsx'), /<AGagner n=\{aGagner\} un="thème" plusieurs="thèmes" href="#collection-themes" \/>/)
  // Un seul composant, dans les pièces partagées de la collection.
  assert.match(source('components/LigneDeCollection.tsx'), /export function AGagner\(/)
})

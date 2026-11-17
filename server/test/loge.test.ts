// La loge : « M'habiller », tout ce qu'on porte sur un écran (la maquette
// validée par le propriétaire le 12 octobre 2026). On essaie d'abord — la
// carte en tête montre l'essai, le thème habille toute la page, la gerbe
// éclate —, puis « Porter » enregistre tout l'essai d'un coup, et
// « Annuler » rend la tenue d'avant. Six pages, une par pièce, se quittaient
// et se rouvraient pour changer d'avatar puis de titre, et chaque toucher
// enregistrait : on portait ce qu'on voulait seulement voir. Une pastille
// dit ce qui est nouveau depuis le dernier passage, sur ce téléphone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { AUCUNE_GERBE, gerbe } from '../../shared/gerbes'
import { HAUTS_FAITS_DE_CARRIERE, HAUTS_FAITS_REGAGNABLES, type HautFaitVu } from '../../shared/hautsfaits'
import { LEGENDAIRES, estScellable, legendaire } from '../../shared/legendaires'
import { brancheDe, portrait } from '../../shared/branches'
import { fond } from '../../shared/fonds'
import { NOM_FINITION, meilleureFinition } from '../../shared/profil'
import { PIECES_DE_LA_LOGE, avecLEssai, carteAvecLEssai, ceQuIlAPorter, essaiVide, essayer, lignesDeLEssai, nouveautes, retenirLesVus, type Tenue, type VusDeLaLoge } from '../../shared/loge'
import type { CarteDeJoueur } from '../../shared/carte'
import { demarrer, ecrire, inscrireProfil } from './banc'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '#avatar', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '#avatar', origin: 'http://banc' },
})

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

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

/** Le texte d'un élément, enfants compris. */
function texte(noeud: any): string {
  if (Array.isArray(noeud)) return noeud.map(texte).join('')
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return ''
  if (typeof noeud !== 'object') return String(noeud)
  return texte(noeud.props?.children)
}

/** Le catalogue des hauts faits tel que la page le reçoit : ceux de `fois` gagnés. */
function hautsFaits(fois: Record<string, number> = {}): HautFaitVu[] {
  return [
    ...HAUTS_FAITS_REGAGNABLES.map(h => ({ key: h.key, famille: 'soiree' as const, emoji: h.emoji, title: h.title, rule: h.rule, ton: h.ton, fois: fois[h.key] ?? 0 })),
    ...HAUTS_FAITS_DE_CARRIERE.map(h => ({ key: h.key, famille: 'carriere' as const, emoji: h.emoji, title: h.title, rule: h.mesure, ton: 'eclat' as const, fois: 0, valeur: 0, prochain: h.paliers[0] })),
  ]
}

const badge = (key: string, emoji: string, title: string) => ({ key, emoji, title, fois: 1, dernier: 1, porteurs: 0, rarete: null })

/** Ce qu'il porte : le Phénix sur sa grenouille, les confettis d'office, rien d'autre. */
const PORTE: Tenue = { avatar: '🐸', legendaire: 'lg:phenix', finitionChoisie: 'auto', titre: null, vitrineChoisie: null, fond: null, theme: null, gerbe: 'confettis' }

/** Léa telle que sa page la reçoit : niveau 8, le Phénix, deux hauts faits, la forêt au quatrième palier. */
const LEA = {
  id: 'p-lea',
  login: 'lea',
  name: 'Léa',
  ...PORTE,
  finition: 'or' as const,
  xp: 0,
  niveau: 8,
  acquis: 10,
  requis: 100,
  ouvertes: ['mat', 'argent', 'or'],
  eclats: [],
  eclatsEteints: [],
  badges: 2,
  legendaires: ['lg:phenix'],
  divins: [],
  laurier: false,
  hautsFaits: hautsFaits({ 'hf:oracle': 1, 'hf:phenix': 1 }),
  vitrine: [badge('hf:oracle', '🔮', 'L’Oracle'), badge('hf:phenix', '🔥', 'Le Phénix')],
  sentiers: { foret: 4 },
  titresDates: [],
  fonds: ['nuit'],
  gerbes: ['confettis', 'etoiles'],
  boutique: { confettis: { gagnes: 12, depenses: 0, solde: 12 }, possedes: ['velours', 'ivoire'], porte: null, jour: '2026-10-12' },
}

const rien = { busy: false, enregistrer: () => {} }

test('l’essai retient ce qui diffère de ce qu’il porte — un avatar à la fois, et toute une tenue', () => {
  let e = essayer({}, { legendaire: 'lg:dragon' }, PORTE)
  assert.deepEqual(e, { legendaire: 'lg:dragon' })
  // Un emoji ôte le légendaire essayé, comme le serveur ôte le légendaire porté.
  e = essayer(e, { avatar: '🦊' }, PORTE)
  assert.deepEqual(e, { avatar: '🦊' })
  // Toucher le Phénix qu'il porte, c'est renoncer à l'essai — pas le « porter » une seconde fois.
  assert.deepEqual(essayer(e, { legendaire: 'lg:phenix' }, PORTE), {})
  // Sous le Phénix, revenir à son emoji est un changement ; sans lui, non.
  assert.deepEqual(essayer({}, { avatar: '🐸' }, PORTE), { avatar: '🐸' })
  assert.deepEqual(essayer({}, { avatar: '🐸' }, { ...PORTE, legendaire: null }), {})
  // Les pièces s'ajoutent : on essaie une tenue, puis on la porte d'un coup.
  e = essayer(essayer(essayer({}, { titre: 'hf:oracle' }, PORTE), { fond: 'nuit' }, PORTE), { theme: 'ocean' }, PORTE)
  assert.deepEqual(e, { titre: 'hf:oracle', fond: 'nuit', theme: 'ocean' })
  // Velours s'écrit null, comme le serveur le range — et c'est ce qu'il porte.
  assert.deepEqual(essayer(e, { theme: 'velours' }, PORTE), { titre: 'hf:oracle', fond: 'nuit' })
  // La gerbe portée se lit résolue : les confettis d'office, null pour aucune.
  assert.deepEqual(essayer({}, { gerbe: 'confettis' }, PORTE), {})
  assert.deepEqual(essayer({}, { gerbe: AUCUNE_GERBE }, PORTE), { gerbe: AUCUNE_GERBE })
  assert.deepEqual(essayer({}, { gerbe: AUCUNE_GERBE }, { ...PORTE, gerbe: null }), {})
  // La vitrine : la même, dans le même ordre — l'ordre est celui de la carte.
  const choisie = { ...PORTE, vitrineChoisie: ['hf:oracle', 'hf:phenix'] }
  assert.deepEqual(essayer({}, { vitrine: ['hf:oracle', 'hf:phenix'] }, choisie), {})
  assert.deepEqual(essayer({}, { vitrine: ['hf:phenix', 'hf:oracle'] }, choisie), { vitrine: ['hf:phenix', 'hf:oracle'] })
  assert.deepEqual(essayer({}, { vitrine: null }, PORTE), {})
  assert.deepEqual(essayer({}, { finition: 'auto' }, PORTE), {})
  assert.deepEqual(essayer({}, { finition: 'or' }, PORTE), { finition: 'or' })
  assert.deepEqual(essayer({}, { titre: null }, PORTE), {})
  assert.deepEqual(essayer({}, { fond: null }, PORTE), {})
  assert.equal(essaiVide({}), true)
  assert.equal(essaiVide({ fond: null }), false)
})

test('la carte de la loge montre l’essai — et rien de ce qu’il porte n’est touché', () => {
  const lea = { ...LEA }
  const vu = avecLEssai(lea, { avatar: '🦊', finition: 'auto', titre: 'hf:oracle', fond: 'nuit', vitrine: ['hf:oracle'], theme: 'ocean', gerbe: AUCUNE_GERBE })
  assert.equal(vu.avatar, '🦊')
  assert.equal(vu.legendaire, null, 'un emoji ôte le légendaire')
  assert.equal(vu.finitionChoisie, 'auto')
  assert.equal(vu.finition, meilleureFinition(8), 'la plus belle à son niveau')
  assert.equal(vu.titre, 'hf:oracle')
  assert.equal(vu.fond, 'nuit')
  assert.deepEqual(vu.vitrineChoisie, ['hf:oracle'])
  assert.equal(vu.theme, 'ocean')
  assert.equal(vu.gerbe, null)
  // Un légendaire essayé garde l'emoji dessous.
  assert.deepEqual([avecLEssai(lea, { legendaire: 'lg:dragon' }).legendaire, avecLEssai(lea, { legendaire: 'lg:dragon' }).avatar], ['lg:dragon', '🐸'])
  assert.deepEqual(lea, LEA, 'ce qu’il porte reste ce que la salle voit')
})

test('la barre dit ce qu’on essaie, pièce par pièce, dans l’ordre de la rangée', () => {
  const blaireau = portrait('br:blaireau')!
  assert.deepEqual(lignesDeLEssai({ theme: 'ocean', gerbe: 'etoiles', legendaire: 'lg:dragon', titre: 'maitre:foret', fond: 'nuit', vitrine: ['hf:oracle', 'hf:phenix'], finition: 'auto' }, { niveau: 14 }), [
    { piece: 'avatar', nom: legendaire('lg:dragon')!.nom, detail: 'Légendaire' },
    { piece: 'avatar', nom: `La plus belle · ${NOM_FINITION[meilleureFinition(14)]}`, detail: 'Finition' },
    { piece: 'titre', nom: '« Maître de la forêt »', detail: 'Titre' },
    { piece: 'vitrine', nom: '2 trophées choisis', detail: 'Vitrine' },
    { piece: 'fond', nom: fond('nuit')!.nom, detail: 'Fond de carte' },
    { piece: 'theme', nom: 'Océan', detail: 'Thème · Peu commune' },
    { piece: 'gerbe', nom: gerbe('etoiles')!.nom, detail: 'Gerbe' },
  ])
  assert.deepEqual(lignesDeLEssai({ legendaire: 'br:blaireau' }, { niveau: 3 }), [{ piece: 'avatar', nom: blaireau.nom, detail: `Portrait · ${brancheDe(blaireau).nom}` }])
  assert.deepEqual(lignesDeLEssai({ avatar: '🐝' }, { niveau: 8 }), [{ piece: 'avatar', nom: '🐝', detail: 'De collection · niveau 8' }])
  assert.deepEqual(
    lignesDeLEssai({ titre: null, vitrine: null, fond: null, theme: null, gerbe: AUCUNE_GERBE }, { niveau: 1 }).map(l => l.nom),
    ['Sans titre', 'Les plus durs, d’office', 'Velours', 'Velours', 'Aucune gerbe'],
  )
})

test('ce qui est nouveau : rien à la première visite, puis ce qui arrive depuis, pièce par pièce', () => {
  const a = ceQuIlAPorter(LEA as any)
  for (const cle of ['lg:phenix', 'br:ecureuil', 'br:blaireau', '🐝', 'finition:or']) assert.ok(a.avatar.includes(cle), cle)
  assert.ok(!a.avatar.includes('🦩'), 'l’emoji du niveau 9 n’est pas encore à elle')
  assert.deepEqual(a.titre, ['hf:phenix', 'hf:oracle'])
  assert.deepEqual(a.vitrine, ['hf:phenix', 'hf:oracle'], 'ceux que sa vitrine propose : gagnés, et sur son étagère')
  assert.deepEqual([a.fond, a.theme, a.gerbe], [['nuit'], ['velours', 'ivoire'], ['confettis', 'etoiles']])
  // Jamais vue sur ce téléphone : rien ne crie « nouveau », et tout se retient.
  const rienDeNeuf = { avatar: [], titre: [], vitrine: [], fond: [], theme: [], gerbe: [] }
  assert.deepEqual(nouveautes(a, {}), rienDeNeuf)
  const vus = retenirLesVus(a, {}, null)
  assert.deepEqual(Object.keys(vus).sort(), PIECES_DE_LA_LOGE.map(p => p.id).sort())
  assert.deepEqual(nouveautes(a, vus), rienDeNeuf)
  // Un thème acheté, une gerbe gagnée, un Éclat : nouveaux, chacun dans sa pièce.
  const apres = ceQuIlAPorter({ ...LEA, boutique: { ...LEA.boutique, possedes: ['velours', 'ivoire', 'jungle'] }, gerbes: ['confettis', 'etoiles', 'petales'], eclats: ['🐸'] } as any)
  assert.deepEqual(nouveautes(apres, vus), { ...rienDeNeuf, avatar: ['eclat:🐸'], theme: ['jungle'], gerbe: ['petales'] })
  // Regardée, la pièce du thème n'a plus rien de nouveau ; les autres gardent le leur.
  const regardee = retenirLesVus(apres, vus, 'theme')
  assert.deepEqual(nouveautes(apres, regardee), { ...rienDeNeuf, avatar: ['eclat:🐸'], gerbe: ['petales'] })
})

test('la loge : sa carte en tête, six pièces sur une rangée — la salle d’abord, lui seul ensuite —, puis la pièce touchée', async () => {
  const contenus: Record<string, RegExp> = {
    // L'avatar : ses finitions en pastilles (la maquette 3), puis ses avatars aux gemmes de l'album.
    avatar: /<div class="loge-finitions">.*<div class="gemmes gemmes-loge" role="tablist" aria-label="Mes avatars, par rareté">/,
    // Titre et Vitrine parlent la langue des vignettes (le 17 novembre 2026) : un en-tête d'une ligne, puis leurs choix.
    titre: /<h3 class="loge-entete-titre" id="loge-titre-entete">Mes titres<span class="loge-entete-compte">/,
    // Des trophées, le mot de l'album et des fins de partie.
    vitrine: /<h3 class="loge-entete-titre" id="loge-vitrine-entete">Mes trophées<span class="loge-entete-compte">/,
    // Les fonds et les gerbes, en vignettes : un en-tête d'une ligne (`EnteteDeLaPiece`), puis la grille.
    fond: /<h3 class="loge-entete-titre" id="loge-fonds">Mes fonds.*<ul class="loge-vignettes loge-vignettes-fonds" aria-labelledby="loge-fonds">/,
    theme: /<section class="mes-themes">/,
    gerbe: /<h3 class="loge-entete-titre" id="loge-gerbes">Mes gerbes.*<ul class="loge-vignettes loge-vignettes-gerbes" aria-labelledby="loge-gerbes">/,
  }
  for (const { id } of PIECES_DE_LA_LOGE) {
    const html = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: LEA, piece: id, onPiece: () => {}, busy: false, enregistrer: async () => true })
    // La carte en tête, collée pendant qu'on choisit : c'est elle qui change.
    // (React pose devant le préchargement de l'image du Phénix qu'elle porte.)
    assert.match(html, /^(<link rel="preload"[^>]*\/>)*<div class="loge"><div class="loge-collante"><div class="loge-carte">/, id)
    assert.match(html, /<span class="loge-carte-titre loge-sans">Sans titre<\/span>/, `${id} : la place du titre se voit`)
    // Les six pièces, dans l'ordre, une seule choisie — un seul arrêt de Tab.
    const pieces = [...html.matchAll(/<button id="loge-(\w+)" type="button" role="tab" aria-selected="(true|false)"[^>]*tabindex="(-1|0)"/g)].map(m => `${m[1]}${m[2] === 'true' ? '*' : ''}${m[3]}`)
    assert.deepEqual(
      pieces,
      PIECES_DE_LA_LOGE.map(p => (p.id === id ? `${p.id}*0` : `${p.id}-1`)),
      id,
    )
    assert.match(html, /<div class="loge-groupes" aria-hidden="true"><span>La salle voit<\/span><span>Toi seul<\/span><\/div><div class="loge-rangee" role="tablist" aria-label="Ce que je change">/)
    // Plus de ligne « qui le voit » sous la rangée : les petits titres du groupe le disent déjà (le 17 novembre 2026 :
    // « pas besoin de mettre du texte à chaque fois »). Le panneau de la pièce suit la rangée, et lui seul.
    assert.doesNotMatch(html, /loge-qui/, id)
    assert.match(html, new RegExp(`<div class="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby="loge-${id}">`), id)
    for (const [autre, contenu] of Object.entries(contenus)) assert.equal(contenu.test(html), autre === id, `${id} : ${autre}`)
    // Rien d'essayé : pas de barre, et la région qui dira l'essai, vide.
    assert.doesNotMatch(html, /loge-barre/, id)
    assert.match(html, /<p class="sr-only" role="status"><\/p>/, id)
  }
  // Six pièces : deux groupes, ceux que dit la ligne des petits titres (« La salle voit », « Toi seul »).
  assert.deepEqual(
    PIECES_DE_LA_LOGE.map(p => `${p.groupe} › ${p.nom}`),
    ['salle › Avatar', 'salle › Titre', 'salle › Vitrine', 'salle › Fond', 'moi › Thème', 'moi › Gerbe'],
  )
  // Chaque pièce garde l'icône de sa page d'avant (sa rangée vit dans la tête légère de la loge).
  assert.match(source('components/LogeTete.tsx'), /const ICONES: Record<PieceDeLaLoge, IconName> = \{ avatar: 'sparkles', titre: 'star', vitrine: 'award', fond: 'image', theme: 'palette', gerbe: 'zap' \}/)
  // La carte reste collée en haut ; la barre couvre le menu, à sa place.
  const CSS = source('styles.css')
  assert.match(CSS, /\.loge-collante \{ position: sticky; top: 0;/)
  assert.match(CSS, /\.loge-barre \{\s*position: fixed;\s*left: 0;\s*right: 0;\s*bottom: 0;\s*z-index: 41;/)
  assert.match(CSS, /\.menu-barre \{\s*position: fixed;[^}]*z-index: 40;/)
})

// « Un rectangle noir en dessous de la carte » (le propriétaire, le 14
// octobre 2026) : la bande qui la colle en haut avait son fond uni, à angles
// droits sous ses coins arrondis — plus sombre que le halo de la page, et
// coupant net le décor d'un thème (les rayons de l'Océan, les lignes du
// Cahier). La bande ne peint plus rien : la carte, opaque sur sa seule forme,
// cache ce qui défile dessous. Et sous le rideau du Grand théâtre, le
// lambrequin de la carte en grand, posé par-dessus, cachait son prénom.
test('la carte de la loge, collée en haut : rien ne se peint autour d’elle, et rien ne cache son prénom', () => {
  const css = source('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const regles = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ selecteurs: sel.split(',').map(s => s.trim()), corps }))
  const regle = (selecteur: string) => {
    const r = regles.find(r => r.selecteurs.includes(selecteur))
    assert.ok(r, `la règle ${selecteur} existe`)
    return r.corps
  }
  const collante = regle('.loge-collante')
  assert.match(collante, /position: sticky; top: 0;/)
  // Ni fond, ni marge intérieure où passerait ce qui défile : collée, la carte touche le haut de l'écran.
  assert.doesNotMatch(collante, /background|padding/, 'la bande ne peint rien autour de la carte')
  const carte = regle('.loge-carte')
  // Son sol à part de ses dégradés : sans `color-mix`, l'image tombe, la carte reste opaque.
  assert.match(carte, /background-color: var\(--bg\);/)
  assert.match(carte, /background-image: [^;]*linear-gradient\(var\(--surface\), var\(--surface\)\)/)
  assert.doesNotMatch(carte, /background:/)
  // Le lambrequin de la vignette, sous le contenu, et tenu dans la marge du haut de la carte.
  const rideau = regle('.loge-collante .loge-carte.carte-fond.fond-theatre::before')
  assert.match(rideau, /z-index: -1;/)
  const velours = Number(/var\(--lambrequin\) 0 (\d+)px/.exec(rideau)?.[1])
  const marge = Number(/padding: (\d+)px/.exec(carte)?.[1])
  assert.ok(velours > 0 && velours <= marge, `le velours (${velours} px) tient dans la marge du haut (${marge} px)`)
})

test('dans chaque pièce, un toucher essaie : rien ne s’enregistre avant « Porter »', async () => {
  const essais: object[] = []
  const enregistres: object[] = []
  const pieces = { profil: LEA, essai: {}, essayer: (p: object) => essais.push(p), busy: false, enregistrer: (p: object) => enregistres.push(p) }
  const toucher = async (composant: string, fichier: string, nom: RegExp, props = pieces) => {
    const bouton = elements(await arbre(fichier, composant, props)).find(e => e.type === 'button' && nom.test(texte(e)))
    assert.ok(bouton, `${composant} : ${nom}`)
    bouton.props.onClick()
  }
  await toucher('MonTitre', 'components/Apparence', /L’Oracle/)
  await toucher('MonTitre', 'components/Apparence', /^Aucun/)
  await toucher('MonFond', 'components/Apparence', /^Nuit étoilée/)
  await toucher('MonFond', 'components/Apparence', /^Velours/)
  await toucher('MesFinitions', 'components/Apparence', /^Argent/)
  await toucher('MesFinitions', 'components/Apparence', /^Auto$/)
  // Une médaille, pas sa place sur la carte (« ✨🔮L’Oracle, 2ᵉ place, d’office », au-dessus) : la médaille commence par son emoji.
  await toucher('MaVitrine', 'components/Trophees', /^🔮L’Oracle/)
  assert.deepEqual(essais, [{ titre: 'hf:oracle' }, { titre: null }, { fond: 'nuit' }, { fond: null }, { finition: 'argent' }, { finition: 'auto' }, { vitrine: ['hf:oracle'] }])
  assert.deepEqual(enregistres, [], 'rien n’est enregistré d’un toucher')
  // La vitrine essayée se poursuit dans l'ordre de la carte ; vidée, c'est celle d'office.
  essais.length = 0
  await toucher('MaVitrine', 'components/Trophees', /^🔥Le Phénix/, { ...pieces, essai: { vitrine: ['hf:oracle'] } })
  await toucher('MaVitrine', 'components/Trophees', /^🔮L’Oracle/, { ...pieces, essai: { vitrine: ['hf:oracle'] } })
  assert.deepEqual(essais, [{ vitrine: ['hf:oracle', 'hf:phenix'] }, { vitrine: null }])
  // La vitrine d'office est une option de la liste, en tête, dans les deux
  // états : un bouton qui ne paraissait qu'une vitrine choisie partait sous
  // le doigt qui le touchait, et le focus tombait sur la page.
  const office = (html: string) => /<ul class="loge-vignettes loge-medailles" aria-labelledby="loge-vitrine-entete"><li>(<button[^>]*>.*?<\/button>)<\/li>/.exec(html)?.[1]
  // Une médaille : l'emoji en grand dans un rond, son nom dessous — « d'office » et ce que la carte choisit se disent à
  // l'oreille. Son état suit la règle de toutes les pièces (`classesDeLaVignette`, le 17 novembre 2026) : montrée et
  // portée, le cadre d'or et la coche, « porté » à l'oreille — l'ancienne règle taisait la coche de ce qu'il portait
  // quand la carte le montrait. Ce que la carte choisit se décrit hors du bouton, une seule fois (le bloc `hidden`).
  const arrivee = await rendu('components/Trophees', 'MaVitrine', pieces)
  assert.equal(
    office(arrivee),
    '<button type="button" class="loge-vignette loge-medaille selected porte" aria-pressed="true" aria-describedby="loge-vitrine-office"><span class="loge-vignette-image" aria-hidden="true"><span class="loge-medaille-emoji">✨</span></span><span class="loge-vignette-nom">Les plus durs<span class="sr-only">, d’office</span></span><span class="sr-only">, porté</span></button>',
  )
  assert.match(arrivee, /<div hidden=""><span id="loge-vitrine-office">Ta carte choisit tes 2 plus durs\.<\/span>/)
  assert.equal(
    office(await rendu('components/Trophees', 'MaVitrine', { ...pieces, essai: { vitrine: ['hf:oracle'] } })),
    '<button type="button" class="loge-vignette loge-medaille porte" aria-pressed="false" aria-describedby="loge-vitrine-office"><span class="loge-vignette-image" aria-hidden="true"><span class="loge-medaille-emoji">✨</span></span><span class="loge-vignette-nom">Les plus durs<span class="sr-only">, d’office</span></span><span class="sr-only">, porté</span></button>',
  )
  essais.length = 0
  await toucher('MaVitrine', 'components/Trophees', /^✨Les plus durs, d’office/, { ...pieces, essai: { vitrine: ['hf:oracle'] } })
  assert.deepEqual(essais, [{ vitrine: null }])

  // L'essai se lit dans chaque grille : ce que la carte montre, ce qu'il porte encore.
  const titres = await rendu('components/Apparence', 'MonTitre', { ...pieces, essai: { titre: 'hf:oracle' } })
  // Un titre : l'emoji de ce qui l'a ouvert devant son nom, sans bulle, et son état dit par ses classes — la règle de toutes
  // les pièces — puis à l'oreille : « porté » pour ce qu'il porte, « à l'essai » pour ce que la carte montre sans qu'il le porte.
  assert.match(titres, /<button type="button" class="loge-titre porte" aria-pressed="false"><span class="loge-titre-emoji" aria-hidden="true"><\/span><span class="loge-titre-nom">Aucun<\/span><span class="sr-only">, porté<\/span><\/button>/)
  const oracle = HAUTS_FAITS_REGAGNABLES.find(h => h.key === 'hf:oracle')!
  assert.match(titres, new RegExp(`<button type="button" class="loge-titre selected essaye" aria-pressed="true"><span class="loge-titre-emoji" aria-hidden="true">${oracle.emoji}</span><span class="loge-titre-nom">L’Oracle</span><span class="sr-only">, à l’essai</span></button>`))
  const fonds = await rendu('components/Apparence', 'MonFond', { ...pieces, essai: { fond: 'nuit' } })
  // Plus de mot d'état sous chaque vignette : la coche, le cadre et le halo le disent à l'œil, `aria-label` à l'oreille.
  assert.match(fonds, /class="loge-vignette porte" aria-pressed="false" aria-label="Velours, porté"><span class="loge-vignette-image" aria-hidden="true"><span class="fond-apercu"><\/span><\/span><span class="loge-vignette-nom">Velours<\/span>/)
  assert.match(fonds, /class="loge-vignette selected essaye" aria-pressed="true" aria-label="Nuit étoilée, à l’essai"><span class="loge-vignette-image" aria-hidden="true"><span class="fond-apercu carte-fond fond-nuit"><\/span><\/span><span class="loge-vignette-nom">Nuit étoilée<\/span>/)

  // Les avatars de même : chaque case essaie le sien — ce qui reste à gagner n'a pas de case, il se compte sous la grille.
  essais.length = 0
  const { pagesDeLaLoge } = await import(url('components/Apparence.tsx'))
  const cases = async (nom: string) =>
    elements(await arbre('components/Apparence', 'PageDAvatars', { ...pieces, page: pagesDeLaLoge(LEA).find((p: { page: string }) => p.page === nom) })).filter(
      e => e.type === 'button',
    )
  ;(await cases('legendaire')).find(b => b.props['aria-label'] === 'Le Phénix, légendaire').props.onClick()
  ;(await cases('offert')).find(b => b.props['aria-label'] === 'Avatar 🦊').props.onClick()
  ;(await cases('commune')).find(b => /^L’écureuil/.test(b.props['aria-label'])).props.onClick()
  assert.deepEqual(essais, [{ legendaire: 'lg:phenix' }, { avatar: '🦊' }, { legendaire: 'br:ecureuil' }])
  assert.deepEqual(enregistres, [], 'rien n’est enregistré d’un toucher')

  // Les grilles qui gardent un état — les gerbes, les thèmes — touchent de même.
  const APPARENCE = source('components/Apparence.tsx')
  // Une gerbe, un seul geste : « Aucune » essaie le retrait, les autres éclatent puis s'essaient (elle a un état : pas d'appel direct).
  assert.match(APPARENCE, /if \(g\) setApercu\(a => \(\{ cle: g\.key, n: \(a\?\.n \?\? 0\) \+ 1 \}\)\)\s*essayer\(\{ gerbe: g \? g\.key : AUCUNE_GERBE \}\)/)
  // Un thème, une plaque : un toucher essaie, rien d'autre — plus de fiche qui s'ouvre sous la case (le 17 novembre 2026).
  assert.match(source('components/Boutique.tsx'), /const toucher = \(cle: string\) => essayer\(\{ theme: cle === 'velours' \? null : cle \}\)/)
  assert.match(source('components/MaPlaque.tsx'), /onClick=\{\(\) => essayer\(\{ plaque: c\.cle \}\)\}/)
  // Rien ne s'enregistre d'un toucher dans ces grilles — pas même la version, rare ou d'origine, d'un avatar éclaté :
  // elle s'essaie sur la carte de la loge, et « Porter » la garde avec le reste.
  assert.deepEqual([...APPARENCE.matchAll(/\benregistrer\(/g)].length, 0)
  assert.doesNotMatch(source('components/Loge.tsx'), /enregistrer\(\{ eclat/)
  assert.doesNotMatch(source('components/Trophees.tsx'), /\benregistrer\(/)
  const boutique = source('components/Boutique.tsx')
  assert.doesNotMatch(boutique.slice(boutique.indexOf('export function MesThemes'), boutique.indexOf('export function DetailTheme')), /\benregistrer\(/)
})

// Titre et Vitrine (le 17 novembre 2026 ; le propriétaire : « je trouve l'onglet titre, vitrine […] pas pratique et peu
// lisible. Soit on est obligé de scroller trop, mais aussi la présentation ne donne pas trop envie »). Puis, devant les
// pastilles du matin : « l'onglet des titres ne me convient pas. Cela prend trop de place, c'est brouillon […] ne pas mettre
// les sortes de bulles autour des titres » — du texte aligné en deux colonnes, l'emoji de ce qui l'a ouvert devant son nom ;
// et « Pour la vitrine est ce que l'on sait sur quoi on clique ? » — ses trois places sur la carte, au-dessus des médailles.
// L'état se dit par la règle de toutes les pièces (`classesDeLaVignette`) et, à l'oreille, par des mots ; plus de consigne :
// « pas besoin de mettre du texte à chaque fois ».
test('Titre : du texte aligné, sans bulle — l’emoji de ce qui l’a ouvert devant son nom, son état à l’oreille, « Aucun » d’abord', async () => {
  const { emojiDUnTitre } = await import(url('components/Apparence.tsx'))
  const oracle = HAUTS_FAITS_REGAGNABLES.find(h => h.key === 'hf:oracle')!
  const habitue = HAUTS_FAITS_DE_CARRIERE.find(h => h.key === 'hf:habitue')!
  // Chaque origine a le sien : un trophée de soirée, une piste de carrière, un maître des sentiers, un champion du mois, un défi du Cabinet.
  assert.equal(emojiDUnTitre('hf:oracle'), oracle.emoji)
  assert.equal(emojiDUnTitre('hf:habitue'), habitue.emoji)
  assert.equal(emojiDUnTitre('maitre:foret'), '🌲')
  assert.equal(emojiDUnTitre('mois:2026-10'), '👑')
  assert.equal(emojiDUnTitre('cabinet:defi:cagnotte:3'), '🃏')
  assert.equal(emojiDUnTitre('cabinet:defi:cagnotte:2'), '', 'un défi qui n’est pas à l’Or n’ouvre pas de titre : rien à dessiner')
  assert.equal(emojiDUnTitre('n-importe-quoi'), '')

  // Il porte L'Oracle — tombé depuis sa dernière visite — et essaie le maître de la forêt.
  const profil = { ...LEA, titre: 'hf:oracle', sentiers: { foret: 13 }, titresDates: ['mois:2026-10'], titresDuCabinet: ['cabinet:defi:cagnotte:3'] }
  const piece = { ...rien, essayer: () => {} }
  const html = await rendu('components/Apparence', 'MonTitre', { ...piece, profil, essai: { titre: 'maitre:foret' }, neufs: new Set(['hf:oracle']) })
  const titre = (nom: string) => new RegExp(`<button type="button" class="loge-titre[^"]*" aria-pressed="(?:true|false)"><span class="loge-titre-emoji" aria-hidden="true">([^<]*)</span><span class="loge-titre-nom">${nom}</span>`).exec(html)
  assert.equal(titre('Aucun')![1], '', '« Aucun » n’a pas d’emoji, mais sa place : les noms s’alignent')
  assert.equal(titre('Maître de la forêt')![1], '🌲')
  assert.equal(titre('Champion d’octobre 2026')![1], '👑')
  assert.equal(titre('Le Trésorier')![1], '🃏')
  assert.equal(titre('L’Oracle')![1], oracle.emoji)
  // L'ordre : « Aucun », les maîtres, les champions, le Cabinet, puis les trophées.
  const ordre = ['Aucun', 'Maître de la forêt', 'Champion d’octobre 2026', 'Le Trésorier', 'L’Oracle'].map(n => html.indexOf(`<span class="loge-titre-nom">${n}</span>`))
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre)
  assert.ok(ordre.every(i => i >= 0))
  // L'état, la règle de toutes les pièces : ce que la carte montre à l'essai (`selected essaye` — à l'or, son trait devant),
  // ce qu'il porte (`porte` — sa coche), le neuf (`neuve` — le point rouge) ; à l'oreille, « à l'essai », « porté »,
  // « nouveau » après le nom, jamais écrits à l'œil.
  assert.match(html, /class="loge-titre selected essaye" aria-pressed="true"><span class="loge-titre-emoji" aria-hidden="true">🌲<\/span><span class="loge-titre-nom">Maître de la forêt<\/span><span class="sr-only">, à l’essai<\/span><\/button>/)
  assert.match(html, /class="loge-titre porte neuve" aria-pressed="false"><span class="loge-titre-emoji" aria-hidden="true">[^<]+<\/span><span class="loge-titre-nom">L’Oracle<\/span><span class="sr-only">, porté, nouveau<\/span><\/button>/)
  assert.doesNotMatch(html, /titre-etat|>porté<|>à l’essai<|>nouveau</, 'aucun mot d’état écrit à l’œil')
  // Ni bulle ni cadre : plus de `.loge-vignette` sur un titre.
  assert.doesNotMatch(html, /loge-vignette loge-titre|loge-vignette-nom/)
  // L'en-tête dit ce qu'il range sur une ligne, et rien de plus : « pas besoin de mettre du texte à chaque fois ».
  assert.match(html, /<div class="loge-entete"><h3 class="loge-entete-titre" id="loge-titre-entete">Mes titres<span class="loge-entete-compte">[^<]+<\/span><\/h3><\/div>/)
  assert.doesNotMatch(html, /loge-entete-consigne/)
  assert.match(html, /<div class="loge-vignettes loge-titres" role="group" aria-labelledby="loge-titre-entete">/)

  // La feuille : deux colonnes de cellules de 44 px au moins, où un nom passe sur deux lignes sans que la rangée grandisse ;
  // ni bordure ni fond autour d'un titre ; montré, à l'or et un trait devant ; porté, sa coche ; neuf, le point rouge.
  const CSS = source('styles.css')
  assert.match(CSS, /\.loge-vignettes\.loge-titres \{ --loge-colonnes: 2;/)
  const regleDuTitre = /\n\.loge-titre \{([^}]*)\}/.exec(CSS)![1]
  assert.match(regleDuTitre, /min-height: 44px;/)
  assert.match(regleDuTitre, /border: 0;/)
  assert.match(regleDuTitre, /background: none;/)
  assert.match(CSS, /\.loge-titre-nom \{[^}]*-webkit-line-clamp: 2;/)
  assert.match(CSS, /\.loge-titre\.selected \.loge-titre-nom \{ color: var\(--accent-text\); \}/)
  assert.match(CSS, /\.loge-titre\.selected::before \{[^}]*width: 3px;[^}]*background: var\(--accent\);/)
  assert.match(CSS, /\.loge-titre\.porte::after \{ content: '✓';[^}]*color: var\(--accent-text\);/)
  assert.match(CSS, /\.loge-titre\.neuve \.loge-titre-emoji::before \{[^}]*background: #d93025;/)
  // Rien d'avant : ni la pastille de 34 px, ni son mot d'état, ni la pastille encadrée du matin.
  assert.doesNotMatch(CSS, /\.titre-choix|\.titre-etat|\.vitrine-option|\.vitrine-choix|\.vitrine-rang|\.loge-vignette\.loge-titre/)
})

test('Vitrine : ses trois places sur la carte, puis une médaille par trophée, son rang en pastille, ce qu’il a fallu à l’oreille — « Les plus durs » d’abord', async () => {
  const foudre = HAUTS_FAITS_REGAGNABLES.find(h => h.key === 'hf:foudre')!
  const oracle = HAUTS_FAITS_REGAGNABLES.find(h => h.key === 'hf:oracle')!
  const habitue = HAUTS_FAITS_DE_CARRIERE.find(h => h.key === 'hf:habitue')!
  const vus = hautsFaits({ 'hf:oracle': 1, 'hf:phenix': 1, 'hf:foudre': 1 }).map(h => (h.key === 'hf:habitue' ? { ...h, fois: 2 } : h))
  const profil = {
    ...LEA,
    hautsFaits: vus,
    vitrine: [badge('hf:oracle', oracle.emoji, oracle.title), badge('hf:phenix', '🔥', 'Le Phénix'), badge('hf:foudre', foudre.emoji, foudre.title), badge('hf:habitue:2', habitue.emoji, 'L’Habitué · Argent')],
  }
  const html = await rendu('components/Trophees', 'MaVitrine', { ...rien, essayer: () => {}, profil, essai: { vitrine: ['hf:phenix', 'hf:oracle', 'hf:habitue'] }, neufs: new Set(['hf:foudre']) })
  // L'en-tête, seul : plus de consigne (« Jusqu'à 3 sur ta carte, dans l'ordre. ») — les trois places la montrent.
  assert.match(html, /<div class="loge-entete"><h3 class="loge-entete-titre" id="loge-vitrine-entete">Mes trophées<span class="loge-entete-compte">[^<]+<\/span><\/h3><\/div>/)
  // « Sur ta carte », juste dessous : trois places dans l'ordre de la carte — chacune l'emoji de son trophée, son nom à
  // l'oreille, et un bouton qui la vide, ce qu'il a fallu en description.
  assert.match(html, /<\/h3><\/div><ol class="loge-emplacements" aria-label="Sur ta carte">/)
  const places = [...html.matchAll(/<li>(<button type="button" class="loge-emplacement[^"]*" aria-describedby="loge-vitrine-regle-([^"]+)">.*?<\/button>)<\/li>/g)].map(m => [m[2], m[1]])
  assert.deepEqual(places.map(([cle]) => cle), ['hf:phenix', 'hf:oracle', 'hf:habitue'])
  assert.match(places[0][1], /<span class="loge-emplacement-numero" aria-hidden="true">1<\/span><span class="loge-emplacement-emoji" aria-hidden="true">🔥<\/span><span class="sr-only">Le Phénix, 1ʳᵉ place : le retirer<\/span>/)
  // L'Habitué · Argent s'y dit sans son métal, comme sur sa médaille.
  assert.match(places[2][1], /<span class="sr-only">L’Habitué, 3ᵉ place : le retirer<\/span>/)
  // Seule la place du dernier venu de l'essai s'allume : c'est elle que le doigt vient de remplir.
  assert.deepEqual(places.map(([, b]) => /class="loge-emplacement vient"/.test(b)), [false, false, true])
  // Le rang sur la carte, sur chaque médaille aussi : 1 pour le premier montré, 2, 3 — dit à l'oreille, « montré 1ᵉʳ ».
  assert.match(html, /<span class="loge-vignette-nom">Le Phénix<\/span><span class="sr-only">, à l’essai<\/span><span class="loge-medaille-rang"><span class="sr-only">, montré <\/span>1<span class="sr-only">ᵉʳ<\/span><\/span>/)
  assert.match(html, /<span class="loge-vignette-nom">L’Oracle<\/span><span class="sr-only">, à l’essai<\/span><span class="loge-medaille-rang"><span class="sr-only">, montré <\/span>2<span class="sr-only">ᵉ<\/span><\/span>/)
  assert.match(html, /<span class="loge-medaille-rang"><span class="sr-only">, montré <\/span>3<span class="sr-only">ᵉ<\/span><\/span>/)
  // Une liste, d'où le focus ne s'envole pas : un `<ul>` et ses `<li>`, nommée par son en-tête.
  assert.match(html, /<\/ol><ul class="loge-vignettes loge-medailles" aria-labelledby="loge-vitrine-entete"><li><button[^>]*aria-describedby="loge-vitrine-office"/)
  // Trois choisis : les autres sont éteints — pour le doigt et pour l'oreille — et le neuf garde son point.
  assert.match(html, /class="loge-vignette loge-medaille neuve" aria-pressed="false" aria-disabled="true" aria-describedby="loge-vitrine-regle-hf:foudre"/)
  assert.match(html, /<span class="loge-vignette-nom">La Foudre<\/span><span class="sr-only">, nouveau<\/span>/)
  // L'état par la règle de toutes les pièces : montré sans être porté — la vitrine d'office est celle qu'il porte —, à l'essai.
  // Une piste de carrière porte son métal en liseré, et son nom le dit encore à l'oreille.
  assert.match(html, /class="loge-vignette loge-medaille loge-medaille-m2 selected essaye" aria-pressed="true"/)
  assert.match(html, /<span class="loge-vignette-nom">L’Habitué<span class="sr-only"> · Argent<\/span><\/span>/)
  // Ce qu'il a fallu n'est plus écrit sous chaque nom : il se lit à l'oreille, décrit hors du bouton — dans le bouton, il
  // entrait dans son nom puis se relisait en description. Une seule fois chacun, dans un bloc `hidden`.
  assert.match(html, new RegExp(`<div hidden=""><span id="loge-vitrine-office">[^<]+</span>.*<span id="loge-vitrine-regle-hf:oracle">${oracle.rule}</span>.*</div>`))
  for (const bouton of html.match(/<button[^>]*>.*?<\/button>/g)!) assert.doesNotMatch(bouton, /id="loge-vitrine-(regle|office)/, 'aucune description dans un bouton')
  assert.equal(html.match(/id="loge-vitrine-regle-hf:oracle"/g)!.length, 1)
  assert.doesNotMatch(html, /class="muted small">/)
  // Pas de « N trophées à gagner » sous la vitrine : compté comme l'album, il disait 277 à une habituée, à côté des
  // « 78 titres à gagner » de la pièce « Titre », qui mène au même album (le 17 novembre 2026).
  assert.doesNotMatch(html, /loge-a-gagner|trophées? à gagner/)

  // D'office : ses trois plus durs dans les places, une ✨ au lieu du numéro, et rien à y faire — trois boutons éteints, qui
  // restent : une place vidée garde le focus sous le doigt, les suivantes y remontent.
  const office = await rendu('components/Trophees', 'MaVitrine', { ...rien, essayer: () => {}, profil, essai: {} })
  const ol = /<ol class="loge-emplacements d-office" aria-label="Sur ta carte">(.*?)<\/ol>/.exec(office)![1]
  assert.equal(ol.match(/<span class="loge-emplacement-numero" aria-hidden="true">✨<\/span>/g)!.length, 3)
  assert.equal(ol.match(/<li><button type="button" class="loge-emplacement" aria-disabled="true">/g)!.length, 3)
  assert.match(ol, /<span class="sr-only">[^<]+, 1ʳᵉ place, d’office<\/span>/)
  // Une place vide : son numéro, en pointillé, « libre » à l'oreille.
  const une = await rendu('components/Trophees', 'MaVitrine', { ...rien, essayer: () => {}, profil, essai: { vitrine: ['hf:oracle'] } })
  assert.match(une, /<li><button type="button" class="loge-emplacement vide" aria-disabled="true"><span class="loge-emplacement-numero" aria-hidden="true">2<\/span><span class="sr-only">2ᵉ place, libre<\/span><\/button><\/li>/)
  // Une place prise se touche pour la vider : l'essai perd ce trophée, rien d'autre.
  const touches: object[] = []
  const vider = elements(await arbre('components/Trophees', 'MaVitrine', { ...rien, essayer: (e: object) => touches.push(e), profil, essai: { vitrine: ['hf:phenix', 'hf:oracle'] } }))
    .filter(e => e.type === 'button' && /loge-emplacement/.test(e.props.className))
  assert.equal(vider.length, 3)
  vider[0].props.onClick()
  assert.equal(vider[2].props.onClick, undefined, 'une place vide n’a rien à faire')
  assert.deepEqual(touches, [{ vitrine: ['hf:oracle'] }])

  // La feuille : quatre par rangée, une médaille ronde, son rang en pastille d'or ; trois places côte à côte, chacune une
  // cible de doigt, vides en pointillé ; et rien ne bouge pour qui demande moins de mouvement.
  const CSS = source('styles.css')
  assert.match(CSS, /\.loge-vignettes\.loge-medailles \{ --loge-colonnes: 4; \}/)
  assert.match(CSS, /\.loge-medaille \.loge-vignette-image \{[^}]*border-radius: 50%;/)
  assert.match(CSS, /\.loge-medaille-rang \{[^}]*background: var\(--accent\); color: var\(--on-accent\);/)
  assert.match(CSS, /\.loge-emplacements \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/)
  assert.match(CSS, /\.loge-emplacement \{[^}]*min-height: 44px;/)
  assert.match(CSS, /\.loge-emplacement\.vide \{[^}]*border-style: dashed;/)
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.loge-emplacement\.vient,\s*[^{]*\{ animation: none; \}/)
  // Le texte d'une médaille reste lisible : jamais sous l'étiquette.
  assert.match(CSS, /\.loge-medaille \.loge-vignette-nom \{ font-size: 0\.75rem;/)
})

test('la barre : « Annuler » rend la tenue sans rien envoyer, « Porter » envoie tout l’essai d’un coup', async () => {
  const gestes: string[] = []
  const barre = (lignes: object[], erreur?: string) =>
    arbre('components/Loge', 'BarreDEssai', { lignes, busy: false, erreur, onAnnuler: () => gestes.push('annuler'), onPorter: () => gestes.push('porter') })
  const une = await barre([{ piece: 'avatar', nom: 'La Chouette', detail: 'Légendaire' }])
  assert.equal(texte(elements(une).find(e => e.type === 'b')), 'La Chouette')
  assert.ok(texte(une).includes('Légendaire'))
  const trois = await barre([
    { piece: 'avatar', nom: '🐸', detail: 'Emoji' },
    { piece: 'titre', nom: '« L’Oracle »', detail: 'Titre' },
    { piece: 'theme', nom: 'Océan', detail: 'Thème · Peu commune' },
  ])
  assert.equal(texte(elements(trois).find(e => e.type === 'b')), '3 changements')
  assert.ok(texte(trois).includes('🐸 · « L’Oracle » · Océan'))
  const [annuler, porter] = elements(trois).filter(e => e.type === 'button')
  assert.deepEqual([texte(annuler), texte(porter)], ['Annuler', 'Porter'])
  annuler.props.onClick()
  porter.props.onClick()
  assert.deepEqual(gestes, ['annuler', 'porter'])
  // Un refus du serveur se dit là où l'on a touché « Porter », pas en bas de la page, sous la barre.
  const refus = await barre([{ piece: 'titre', nom: '« L’Oracle »', detail: 'Titre' }], 'Ce titre se gagne d’abord')
  assert.ok(elements(refus).some(e => e.props?.role === 'alert' && texte(e) === 'Ce titre se gagne d’abord'))

  // « Porter » : l'essai entier, en un enregistrement ; pris, l'essai se vide et le thème essayé devient le sien — et
  // la garde de la loge sait s'il a pris (vrai), pour partir ensuite.
  const LOGE = source('components/Loge.tsx')
  assert.match(
    LOGE,
    /const porter = async \(\): Promise<boolean> => \{\s*if \(essaiVide\(essai\)\) return true\s*if \(busy \|\| !\(await enregistrer\(essai\)\)\) return false[\s\S]*?if \(essai\.theme !== undefined\) finirLEssai\(true\)\s*setEssai\(\{\}\)\s*return true\s*\}/,
  )
  assert.match(LOGE, /onAnnuler=\{\(\) => setEssai\(\{\}\)\}/)
  // La loge quittée — « ← », le retour du téléphone — rend la page à son thème.
  assert.match(LOGE, /useEffect\(\(\) => \(\) => finirLEssai\(\), \[\]\)/)
  // La page dit si l'enregistrement a pris ; passer d'une pièce à l'autre n'empile rien dans l'historique.
  const APP = source('views/ProfilApp.tsx')
  assert.match(APP, /const enregistrer = async \(patch: ChoixDuProfil\): Promise<boolean> =>/)
  assert.match(APP, /const changerDePiece = \(piece: PieceDeLaLoge\) => \{\s*history\.replaceState\(/)
  // La loge a son écran, derrière « M'habiller » : sa pièce est celle de l'adresse (`#titre`).
  assert.match(APP, /if \(e\.groupe === 'M’habiller'\) \{/)
  assert.match(
    APP,
    /<pret\.PanneauLoge profil=\{profil\} piece=\{ecran as PieceDeLaLoge\} onPiece=\{changerDePiece\} busy=\{busy\} enregistrer=\{enregistrer\} erreur=\{erreur\} onVus=\{retenirLesVusDeLaLoge\} garde=\{gardeDeLaLoge\} \/>/,
  )
  // Et le lecteur d'écran entend chaque pièce portée d'un coup.
  const { annonceDuChoix } = await import(url('components/choix.ts'))
  assert.equal(annonceDuChoix({ titre: 'maitre:foret', theme: 'ocean', avatar: '🦊' }), 'Tu portes 🦊. Ton titre : Maître de la forêt. Ton thème : Océan.')
})

test('la loge dit la pièce qui a du nouveau, à l’œil et à l’oreille', async () => {
  // La rangée : une pastille sur chaque pièce qui a du neuf, et le lecteur d'écran l'entend.
  const avec = await rendu('components/LogeTete', 'PiecesDeLaLoge', { actif: 'titre', onChoisir: () => {}, neuves: new Set(['theme', 'avatar']) })
  assert.match(avec, /<button id="loge-avatar"[^>]*><span class="loge-rond"><svg[^>]*>.*?<\/svg><span class="loge-neuf" aria-hidden="true"><\/span><\/span>Avatar<span class="sr-only">, du nouveau<\/span><\/button>/)
  assert.match(avec, /<button id="loge-theme"[^>]*><span class="loge-rond"><svg[^>]*>.*?<\/svg><span class="loge-neuf" aria-hidden="true"><\/span><\/span>Thème<span class="sr-only">, du nouveau<\/span><\/button>/)
  assert.equal(avec.match(/<span class="loge-neuf" aria-hidden="true"><\/span>/g)?.length, 2)
  const sans = await rendu('components/LogeTete', 'PiecesDeLaLoge', { actif: 'titre', onChoisir: () => {}, neuves: new Set() })
  assert.doesNotMatch(sans, /du nouveau|loge-neuf/)

  // La loge entière, pour un profil dont le serveur retient qu'il a vu tout ce
  // qu'elle a sauf Ivoire : le thème a sa pastille ; l'avatar, la pièce ouverte,
  // n'en a pas — on la regarde.
  const vus = ceQuIlAPorter(LEA as any)
  assert.ok(vus.theme.includes('ivoire'))
  const SANS_IVOIRE = { ...LEA, vusDeLaLoge: { ...vus, theme: vus.theme.filter(k => k !== 'ivoire') } }
  const loge = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: SANS_IVOIRE, piece: 'avatar', onPiece: () => {}, busy: false, enregistrer: async () => true })
  // Les pièces qui ont leur pastille, bouton par bouton.
  const pastilles = (h: string) =>
    h
      .split('<button id="loge-')
      .slice(1)
      .filter(b => b.slice(0, b.indexOf('</button>')).includes('<span class="loge-neuf" aria-hidden="true"></span>'))
      .map(b => b.slice(0, b.indexOf('"')))
  assert.deepEqual(pastilles(loge), ['theme'])
  assert.match(loge, /Thème<span class="sr-only">, du nouveau<\/span>/)
  // Ouvert sur le thème, plus rien sur la rangée : la pastille d'une pièce s'éteint dès qu'on la regarde.
  const surLeTheme = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: SANS_IVOIRE, piece: 'theme', onPiece: () => {}, busy: false, enregistrer: async () => true })
  assert.deepEqual(pastilles(surLeTheme), [])
  assert.doesNotMatch(surLeTheme, /loge-neuf|Thème<span class="sr-only">, du nouveau/)
  // Le rouge se suit jusqu'à sa case : la vignette d'Ivoire, et l'onglet de sa plaque, venue avec lui — la plaque d'un
  // thème neuf est neuve aussi, et l'onglet le dit tant qu'on n'y est pas.
  assert.match(surLeTheme, /<button type="button" class="loge-vignette loge-theme-case neuve"[^>]*aria-label="Ivoire, offert, nouveau">/)
  assert.match(surLeTheme, /<button id="loge-theme-plaque"[^>]*>.*?<span class="loge-theme-neuf" aria-hidden="true"><\/span><span class="sr-only">, du nouveau<\/span><\/button>/)
  assert.doesNotMatch(surLeTheme, /<button id="loge-theme-themes"[^>]*>(?:(?!<\/button>).)*loge-theme-neuf/, 'pas sur l’onglet qu’on regarde')

  // « M'habiller » et « Profil » le comptent aussi, avant qu'on entre dans la loge — et la loge s'ouvre sur le thème.
  const panneaux = await import(url('components/PanneauxDuProfil.tsx'))
  const { premierePieceNeuve } = await import('../../shared/piecesDeLaLoge')
  assert.deepEqual(panneaux.apercusDesTuiles(SANS_IVOIRE).nouveautes, { nouveautes: 1, pieces: { theme: 1 } })
  assert.equal(premierePieceNeuve(panneaux.nouveautesDuProfil(SANS_IVOIRE)), 'theme')
  // Tout vu : plus rien.
  assert.deepEqual(panneaux.nouveautesDuProfil({ ...LEA, vusDeLaLoge: vus }), { nouveautes: 0, pieces: {} })
  // Jamais passé par sa loge (null), ou une base qui s'est tue (absent) : rien n'est nouveau — on ne sait pas ce qu'il a déjà vu.
  assert.deepEqual(panneaux.nouveautesDuProfil({ ...LEA, vusDeLaLoge: null }), { nouveautes: 0, pieces: {} })
  assert.deepEqual(panneaux.nouveautesDuProfil(LEA), { nouveautes: 0, pieces: {} })

  const APP = source('views/ProfilApp.tsx')
  // Ses six pièces, dites en deux temps depuis que le carrefour du profil tient en lignes (le 10 novembre 2026,
  // `profil-carrefour.test.ts`) : les trois premières, puis les autres là où la ligne a la place — et son compteur rouge.
  assert.match(
    APP,
    /titre="M’habiller"\s*detail="Avatar, titre, vitrine"\s*suite=\{\[', fond', ', thème', ', gerbe'\]\}\s*compteur=\{plus && plus\.nouveautes\.nouveautes > 0 \? \{ n: plus\.nouveautes\.nouveautes, label: nouveautesAPorter\(plus\.nouveautes\.nouveautes\) \} : undefined\}/,
  )
  // La loge retient ce qu'il a vu chez le serveur, pour tous ses appareils — et, la première fois qu'un
  // profil paraît, tout se retient (la boutique comprise) ; la page garde ce qu'elle vient de retenir.
  const LOGE = source('components/Loge.tsx')
  assert.match(LOGE, /const \[neufs\] = useState\(\(\) => nouveautes\(ceQuIlAPorter\(profil\), vusDe\(profil\)\)\)/)
  assert.match(LOGE, /retenir\(profil, retenirLesVus\(ceQuIlAPorter\(profil\), vusDe\(profil\), piece\), onVus\)/)
  assert.match(LOGE, /void api\.joueur\.retenirLesVus\(vus\)\.catch\(\(\) => \{\}\)/)
  assert.match(APP, /lesPanneaux\.retenirLesPremiersVus\(profilDetaille, retenirLesVusDeLaLoge\)/)
  assert.match(APP, /const retenirLesVusDeLaLoge = \(vus: VusDeLaLoge\) => setProfil\(p => \(p && 'hautsFaits' in p \? \{ \.\.\.p, vusDeLaLoge: vus \} : p\)\)/)
  // Plus rien dans le stockage du navigateur : regardé sur l'ordinateur, rien ne se redit nouveau sur le téléphone.
  assert.doesNotMatch(LOGE, /localStorage|quizz\.loge\.vus/)
})

test('ce qu’il a vu, retenu par le serveur : rien ne repart quand rien n’a changé, un envoi raté se tait', async () => {
  // La page rend le profil à jour après chaque retenue (`onVus`) : relue, la pièce n'a plus rien de neuf —
  // sans cette garde, chaque profil rendu renverrait la même retenue, sans fin.
  const vus = ceQuIlAPorter(LEA as any)
  const envois: unknown[] = []
  // Le `fetch` de Node, rendu ensuite : les épreuves suivantes parlent à un vrai serveur.
  const leVrai = globalThis.fetch
  Object.assign(globalThis, {
    fetch: async (_adresse: string, init?: { body?: string }) => {
      envois.push(JSON.parse(init?.body ?? 'null'))
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    },
  })
  try {
    const { retenirLesPremiersVus } = await import(url('components/Loge.tsx'))
    const recus: VusDeLaLoge[] = []
    const retenue = (v: VusDeLaLoge) => void recus.push(v)
    // Jamais passé par sa loge : tout ce qu'il a se retient vu, une fois.
    retenirLesPremiersVus({ ...LEA, vusDeLaLoge: null }, retenue)
    assert.equal(recus.length, 1)
    // Déjà retenu : rien ne repart.
    retenirLesPremiersVus({ ...LEA, vusDeLaLoge: vus }, retenue)
    // Une base qui s'est tue (absent) : rien ne s'écrit par-dessus ce qu'elle n'a pas su lire.
    retenirLesPremiersVus(LEA, retenue)
    assert.deepEqual(recus, [retenirLesVus(vus, {}, null)])
    await new Promise(r => setTimeout(r, 0))
    assert.deepEqual(envois, [{ vus: retenirLesVus(vus, {}, null) }])
  } finally {
    globalThis.fetch = leVrai
  }
})

test('« Porter » : un seul enregistrement, tout ou rien', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'loge', 'Léa')
    // Une tenue entière, en un enregistrement.
    const pris = await ecrire(banc.url, '/api/joueur/moi', { avatar: '🐼', finition: 'auto', titre: null, fond: null, theme: 'ivoire', gerbe: AUCUNE_GERBE }, cookie, 'PUT')
    assert.equal(pris.status, 200)
    const { profile } = (await pris.json()) as any
    assert.deepEqual([profile.avatar, profile.finitionChoisie, profile.theme, profile.gerbe], ['🐼', 'auto', 'ivoire', null])
    // Une pièce refusée — un titre qu'elle n'a pas gagné — refuse tout l'essai : rien ne s'écrit à moitié.
    const refus = await ecrire(banc.url, '/api/joueur/moi', { theme: null, avatar: '🦊', titre: 'hf:oracle' }, cookie, 'PUT')
    assert.equal(refus.status, 400)
    assert.match(((await refus.json()) as any).error, /Ce titre se gagne d’abord/)
    const relu = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any
    assert.deepEqual([relu.profile.avatar, relu.profile.theme], ['🐼', 'ivoire'])
    // La version d'un avatar qui n'a pas éclaté pour elle aussi : l'avatar essayé avec reste à quai.
    const version = await ecrire(banc.url, '/api/joueur/moi', { avatar: '🦊', eclat: { cle: '🦊', brille: false } }, cookie, 'PUT')
    assert.equal(version.status, 400)
    assert.match(((await version.json()) as any).error, /Cet avatar n’a pas éclaté pour toi/)
    const encore = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any
    assert.equal(encore.profile.avatar, '🐼')
  } finally {
    await banc.close()
  }
})

test('le thème essayé habille la page ; fini, elle reprend le sien — porté, il reste et se retient', async () => {
  // Une page minimale : la racine qui porte `data-theme`, et le stockage du téléphone.
  const racine = { dataset: {} as Record<string, string>, style: { setProperty() {}, removeProperty() {} } }
  const stockage = new Map<string, string>()
  Object.assign(globalThis, {
    document: { documentElement: racine, querySelector: () => null, addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: (k: string) => stockage.get(k) ?? null, setItem: (k: string, v: string) => void stockage.set(k, v), removeItem: (k: string) => void stockage.delete(k) },
  })
  try {
    // Hors de Vite, seul Ivoire a sa feuille (`styles.css`) : c'est lui qu'on essaie.
    const theme = await import(url('themeJoueur.ts'))
    await theme.porterTheme(null)
    assert.equal(racine.dataset.theme, undefined)
    await theme.essayerTheme('ivoire')
    assert.equal(racine.dataset.theme, 'ivoire', 'la page entière l’essaie')
    assert.equal(stockage.get('quizz.theme-joueur'), undefined, 'rien n’est retenu pour le prochain démarrage')
    // Le profil relu pendant l'essai ne le lui retire pas.
    await theme.porterTheme(null)
    assert.equal(racine.dataset.theme, 'ivoire')
    theme.finirLEssai()
    assert.equal(racine.dataset.theme, undefined, 'annulé, la page reprend son thème')
    // Porté : l'essai devient son thème, retenu — sans repasser par l'ancien.
    await theme.essayerTheme('ivoire')
    theme.finirLEssai(true)
    assert.equal(racine.dataset.theme, 'ivoire')
    assert.equal(stockage.get('quizz.theme-joueur'), 'ivoire')
    // Quitter la loge sans essai ne change rien.
    theme.finirLEssai()
    assert.equal(racine.dataset.theme, 'ivoire')
    // L'aperçu de l'écran commun passe devant l'essai, et le lui rend.
    await theme.porterTheme(null)
    await theme.essayerTheme('ivoire')
    const rendre = theme.commeLEcranCommun('velours')
    assert.equal(racine.dataset.theme, undefined)
    rendre()
    assert.equal(racine.dataset.theme, 'ivoire')
    theme.finirLEssai()
    assert.equal(racine.dataset.theme, undefined)
  } finally {
    for (const k of ['document', 'localStorage']) delete (globalThis as Record<string, unknown>)[k]
  }
})

// Le retour d'un joueur du 14 octobre 2026 : « pouvoir cliquer sur la carte
// pour l'afficher en grand ». La carte de la loge, touchée, ouvre sa carte
// entière — celle que la salle ouvre en touchant son nom —, sur l'essai.
test('la carte de la loge s’ouvre en grand sur l’essai : la carte du serveur, retouchée de ce qu’il essaie et de rien d’autre', async () => {
  const carte: CarteDeJoueur = {
    nom: 'Léa',
    avatar: '🐸',
    niveau: 8,
    finition: 'or',
    legendaire: 'lg:phenix',
    bordure: { ligue: 'or', crans: 3 },
    profil: {
      prenom: 'Léa',
      niveau: 8,
      legendaires: ['lg:phenix'],
      divins: [],
      vitrine: LEA.vitrine,
      hautsFaits: 2,
      ecussons: [{ categorie: 'Histoire', palier: 1 }],
      fiche: { soirees: 3, precision: 0.5, qcm: 10, justes: 5, coupDOeil: null, estimationsComparees: 0, reflexeMoyenMs: null, quizGagnes: 1, meilleureSerie: 2 },
    },
  }
  const lea = { ...LEA, bordures: [{ ligue: 'or' as const, crans: 3 }], bordureChoisie: 'auto' as const }
  const telle = structuredClone(carte)
  // Rien d'essayé : la carte du serveur, telle quelle.
  assert.deepEqual(carteAvecLEssai(carte, lea, {}), carte)
  assert.deepEqual(carteAvecLEssai(carte, lea, { theme: 'ocean', gerbe: AUCUNE_GERBE }), carte, 'le thème et la gerbe ne se voient pas sur la carte')
  // Un emoji ôte le légendaire ; la finition se lit comme le serveur la lit ; ni ses chiffres ni ses écussons ne s'essaient.
  const renard = carteAvecLEssai(carte, lea, { avatar: '🦊', finition: 'argent' })
  assert.deepEqual([renard.avatar, renard.legendaire, renard.finition, renard.eclat, renard.bordure], ['🦊', undefined, 'argent', undefined, { ligue: 'or', crans: 3 }])
  assert.equal(renard.profil, carte.profil, 'son profil n’est pas touché')
  assert.equal(carteAvecLEssai(carte, lea, { finition: 'auto' }).finition, meilleureFinition(8))
  // Sous un Divin, ni bordure — il a sa propre lumière ; « Sans bordure », aucune.
  const divin = carteAvecLEssai(carte, lea, { legendaire: 'dv:helios' })
  assert.deepEqual([divin.legendaire, divin.bordure], ['dv:helios', undefined])
  assert.equal(carteAvecLEssai(carte, lea, { bordure: 'aucune' }).bordure, undefined)
  // Éclaté pour lui, son Phénix brille sur la carte en grand comme sur celle de la loge ; sa version d'origine, non.
  const eclate = { ...lea, eclats: ['lg:phenix'] }
  assert.equal(carteAvecLEssai(carte, eclate, { finition: 'argent' }).eclat, true)
  assert.equal(carteAvecLEssai(carte, eclate, { eclat: { cle: 'lg:phenix', brille: false } }).eclat, undefined)
  // Son titre, sa vitrine, son fond : ce qu'il essaie ; son avatar, ses écussons, tels quels.
  const habillee = carteAvecLEssai(carte, lea, { titre: 'hf:oracle', fond: 'nuit', vitrine: ['hf:oracle'] })
  assert.deepEqual([habillee.profil!.titre, habillee.profil!.fond, habillee.profil!.vitrine.map(b => b.key)], ['hf:oracle', 'nuit', ['hf:oracle']])
  assert.deepEqual([habillee.avatar, habillee.legendaire, habillee.profil!.ecussons], ['🐸', 'lg:phenix', carte.profil!.ecussons])
  // Ôtés à l'essai, son titre et son fond quittent la carte.
  const portes = { ...carte, profil: { ...carte.profil!, titre: 'hf:phenix', fond: 'nuit' } }
  const nue = carteAvecLEssai(portes, { ...lea, titre: 'hf:phenix', fond: 'nuit' }, { titre: null, fond: null })
  assert.deepEqual(['titre' in nue.profil!, 'fond' in nue.profil!], [false, false])
  assert.deepEqual(carte, telle, 'la carte lue n’est jamais touchée')

  // Touchée, la carte de la loge s'ouvre : un bouton tendu sur elle, qui dit l'aperçu quand quelque chose est à l'essai.
  const loge = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: LEA, piece: 'avatar', onPiece: () => {}, ...rien })
  assert.match(loge, /<button type="button" class="loge-carte-ouvrir" title="Voir en grand"><span class="sr-only">Voir ma carte en grand<\/span><\/button><\/div><\/div>/)
  const apercu = await arbre('components/LogeTete', 'CarteDeLaLoge', { vu: LEA, vitrine: [], apercu: true, onOuvrir: () => {} })
  assert.match(texte(apercu), /Voir l’aperçu de ma carte en grand/)
  // La loge l'ouvre sur l'essai — « Aperçu de ta carte », « Porter » au pied ; la carte en grand, sur ce qu'il porte, sans retouche.
  const LOGE = source('components/Loge.tsx')
  assert.match(LOGE, /<laCarte\.CarteJoueur\s+adresse="\/api\/joueur\/carte"\s+retouche=\{apercu \? c => carteAvecLEssai\(c, profil, essai\) : undefined\}/)
  // « Aperçu de ta carte » au-dessus d'elle, son pied dessous ; sans essai, ni l'un ni l'autre.
  const enGrand = await rendu('components/CarteJoueur', 'CarteJoueur', { adresse: '/api/joueur/carte', retouche: (c: unknown) => c, pied: 'Porter', onFermer: () => {} })
  assert.match(enGrand, /<div class="carte-joueur"[^>]*><p class="carte-apercu[^"]*">.*?Aperçu de ta carte<\/p><div class="carte-pivot">/)
  assert.match(enGrand, /<footer class="carte-gestes">Porter<\/footer><\/div><\/div>$/)
  assert.doesNotMatch(await rendu('components/CarteJoueur', 'CarteJoueur', { adresse: '/api/joueur/carte', onFermer: () => {} }), /Aperçu de ta carte|carte-gestes/)
  // Elle vient à la demande, comme au profil : la loge ne la télécharge qu'au toucher.
  assert.match(LOGE, /const carteJoueur = aLaDemande\(\(\) => import\('\.\/CarteJoueur'\)\)/)
  assert.doesNotMatch(LOGE, /^import [^;]* from '\.\/CarteJoueur'/m)
})

// Le même retour : « un avertissement si on clique sur quelque chose et que
// l'on n'a pas cliqué sur Porter ». Un essai qu'on quittait se perdait en
// silence : la loge demande d'abord.
test('quitter la loge sur un essai pas porté demande d’abord : « Porter », « Partir sans » ou « Rester »', async () => {
  const { gardeDeLEssai } = await import(url('components/Loge.tsx'))
  const lea = { ...LEA }
  let essai: object = {}
  const portes: object[] = []
  let porteOk = true
  const porter = async () => {
    portes.push(essai)
    return porteOk
  }
  let reponse: { geste: 'confirmer' | 'alternative'; valeur: string } | null = null
  const demandes: any[] = []
  const dialogue = async (o: unknown) => {
    demandes.push(o)
    return reponse
  }
  const laisserPartir = { current: false }
  const garde = gardeDeLEssai(() => ({ essai, profil: lea, porter }), laisserPartir, dialogue)
  // Rien à l'essai : on part, sans un mot.
  assert.equal(garde.enCours(), false)
  assert.equal(await garde.demander(), true)
  assert.equal(demandes.length, 0)
  // Un essai : la loge demande, et dit ce qu'on essaie.
  essai = { legendaire: 'lg:dragon', titre: 'hf:oracle' }
  assert.equal(garde.enCours(), true)
  // « Rester » — Échap, le voile : la loge reste, l'essai avec, rien ne s'enregistre.
  assert.equal(await garde.demander(), false)
  assert.deepEqual(demandes[0], {
    title: 'Porter avant de partir ?',
    message: `À l’essai : ${lignesDeLEssai(essai, lea)
      .map(l => l.nom)
      .join(' · ')}.\nSans « Porter », tu gardes ta tenue d’avant.`,
    confirmLabel: 'Porter',
    cancelLabel: 'Rester',
    alternative: { label: 'Partir sans', danger: true },
  })
  assert.deepEqual([portes.length, garde.enCours()], [0, true])
  // « Porter » refusé par le serveur : on reste — la barre dit pourquoi.
  reponse = { geste: 'confirmer', valeur: '' }
  porteOk = false
  assert.equal(await garde.demander(), false)
  assert.deepEqual(portes, [essai])
  // Porté : on part.
  porteOk = true
  assert.equal(await garde.demander(), true)
  assert.equal(portes.length, 2)
  // Parti, plus rien ne le retient — ni la garde, ni le navigateur — jusqu'au prochain essai.
  assert.equal(garde.enCours(), false)
  assert.equal(await garde.demander(), true)
  assert.equal(demandes.length, 3)
  // « Partir sans » : on part, l'essai laissé, rien d'enregistré.
  laisserPartir.current = false
  reponse = { geste: 'alternative', valeur: '' }
  assert.equal(await garde.demander(), true)
  assert.equal(portes.length, 2)

  // La loge pose sa garde sur la page, et le navigateur aussi demande — recharger, fermer l'onglet.
  const LOGE = source('components/Loge.tsx')
  assert.match(LOGE, /garde\.current = gardeDeLEssai\(\(\) => dernier\.current, laisserPartir\)/)
  assert.match(LOGE, /window\.addEventListener\('beforeunload', retenir\)/)
  // La page lui demande avant chaque sortie : « ← Mon profil », un lien vers ailleurs, le retour du navigateur.
  const app = source('views/ProfilApp.tsx')
  assert.match(app, /ev\.preventDefault\(\)\s*quitter\(revenir\)/)
  assert.match(app, /<div className="player-shell loge-page" onClick=\{surLaLoge\}>/)
  assert.match(app, /<pret\.PanneauLoge [^>]*garde=\{gardeDeLaLoge\} \/>/)
  assert.match(app, /if \(dansLaLoge\(cible\)\) aller\(\)\s*else quitter\(aller\)/)
  assert.match(app, /if \(dansLaLoge\(ecranMontre\.current\) && !dansLaLoge\(suivant\) && garde\?\.enCours\(\)\) \{/)
  assert.match(app, /quitter\(\(\) => window\.location\.assign\(lien\.href\)\)/)
})

test('la loge vient avec les panneaux, à la demande : l’accueil anonyme ne la télécharge pas', () => {
  const app = source('views/ProfilApp.tsx')
  // Le type seul, côté page : les règles de la loge partent avec ses panneaux.
  assert.match(app, /^import type \{ PieceDeLaLoge \} from '\.\.\/\.\.\/\.\.\/shared\/loge'$/m)
  assert.doesNotMatch(app, /^import \{[^}]*\} from '\.\.\/\.\.\/\.\.\/shared\/loge'/m)
  assert.doesNotMatch(app, /from '\.\.\/components\/Loge'/)
  assert.match(source('components/PanneauxDuProfil.tsx'), /export \{ Loge as PanneauLoge, nouveautesDuProfil, retenirLesPremiersVus \} from '\.\/Loge'/)
  // Sa tête — la carte, la rangée — vient avec la page, sans les règles de
  // l'essai, qui tirent tous les catalogues : seulement les six pièces.
  assert.match(app, /^import \{ LogeEnChemin \} from '\.\.\/components\/LogeTete'$/m)
  const tete = source('components/LogeTete.tsx')
  assert.doesNotMatch(tete, /shared\/loge'|from '\.\/(Loge|Apparence|Trophees|Boutique|PanneauxDuProfil)'/)
  assert.match(tete, /^import \{ PIECES_DE_LA_LOGE, type PieceDeLaLoge \} from '\.\.\/\.\.\/\.\.\/shared\/piecesDeLaLoge'$/m)
  assert.doesNotMatch(readFileSync(new URL('../../shared/piecesDeLaLoge.ts', import.meta.url), 'utf8'), /^import /m)
})

// « J'aimerais que l'on puisse avoir tout sur le même écran ou presque » (le
// propriétaire, le 10 novembre 2026, pour « M'habiller »). La pièce
// « Avatar » d'une habituée — sa finition, sa bordure, son sceau — ne
// montrait pas un seul de ses avatars sans défiler, sur aucun téléphone : la
// première rangée de sa grille finissait à 886 px, pour 850 visibles
// au-dessus du menu en 412 × 915. Rien n'a changé de place, ni un nom, ni un
// geste : la loge se resserre par ses mesures, et ce que la bordure et le
// sceau disent sous leur rangée tient sur une ligne. Ce qui tient se mesure
// au navigateur (`server/scripts/rendu-loge.ts`) ; ici, la structure et la
// feuille.

/** Les règles d'un morceau de feuille, commentaires ôtés : leurs sélecteurs, leur corps. */
const reglesDe = (morceau: string) => [...morceau.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ selecteurs: sel.split(',').map(s => s.trim()), corps }))
type Regles = ReturnType<typeof reglesDe>
/** Le corps de la règle qui porte ce sélecteur, la première. */
function corpsDe(regles: Regles, selecteur: string): string {
  const r = regles.find(r => r.selecteurs.includes(selecteur))
  assert.ok(r, `la règle ${selecteur} existe`)
  return r.corps
}

test('la loge tient sur un écran, ou presque : rien n’y change de place, et ce qu’un réglage dit sous sa rangée se dit en deux temps', async () => {
  const piece = { essai: {}, essayer: () => {}, busy: false }
  // Rien n'a changé de place, rien ne s'est ajouté : sa carte, la rangée des pièces, puis — pour
  // « Avatar » — la finition, la bordure, le sceau, l'Éclat en réserve, les gemmes, leur grille et ce qui reste à gagner.
  const habituee = { ...LEA, bordures: [{ ligue: 'or' as const, crans: 7 }], bordureChoisie: 'auto' as const, scelles: ['lg:phenix'], eclatsEnReserve: 1 }
  const loge = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: habituee, piece: 'avatar', onPiece: () => {}, busy: false, enregistrer: async () => true })
  const ordre = [
    '<div class="loge-collante">',
    '<div class="loge-pieces">',
    '<div class="loge-panneau"',
    '<span class="loge-sous-titre" id="loge-finitions-titre">Finition</span>',
    '<span class="loge-sous-titre" id="loge-bordures-titre">Bordure</span>',
    '<span class="loge-sous-titre" id="loge-sceau-titre">Sceau</span>',
    '<div class="loge-reserve"',
    '<div class="gemmes gemmes-loge"',
    '<div class="loge-grille',
    '<a class="loge-a-gagner"',
  ]
  const places = ordre.map(bloc => loge.indexOf(bloc))
  assert.ok(places.every(p => p >= 0), `chaque bloc d’avant est là : ${ordre.filter((_, i) => places[i] < 0).join(', ')}`)
  assert.deepEqual(places, [...places].sort((a, b) => a - b), 'dans l’ordre d’avant')
  // La loge n'a que ses blocs d'avant, l'un derrière l'autre : la carte, la rangée, le panneau — rien entre la rangée et lui.
  assert.match(loge, /<\/button><\/div><\/div><div class="loge-pieces"><div class="loge-groupes" aria-hidden="true">/)
  assert.match(loge, /<\/button><\/div><\/div><div class="loge-panneau" role="tabpanel"/)

  // Ni la bordure ni le sceau ne disent de phrase sous leur rangée (le 17 novembre 2026 : « pas besoin de mettre du texte à
  // chaque fois […] ça fait perdre de la place pour rien ») : leurs crans et leur sceau se lisent dans « Ma collection ».
  const bordure = (bordures: { ligue: string; crans: number }[], essai: object = {}) =>
    rendu('components/Apparence', 'MesBordures', { ...piece, essai, profil: { ...LEA, bordures, bordureChoisie: 'auto' } })
  const sceau = (profil: object, essai: object = {}) => rendu('components/Apparence', 'MonSceau', { ...piece, essai, profil: { ...LEA, scelles: ['lg:phenix'], ...profil } })
  const sansPhrase = (html: string) => {
    assert.doesNotMatch(html, /<p[ >]/, 'aucune phrase sous la rangée')
    assert.doesNotMatch(html, /loge-bordure-phrase|loge-a-suite|loge-essentiel|loge-suite/)
    assert.doesNotMatch(html, /crans? sur 12|est scellé|n’a pas (encore )?(de|son) sceau|ton sceau reste à toi|Sans bordure : /)
  }
  for (const [bordures, essai] of [
    [[{ ligue: 'or', crans: 7 }], {}],
    [[{ ligue: 'or', crans: 12 }], {}],
    [[{ ligue: 'maitre', crans: 1 }], { bordure: 'maitre' }],
    [[{ ligue: 'bronze', crans: 0 }], { bordure: 'bronze' }],
    [[{ ligue: 'bronze', crans: 0 }], {}],
    [[{ ligue: 'or', crans: 7 }], { bordure: 'aucune' }],
  ] as const) {
    const html = await bordure([...bordures], essai)
    sansPhrase(html)
    // La rangée, elle, reste : son petit titre et ses pastilles.
    assert.match(html, /<span class="loge-sous-titre" id="loge-bordures-titre">Bordure<\/span>/)
    assert.match(html, /<div class="[^"]*loge-bordures-rangee" role="group" aria-labelledby="loge-bordures-titre">/)
  }
  // Sans duel classé, rien à régler : l'explication reste entière, son lien au bout — sans elle, la rangée serait vide.
  const sansDuel = await rendu('components/Apparence', 'MesBordures', { ...piece, profil: { ...LEA, bordures: undefined } })
  assert.match(sansDuel, /<p class="muted small">Ton premier duel classé ouvre la bordure de ta ligue ; chaque duel gagné dans la ligue, ou plus haut, y sertit un cran\. <a href="\/duels">Jouer un duel<\/a><\/p>/)
  assert.doesNotMatch(sansDuel, /loge-a-suite/)

  // Le sceau : la rangée « Montré » / « Masqué » seule, quel que soit le légendaire montré ou le choix.
  const scellable = LEGENDAIRES.find(l => estScellable(l) && l.key !== 'lg:phenix')!
  const sansSceau = LEGENDAIRES.find(l => !estScellable(l))!
  for (const [profil, essai] of [
    [{}, {}],
    [{ legendaire: scellable.key }, {}],
    [{ legendaire: sansSceau.key }, {}],
    [{}, { sceau: false }],
    [{ legendaire: null }, {}],
    [{ legendaire: null, scelles: ['lg:phenix', 'lg:chouette'] }, {}],
  ] as const) {
    const html = await sceau(profil, essai)
    sansPhrase(html)
    assert.match(html, /<span class="loge-sous-titre" id="loge-sceau-titre">Sceau<\/span>/)
    assert.match(html, /Montré/)
    assert.match(html, /Masqué/)
  }
  // Sans légendaire scellé, pas de sceau à régler : rien ne s'ajoute à qui débute.
  assert.equal(await rendu('components/Apparence', 'MonSceau', { ...piece, profil: LEA }), '')
})

test('la loge se resserre par ses mesures : des variables posées sur sa page, à deux pas de hauteur — un grand écran garde celles d’avant, et ce qu’un écran court tait reste lu', () => {
  const brut = source('styles.css')
  const sansCommentaires = (morceau: string) => morceau.replace(/\/\*[\s\S]*?\*\//g, '')
  // Ses pas vivent dans sa section, avant la campagne — pas en fin de feuille, où d'autres écrans écrivent les leurs.
  const debut = brut.indexOf('/* ── La loge : « M\'habiller »')
  const lesPas = brut.indexOf('/* ── La loge, à la hauteur d\'un téléphone')
  const fin = brut.indexOf('/* ── La campagne solo')
  assert.ok(debut > 0 && debut < lesPas && lesPas < fin, 'les pas de la loge vivent dans sa section')
  const avant = reglesDe(sansCommentaires(brut.slice(debut, lesPas)))

  // Ses mesures, des variables posées sur sa page — à leur valeur d'avant : un grand écran garde l'allure d'avant.
  const variables = (corps: string): Record<string, string> => Object.fromEntries([...corps.matchAll(/(--loge-[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
  const grand = variables(corpsDe(avant, '.loge-page'))
  // Typées en dictionnaire : `assert.deepEqual` donnerait sinon à `grand` le type de ce littéral, que plus rien ne lirait par une clé.
  const D_AVANT: Record<string, string> = {
    '--loge-ecart': '12px',
    '--loge-bloc': '14px',
    '--loge-serre': '6px',
    '--loge-fin': '4px',
    '--loge-avatar': '2.7rem',
    '--loge-carte-rang': '76px',
    '--loge-carte-ecart': '8px',
    '--loge-carte-pied': '12px',
    '--loge-rond': '44px',
    '--loge-pastille': '30px',
    '--loge-case': '72px',
    '--loge-gemme': '8px',
    // Les vignettes de Titre, Vitrine, Fond, Thème et Gerbe (le 17 novembre 2026) : la hauteur de leur aperçu, leur écart.
    '--loge-vignette': '64px',
    '--loge-entre-vignettes': '8px',
  }
  assert.deepEqual(grand, D_AVANT)
  assert.match(corpsDe(avant, '.loge-page'), /gap: 14px;/, 'la tête de la page garde son écart : avec un compagnon, la carte commence sous sa niche')
  // Chaque mesure est lue par sa règle : la retoucher d'un pas la change partout.
  for (const [selecteur, lu] of [
    ['.loge', 'gap: var(--loge-ecart);'],
    ['.loge-avatars', 'gap: var(--loge-ecart);'],
    ['.loge-panneau', 'gap: var(--loge-bloc);'],
    ['.loge-pieces', 'gap: var(--loge-serre);'],
    ['.loge-finitions', 'gap: var(--loge-serre);'],
    ['.loge-bordures', 'gap: var(--loge-serre);'],
    ['.loge-piece', 'gap: var(--loge-fin);'],
    ['.finition-choix', 'gap: var(--loge-fin);'],
    ['.loge-carte', 'gap: var(--loge-carte-ecart);'],
    ['.loge-carte', 'padding: 10px 14px var(--loge-carte-pied);'],
    ['.loge-carte-haut', 'min-height: var(--loge-carte-rang);'],
    ['.loge-carte .player-avatar.big', 'font-size: var(--loge-avatar);'],
    ['.loge-rond', 'width: var(--loge-rond); height: var(--loge-rond);'],
    ['.finition-teinte', 'width: var(--loge-pastille); height: var(--loge-pastille);'],
    ['.bordure-apercu', 'width: var(--loge-pastille); height: var(--loge-pastille);'],
    ['.loge-case', 'height: var(--loge-case);'],
    ['.loge-grille-emojis .loge-case', 'height: calc(var(--loge-case) - 14px);'],
    ['.gemmes-loge .gemme', 'padding: var(--loge-gemme) 4px calc(var(--loge-gemme) - 2px);'],
  ]) {
    assert.ok(corpsDe(avant, selecteur).includes(lu), `${selecteur} lit sa mesure (${lu})`)
  }

  // Deux pas de hauteur d'écran, et rien qu'eux : tous les téléphones, puis le petit téléphone et un iPhone dans son navigateur.
  const blocs: { condition: string; regles: Regles }[] = []
  const morceau = sansCommentaires(brut.slice(lesPas, fin))
  for (let i = morceau.indexOf('@media'); i >= 0; i = morceau.indexOf('@media', i)) {
    const ouvre = morceau.indexOf('{', i)
    let j = ouvre + 1
    for (let niveau = 1; niveau > 0; j++) niveau += morceau[j] === '{' ? 1 : morceau[j] === '}' ? -1 : 0
    blocs.push({ condition: morceau.slice(i + '@media'.length, ouvre).trim(), regles: reglesDe(morceau.slice(ouvre + 1, j - 1)) })
    i = j
  }
  assert.deepEqual(blocs.map(b => b.condition), ['(max-height: 939px)', '(max-height: 759px)'])
  assert.equal(reglesDe(morceau.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')).length, 0, 'hors de ses deux pas, cette partie de la feuille ne règle rien')
  const [telephone, petit] = blocs
  const toutes = blocs.flatMap(b => b.regles)

  // Chaque pas ne fait que resserrer des mesures connues — et sur la page, il ne pose qu'elles.
  const px = (valeur: string) => parseFloat(valeur) * (valeur.endsWith('rem') ? 16 : 1)
  const auTelephone = { ...grand, ...variables(corpsDe(telephone.regles, '.loge-page')) }
  const auPetit = { ...auTelephone, ...variables(corpsDe(petit.regles, '.loge-page')) }
  assert.deepEqual(Object.keys(auPetit).sort(), Object.keys(grand).sort(), 'un pas ne pose aucune mesure de plus')
  for (const cle of Object.keys(grand)) {
    assert.ok(px(auTelephone[cle]) <= px(grand[cle]) && px(auPetit[cle]) <= px(auTelephone[cle]), `${cle} ne fait que se resserrer : ${grand[cle]}, ${auTelephone[cle]}, ${auPetit[cle]}`)
  }
  for (const b of blocs) assert.equal(corpsDe(b.regles, '.loge-page').replace(/--loge-[\w-]+:[^;]+;/g, '').trim(), '', 'sur sa page, un pas ne pose que des mesures')
  assert.ok(Object.keys(grand).some(cle => auTelephone[cle] !== grand[cle]) && Object.keys(grand).some(cle => auPetit[cle] !== auTelephone[cle]), 'chaque pas resserre quelque chose')
  // Les mesures de chaque pas, telles que le navigateur les a mesurées (`rendu-loge.ts`, que la CI ne lance pas) : sur le
  // petit téléphone, tout ce qui précède la grille d'une habituée tient à deux pixels du menu. Une mesure retouchée se
  // remesure là-bas, aux six tailles, avant de changer ici.
  assert.deepEqual(variables(corpsDe(telephone.regles, '.loge-page')), {
    '--loge-ecart': '6px',
    '--loge-bloc': '8px',
    '--loge-serre': '2px',
    '--loge-fin': '2px',
    '--loge-avatar': '2.4rem',
    '--loge-carte-rang': '72px',
    '--loge-carte-ecart': '6px',
    '--loge-carte-pied': '8px',
    '--loge-rond': '38px',
    '--loge-case': '64px',
    '--loge-gemme': '3px',
  })
  assert.deepEqual(variables(corpsDe(petit.regles, '.loge-page')), {
    '--loge-ecart': '4px',
    '--loge-bloc': '6px',
    '--loge-avatar': '2.15rem',
    '--loge-carte-rang': '64px',
    '--loge-rond': '36px',
    '--loge-pastille': '28px',
  })

  // Une cible de doigt ne descend pas sous 44 px, à aucun pas.
  for (const mesures of [auTelephone, auPetit]) {
    // Le bouton d'une pièce : deux pixels, son rond, son nom dessous — 0,78 rem, à 1,2 de hauteur de ligne.
    assert.ok(2 + px(mesures['--loge-rond']) + px(mesures['--loge-fin']) + 0.78 * 16 * 1.2 >= 44, 'une pièce')
    // Une pastille : ses quatre pixels du haut, son disque, son nom — une étiquette de 11 px, à 1,2.
    assert.ok(4 + px(mesures['--loge-pastille']) + px(mesures['--loge-fin']) + 11 * 1.2 >= 44, 'une pastille')
    // Une gemme : sa marge, sa pierre de 18 px, son nom et son compte.
    assert.ok(px(mesures['--loge-gemme']) + 18 + 2 * (px(mesures['--loge-fin']) + 1 + 11 * 1.2) >= 44, 'une gemme')
    // La case d'un emoji, la plus basse : quatorze pixels de moins que celle d'un médaillon.
    assert.ok(px(mesures['--loge-case']) - 14 >= 44, 'la case d’un emoji')
  }
  // Aucun texte ne descend sous l'étiquette.
  for (const r of toutes) {
    for (const [, taille] of r.corps.matchAll(/font-size:\s*([^;]+);/g)) {
      assert.ok(taille.includes('--t-label') || (taille.endsWith('rem') && parseFloat(taille) >= 0.6875), `${r.selecteurs.join(', ')} : ${taille}`)
    }
  }

  // Ce qu'un écran court tait se cache à l'œil seulement — jamais par `display: none` : le lecteur d'écran le lit encore.
  for (const r of toutes) assert.doesNotMatch(r.corps, /display:\s*none|visibility:\s*hidden/, r.selecteurs.join(', '))
  // Le petit téléphone tait le niveau suivant et les confettis de la carte, que l'accueil et « Mon profil » disent en
  // tête : les déclarations de `.sr-only`, mot pour mot — et rien d'autre ne se cache ainsi.
  const declarations = (corps: string) => corps.split(';').map(d => d.trim()).filter(Boolean).sort()
  assert.deepEqual(declarations(corpsDe(petit.regles, '.loge-carte > .xp-mince')), declarations(corpsDe(reglesDe(sansCommentaires(brut)), '.sr-only')))
  assert.deepEqual(toutes.filter(r => /clip-path|width: 1px/.test(r.corps)).map(r => r.selecteurs.join(', ')), ['.loge-carte > .xp-mince'])
  assert.equal(telephone.regles.some(r => r.selecteurs.some(s => s.includes('xp-mince'))), false, 'un téléphone d’aujourd’hui garde la jauge de sa carte')

  // Plus de phrase sous une rangée de la pièce « Avatar » (le 17 novembre 2026) : ses règles sont parties avec elle.
  const laPhrase = /\.loge-(a-suite|essentiel|suite|bordure-phrase)\b/
  assert.equal(avant.some(r => r.selecteurs.some(s => laPhrase.test(s))), false)
  assert.equal(petit.regles.some(r => r.selecteurs.some(s => laPhrase.test(s))), false)

  // Sans compagnon seulement, le haut de la page remonte : avec lui, sa carte passerait sous sa niche — ni la tête de la
  // page ni la bande collée ne bougent d'un pas à l'autre.
  for (const b of blocs) {
    const haut = b.regles.filter(r => /padding-top/.test(r.corps))
    assert.deepEqual(haut.map(r => r.selecteurs.join(', ')), ['body:not(.avec-niche) .loge-page'], b.condition)
    assert.match(haut[0].corps, /^\s*padding-top: max\(\d+px, env\(safe-area-inset-top\)\); gap: \d+px;\s*$/)
  }
  assert.equal(toutes.some(r => r.selecteurs.some(s => /\.loge-(tete|collante)\b/.test(s))), false)

  // Sur le petit téléphone, les cases de sa vitrine rapetissent, et sa place avec elles : rien ne saute quand elle arrive.
  assert.match(corpsDe(petit.regles, '.loge-carte-vitrine'), /^\s*min-height: 24px;\s*$/)
  assert.match(corpsDe(petit.regles, '.loge-vitrine-case'), /width: 24px; height: 24px;/)
  // Et le haut de la carte ne se resserre à aucun pas : le lambrequin du théâtre y tient ses dix pixels.
  assert.equal(toutes.some(r => r.selecteurs.includes('.loge-carte')), false)

  // La barre de l'essai ne cache rien de plus que le menu qu'elle couvre : sa hauteur se compte comme la sienne — ses
  // rangées de 58 px, son filet d'un pixel, et son pied, six pixels ou la barre d'accueil d'un iPhone. À 65 px plus la
  // barre d'accueil, elle montait six pixels plus haut que lui.
  const feuille = reglesDe(sansCommentaires(brut))
  assert.match(corpsDe(feuille, '.menu-barre'), /padding: 0 6px max\(6px, env\(safe-area-inset-bottom\)\);[\s\S]*border-top: 1px solid/)
  assert.match(corpsDe(feuille, '.menu-barre a'), /min-height: 58px;/)
  assert.match(corpsDe(feuille, '.loge-barre'), /min-height: calc\(59px \+ max\(6px, env\(safe-area-inset-bottom\)\)\);/)
  assert.match(corpsDe(feuille, '.loge-barre'), /box-sizing: border-box;/)
})

// Les pièces Fond et Gerbe, en vignettes (le 17 novembre 2026) : le bouquet d'une gerbe n'a qu'une taille de police
// — l'éventail se fait par `transform` (règle `css.md` : chaque taille d'un emoji se met en forme à part) —, et la
// gerbe se voit à quatre par rangée.
test('la gerbe en vignettes : un bouquet à une seule taille de police, quatre par rangée', async () => {
  const feuille = source('styles.css')
  const corps = (sel: string) => new RegExp(`${sel.replace(/[.()>*]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(feuille)?.[1] ?? ''
  assert.match(corps('.gerbe-bouquet'), /font-size:\s*1\.3rem/)
  assert.doesNotMatch(corps('.gerbe-bouquet > span'), /font-size/, 'une particule ne change jamais de taille de police')
  assert.match(corps('.gerbe-bouquet > span:nth-child(1)'), /rotate\(-?\d+deg\) scale\(0\.\d+\)/)
  assert.match(corps('.loge-vignettes-gerbes'), /--loge-colonnes:\s*4/)
  // Trois particules au plus, les trois premières de la gerbe ; « Aucune » d'abord.
  const html = await rendu('components/Apparence', 'MaGerbe', { profil: LEA, essai: {}, essayer: () => {}, neufs: undefined })
  for (const bouquet of html.match(/<span class="gerbe-bouquet">.*?<\/span><\/span>/g) ?? []) assert.ok((bouquet.match(/<span>/g) ?? []).length <= 3)
  assert.match(html, /<span class="gerbe-aucune"><\/span>/, '« Aucune » d’abord, un anneau en pointillé')
})

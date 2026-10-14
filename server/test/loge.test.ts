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
import { legendaire } from '../../shared/legendaires'
import { brancheDe, portrait } from '../../shared/branches'
import { fond } from '../../shared/fonds'
import { NOM_FINITION, meilleureFinition } from '../../shared/profil'
import { PIECES_DE_LA_LOGE, avecLEssai, carteAvecLEssai, ceQuIlAPorter, essaiVide, essayer, lignesDeLEssai, nouveautes, retenirLesVus, type Tenue } from '../../shared/loge'
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
    { piece: 'vitrine', nom: '2 hauts faits choisis', detail: 'Vitrine' },
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

test('la loge : sa carte en tête, six pièces sur une rangée — la salle d’abord, lui seul ensuite —, qui le voit, puis la pièce touchée', async () => {
  const { espacesFines } = await import(url('format.ts'))
  const contenus: Record<string, RegExp> = {
    // L'avatar : ses finitions en pastilles (la maquette 3), puis ses avatars aux gemmes de l'album.
    avatar: /<div class="loge-finitions">.*<div class="gemmes gemmes-loge" role="tablist" aria-label="Mes avatars, par rareté">/,
    titre: /<h3><svg[^>]*>.*?<\/svg>Mes titres /,
    // Des trophées, le mot de l'album et des fins de partie.
    vitrine: /<h3><svg[^>]*>.*?<\/svg>Mes trophées /,
    fond: /<h3><svg[^>]*>.*?<\/svg>Mes fonds /,
    theme: /<section class="mes-themes">/,
    gerbe: /<h3><svg[^>]*>.*?<\/svg>Mes gerbes /,
  }
  for (const { id, qui } of PIECES_DE_LA_LOGE) {
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
    // Qui le voit, l'œil devant ; puis le panneau de la pièce, et lui seul.
    assert.match(html, new RegExp(`<p class="muted loge-qui"><svg[^>]*>.*?</svg>${espacesFines(qui)}</p>`), id)
    assert.match(html, new RegExp(`<div class="loge-panneau" role="tabpanel" id="loge-panneau" aria-labelledby="loge-${id}">`), id)
    for (const [autre, contenu] of Object.entries(contenus)) assert.equal(contenu.test(html), autre === id, `${id} : ${autre}`)
    // Rien d'essayé : pas de barre, et la région qui dira l'essai, vide.
    assert.doesNotMatch(html, /loge-barre/, id)
    assert.match(html, /<p class="sr-only" role="status"><\/p>/, id)
  }
  // Six pièces : deux groupes, et ce que chacun dit de qui le voit.
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
  await toucher('MonTitre', 'components/Apparence', /^L’Oracle/)
  await toucher('MonTitre', 'components/Apparence', /^Aucun/)
  await toucher('MonFond', 'components/Apparence', /^Nuit étoilée/)
  await toucher('MonFond', 'components/Apparence', /^Velours/)
  await toucher('MesFinitions', 'components/Apparence', /^Argent/)
  await toucher('MesFinitions', 'components/Apparence', /^Auto$/)
  await toucher('MaVitrine', 'components/Trophees', /L’Oracle/)
  assert.deepEqual(essais, [{ titre: 'hf:oracle' }, { titre: null }, { fond: 'nuit' }, { fond: null }, { finition: 'argent' }, { finition: 'auto' }, { vitrine: ['hf:oracle'] }])
  assert.deepEqual(enregistres, [], 'rien n’est enregistré d’un toucher')
  // La vitrine essayée se poursuit dans l'ordre de la carte ; vidée, c'est celle d'office.
  essais.length = 0
  await toucher('MaVitrine', 'components/Trophees', /Le Phénix/, { ...pieces, essai: { vitrine: ['hf:oracle'] } })
  await toucher('MaVitrine', 'components/Trophees', /L’Oracle/, { ...pieces, essai: { vitrine: ['hf:oracle'] } })
  assert.deepEqual(essais, [{ vitrine: ['hf:oracle', 'hf:phenix'] }, { vitrine: null }])
  // La vitrine d'office est une option de la liste, en tête, dans les deux
  // états : un bouton qui ne paraissait qu'une vitrine choisie partait sous
  // le doigt qui le touchait, et le focus tombait sur la page.
  const office = (html: string) => /<ul class="vitrine-choix vitrine-a-choisir" aria-label="Les trophées de ma carte"><li>(<button[^>]*>.*?<\/button>)<\/li>/.exec(html)?.[1]
  assert.equal(
    office(await rendu('components/Trophees', 'MaVitrine', pieces)),
    '<button type="button" class="vitrine-option selected" aria-pressed="true"><span class="hf-emoji" aria-hidden="true">✨</span><span class="hf-corps"><span class="hf-titre">Les plus durs, d’office</span><span class="muted small">Ta carte choisit tes 2 plus durs.</span></span></button>',
  )
  assert.equal(
    office(await rendu('components/Trophees', 'MaVitrine', { ...pieces, essai: { vitrine: ['hf:oracle'] } })),
    '<button type="button" class="vitrine-option" aria-pressed="false"><span class="hf-emoji" aria-hidden="true">✨</span><span class="hf-corps"><span class="hf-titre">Les plus durs, d’office</span><span class="muted small">Ta carte choisit tes 2 plus durs.</span></span><span class="titre-etat">porté</span></button>',
  )
  essais.length = 0
  await toucher('MaVitrine', 'components/Trophees', /^✨Les plus durs, d’office/, { ...pieces, essai: { vitrine: ['hf:oracle'] } })
  assert.deepEqual(essais, [{ vitrine: null }])

  // L'essai se lit dans chaque grille : ce que la carte montre, ce qu'il porte encore.
  const titres = await rendu('components/Apparence', 'MonTitre', { ...pieces, essai: { titre: 'hf:oracle' } })
  assert.match(titres, /<button type="button" class="titre-choix porte" aria-pressed="false">Aucun<span class="titre-etat">porté<\/span><\/button>/)
  assert.match(titres, /<button type="button" class="titre-choix selected essaye" aria-pressed="true">L’Oracle<span class="titre-etat">à l’essai<\/span><\/button>/)
  const fonds = await rendu('components/Apparence', 'MonFond', { ...pieces, essai: { fond: 'nuit' } })
  assert.match(fonds, /class="finition-btn porte" aria-pressed="false"><span class="fond-apercu" aria-hidden="true"><\/span><span class="finition-nom">Velours<\/span><span class="muted small">porté<\/span>/)
  assert.match(fonds, /class="finition-btn selected essaye" aria-pressed="true"><span class="fond-apercu carte-fond fond-nuit" aria-hidden="true"><\/span><span class="finition-nom">Nuit étoilée<\/span><span class="muted small">à l’essai<\/span>/)

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
  assert.match(APPARENCE, /onClick=\{\(\) => essayer\(\{ gerbe: AUCUNE_GERBE \}\)\}/)
  assert.match(APPARENCE, /montrer\(g\.key\)\s*essayer\(\{ gerbe: g\.key \}\)/)
  assert.match(source('components/Boutique.tsx'), /setOuvert\(o => \(o === cle \? null : cle\)\)\s*essayer\(\{ theme: cle === 'velours' \? null : cle \}\)/)
  // Rien ne s'enregistre d'un toucher dans ces grilles — pas même la version, rare ou d'origine, d'un avatar éclaté :
  // elle s'essaie sur la carte de la loge, et « Porter » la garde avec le reste.
  assert.deepEqual([...APPARENCE.matchAll(/\benregistrer\(/g)].length, 0)
  assert.doesNotMatch(source('components/Loge.tsx'), /enregistrer\(\{ eclat/)
  assert.doesNotMatch(source('components/Trophees.tsx'), /\benregistrer\(/)
  const boutique = source('components/Boutique.tsx')
  assert.doesNotMatch(boutique.slice(boutique.indexOf('export function MesThemes'), boutique.indexOf('export function DetailTheme')), /\benregistrer\(/)
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
  assert.match(APP, /<pret\.PanneauLoge profil=\{profil\} piece=\{ecran as PieceDeLaLoge\} onPiece=\{changerDePiece\} busy=\{busy\} enregistrer=\{enregistrer\} erreur=\{erreur\} garde=\{gardeDeLaLoge\} \/>/)
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

  // La loge entière, sur un téléphone qui a vu tout ce qu'elle a sauf Ivoire :
  // le thème a sa pastille ; l'avatar, la pièce ouverte, n'en a pas — on la regarde.
  const vus = ceQuIlAPorter(LEA as any)
  assert.ok(vus.theme.includes('ivoire'))
  const stockage = new Map([[`quizz.loge.vus.${LEA.id}`, JSON.stringify({ ...vus, theme: vus.theme.filter(k => k !== 'ivoire') })]])
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => stockage.get(k) ?? null, setItem: (k: string, v: string) => void stockage.set(k, v), removeItem: (k: string) => void stockage.delete(k) } })
  try {
    const loge = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: LEA, piece: 'avatar', onPiece: () => {}, busy: false, enregistrer: async () => true })
    // Les pièces qui ont leur pastille, bouton par bouton.
    const pastilles = (h: string) =>
      h
        .split('<button id="loge-')
        .slice(1)
        .filter(b => b.slice(0, b.indexOf('</button>')).includes('<span class="loge-neuf" aria-hidden="true"></span>'))
        .map(b => b.slice(0, b.indexOf('"')))
    assert.deepEqual(pastilles(loge), ['theme'])
    assert.match(loge, /Thème<span class="sr-only">, du nouveau<\/span>/)
    // Ouvert sur le thème, plus rien : la pastille d'une pièce s'éteint dès qu'on la regarde.
    const surLeTheme = await rendu('components/PanneauxDuProfil', 'PanneauLoge', { profil: LEA, piece: 'theme', onPiece: () => {}, busy: false, enregistrer: async () => true })
    assert.doesNotMatch(surLeTheme, /loge-neuf|du nouveau/)

    // Le bouton « M'habiller » du profil le dit aussi, avant qu'on entre dans la loge.
    const panneaux = await import(url('components/PanneauxDuProfil.tsx'))
    assert.equal(panneaux.apercusDesTuiles(LEA).nouveau, true)
    // Tout vu : plus rien.
    stockage.set(`quizz.loge.vus.${LEA.id}`, JSON.stringify(vus))
    assert.equal(panneaux.apercusDesTuiles(LEA).nouveau, false)
    // La première fois qu'un profil paraît sur ce téléphone, rien n'est nouveau : on ne sait pas ce qu'il a déjà vu.
    stockage.clear()
    assert.equal(panneaux.apercusDesTuiles(LEA).nouveau, false)
  } finally {
    delete (globalThis as Record<string, unknown>).localStorage
  }
  assert.match(source('views/ProfilApp.tsx'), /titre="M’habiller"\s*detail="Avatar, titre, vitrine, fond, thème, gerbe"\s*pastille=\{plus\?\.nouveau \? 'Nouveau' : undefined\}/)
  // La loge retient ce qu'il a vu — et, la première fois qu'un profil paraît ici, tout se retient (la boutique comprise).
  const LOGE = source('components/Loge.tsx')
  assert.match(LOGE, /const \[neufs\] = useState\(\(\) => nouveautes\(ceQuIlAPorter\(profil\), lireVus\(profil\.id\)\)\)/)
  assert.match(source('views/ProfilApp.tsx'), /lesPanneaux\.retenirLesPremiersVus\(profilDetaille\)/)
  // Le stockage du navigateur, sous try/catch : des cookies bloqués donnaient une page noire.
  assert.equal(LOGE.split('localStorage.').length - 1, 2)
  assert.equal([...LOGE.matchAll(/try \{\s*(?:const brut: unknown = JSON\.parse\()?localStorage\./g)].length, 2)
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
  assert.match(source('components/CarteJoueur.tsx'), /\{retouche \? 'Aperçu de ta carte' : 'Carte de joueur'\}/)
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
  assert.match(source('components/PanneauxDuProfil.tsx'), /export \{ Loge as PanneauLoge, retenirLesPremiersVus \} from '\.\/Loge'/)
  // Sa tête — la carte, la rangée — vient avec la page, sans les règles de
  // l'essai, qui tirent tous les catalogues : seulement les six pièces.
  assert.match(app, /^import \{ LogeEnChemin \} from '\.\.\/components\/LogeTete'$/m)
  const tete = source('components/LogeTete.tsx')
  assert.doesNotMatch(tete, /shared\/loge'|from '\.\/(Loge|Apparence|Trophees|Boutique|PanneauxDuProfil)'/)
  assert.match(tete, /^import \{ PIECES_DE_LA_LOGE, type PieceDeLaLoge \} from '\.\.\/\.\.\/\.\.\/shared\/piecesDeLaLoge'$/m)
  assert.doesNotMatch(readFileSync(new URL('../../shared/piecesDeLaLoge.ts', import.meta.url), 'utf8'), /^import /m)
})

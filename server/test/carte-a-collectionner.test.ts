// La carte d'un joueur, une carte à collectionner (le choix du propriétaire
// du 20 octobre 2026, sur la maquette `retours/2026-10-20/carte-du-joueur/` :
// « J'adore la carte à collectionner […] J'aime beaucoup retourner la
// carte »). Son cadre est celui de sa ligue actuelle aux duels (« De la ligue
// actuelle »), sa croix sous elle (« En bas ») ; au dos, ses chiffres en un
// seul tableau — ses prix, son quiz du jour, ses duels et son record de
// campagne y sont des cadrans, plus des pastilles (« pas très jolies, limite
// plus dans le tableau avec les précisions ») —, ses écussons, puis sa
// collection tout au bout. Son compagnon, perché au coin de l'illustration,
// ne fait plus « tout descendre », et s'ouvre en grand comme son avatar.
//
// Pas de serveur : des modules du client, rendus en HTML, et la feuille de
// style. Le rendu se regarde dans un navigateur (`server/scripts/rendu-carte.ts`) ;
// ici, ce qui le décide et qu'une retouche défairait sans que le typecheck le
// voie. Chaque test échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { LIGUES } from '../../shared/duels'
import { compagnonDe, formeDansLaNiche, nomDeLaForme, type CompagnonPossede } from '../../shared/compagnons'
import { STYLE_D_OFFICE, titreDeLAmitie } from '../../shared/ornements'
import type { CarteDeJoueur } from '../../shared/carte'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const CARTE = source('components/CarteJoueur.tsx')
const CSS = source('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const REGLES = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ selecteurs: sel.split(',').map(s => s.trim()), corps }))

/** Le corps de la première règle qui porte ce sélecteur — et, s'il est dit, ce motif. */
function regle(selecteur: string, motif?: RegExp): string {
  const r = REGLES.find(r => r.selecteurs.includes(selecteur) && (!motif || motif.test(r.corps)))
  assert.ok(r, `la règle ${selecteur} existe`)
  return r.corps
}

type Profil = NonNullable<CarteDeJoueur['profil']>

/** Le profil d'une habituée, sans rien d'autre : on ajoute ce que le test regarde. */
const habituee = (plus: Partial<Profil> = {}): Profil => ({
  prenom: 'Léa',
  niveau: 23,
  legendaires: [],
  divins: [],
  vitrine: [],
  hautsFaits: 17,
  fiche: { soirees: 23, precision: 0.71, qcm: 412, justes: 293, coupDOeil: 0.64, estimationsComparees: 58, reflexeMoyenMs: 4200, quizGagnes: 9, meilleureSerie: 11 },
  ...plus,
})

test('le cadre de sa carte est celui de sa ligue actuelle aux duels — sans duel classé, ni profil, celui de tous', async () => {
  const { cadreDeLaCarte } = await import(url('components/CarteJoueur.tsx'))
  const carte = (profil?: Profil, bordure?: CarteDeJoueur['bordure']): CarteDeJoueur => ({ nom: 'Léa', avatar: '🦊', ...(bordure && { bordure }), ...(profil && { profil }) })
  for (const l of LIGUES) assert.equal(cadreDeLaCarte(carte(habituee({ duels: { ligue: l.cle, cote: 1300 } }))), l.cle)
  // La ligue où il joue, pas la bordure qu'il a choisie de porter.
  assert.equal(cadreDeLaCarte(carte(habituee({ duels: { ligue: 'argent', cote: 1150 } }), { ligue: 'or', crans: 3 })), 'argent')
  // Ni « sans ligue », ni cadre éteint : la carte de tous (l'absence, pas l'infériorité).
  assert.equal(cadreDeLaCarte(carte(habituee())), null, 'sans duel classé')
  assert.equal(cadreDeLaCarte(carte()), null, 'un invité sans profil')

  assert.match(CARTE, /const ligue = carte \? cadreDeLaCarte\(carte\) : null/)
  assert.match(CARTE, /className=\{'carte-joueur' \+ \(ligue \? ` cadre-\$\{ligue\}` : ''\)\}/)
  // Chaque ligue a son métal ; la carte de tous, le champagne du thème. Ses faces le portent.
  for (const l of LIGUES) assert.match(regle(`.cadre-${l.cle}`, /--cadre:/), /--cadre:\s*linear-gradient\(/, l.cle)
  assert.match(regle('.carte-joueur', /--cadre:/), /--cadre:\s*linear-gradient\([^;]*var\(--accent-text\)/)
  assert.match(regle('.carte-face'), /background:\s*var\(--cadre\);/)
  // L'illustration a le cadre de la carte, en anneau : peint sur tout le cadre, il remplissait d'or la fenêtre ouverte sur un fond.
  assert.match(regle('.carte-illustration-cadre::before'), /background:\s*var\(--cadre\);[\s\S]*mask:[^;]*content-box exclude/, 'l’illustration a le cadre de la carte')
  assert.doesNotMatch(regle('.carte-illustration-cadre'), /background:/)
})

test('au dos, un seul tableau : ses cadrans, puis ses prix, son quiz du jour, ses duels et son record de campagne', async () => {
  const { cadransDuDos } = await import(url('components/CarteJoueur.tsx'))
  const plein = cadransDuDos(
    habituee({ prix: { eus: 7, total: 20 }, jour: { joues: 46, victoires: 3 }, duels: { ligue: 'or', cote: 1262 }, campagne: { record: 31, justes: 840, paliers: 12 } }),
  )
  assert.deepEqual(
    plein.map((c: { nom: string }) => c.nom),
    ['Soirées', 'Quiz gagnés', 'Hauts faits', 'Précision', 'Coup d’œil', 'Réflexe', 'Prix', 'Quiz du jour', 'Duels', 'Campagne'],
  )
  // Chacun l'icône de la pastille qu'il remplace, et ce que disait sa pastille, en précision.
  assert.deepEqual(plein.slice(6), [
    { nom: 'Prix', valeur: '7', base: 'sur 20', icone: 'prix' },
    { nom: 'Quiz du jour', valeur: '46 j', base: '3 victoires', icone: 'jour' },
    { nom: 'Duels', valeur: '1262', base: 'Ligue d’or', icone: 'duels', ligue: 'or' },
    { nom: 'Campagne', valeur: '31', base: 'record en série', icone: 'campagne' },
  ])
  // Chacun s'il a quelque chose à dire : ni « 0 prix », ni « 0 victoire ».
  const debutante = cadransDuDos(habituee({ prix: { eus: 0, total: 20 }, jour: { joues: 3, victoires: 0 } }))
  assert.deepEqual(debutante.slice(6), [{ nom: 'Quiz du jour', valeur: '3 j', icone: 'jour' }])
  assert.equal(cadransDuDos(habituee({ jour: { joues: 9, victoires: 1 } })).at(-1).base, '1 victoire')
  assert.equal(cadransDuDos(habituee()).length, 6, 'rien de plus que ses cadrans')
  // Les pastilles sont parties, et le dos dit ses chiffres, ses écussons, puis sa collection, tout au bout.
  assert.doesNotMatch(CARTE, /carte-pastilles|carte-prix/)
  const dos = CARTE.slice(CARTE.indexOf("<section className={classeDe('chiffres')}"))
  const ordre = ['<Cadrans cases={cadransDuDos(p)} />', 'Ses écussons', 'Sa collection', '<Glossaire mots={mots} />'].map(m => dos.indexOf(m))
  assert.ok(ordre.every((i, k) => i > 0 && (k === 0 || i > ordre[k - 1])), `le dos, dans l’ordre : ${ordre}`)
  // Un cadran seul sur la dernière rangée la prend en entier, couché ; deux se la partagent.
  assert.match(regle('.carte-cadrans > .carte-cadran:last-child:nth-child(3n + 1)'), /grid-column:\s*1 \/ -1;\s*flex-direction:\s*row;/)
  assert.match(regle('.carte-cadrans > .carte-cadran:last-child:nth-child(3n + 2)'), /grid-column:\s*span 2;/)
})

test('elle se retourne de face en face : ses chiffres, son savoir, ses sentiers pour un profil, rien pour l’invité sans profil, et les faces cachées se taisent', () => {
  // Les faces de plus (le 31 octobre 2026) ne sont qu'à un profil, et chacune
  // s'il a de quoi la remplir : `facesDeLaCarte` (`carte-savoir.test.ts`).
  assert.match(CARTE, /const aUnDos = !!p && !loupe\n/)
  assert.match(CARTE, /<section className=\{classeDe\('recto'\)\} aria-hidden=\{cachee\('recto'\) \|\| undefined\} inert=\{cachee\('recto'\)\}>/)
  assert.match(CARTE, /\{carte && p && aUnDos && \(\s*<section className=\{classeDe\('chiffres'\)\} aria-hidden=\{cachee\('chiffres'\) \|\| undefined\} inert=\{cachee\('chiffres'\)\}>/)
  assert.match(CARTE, /\{carte && p && aUnDos && radar && \(\s*<section className=\{classeDe\('savoir'\)\} aria-hidden=\{cachee\('savoir'\) \|\| undefined\} inert=\{cachee\('savoir'\)\}>/)
  assert.match(CARTE, /\{carte && p && aUnDos && sentiers && \(\s*<section className=\{classeDe\('sentiers'\)\} aria-hidden=\{cachee\('sentiers'\) \|\| undefined\} inert=\{cachee\('sentiers'\)\}>/)
  // Toute face autre que la montrée se tait : celle qui vient d'être quittée, qui tourne encore, comme les rangées.
  assert.match(CARTE, /const cachee = \(nom: Face\) => nom !== montree\n/)
  // L'invité sans profil a ses mots au recto, puisqu'il n'a pas de dos.
  assert.match(CARTE, /\{!p && mots\.length > 0 && <Glossaire mots=\{mots\} \/>\}/)
  // « Retourner la carte » garde son nom et montre la face suivante, sous la
  // carte, à côté de la croix ; la face où elle s'arrête se dit à l'oreille.
  assert.match(CARTE, /<button type="button" className="carte-retourner" onClick=\{\(\) => tourner\(1\)\}>\s*<Icon name="rotate" \/>\s*Retourner la carte\s*<\/button>/)
  const sous = CARTE.indexOf('<div className="carte-sous">')
  assert.ok(sous > 0 && sous < CARTE.indexOf('className="carte-retourner"') && sous < CARTE.indexOf('className="carte-croix"'))
  assert.ok(CARTE.indexOf('aria-live="polite"') > sous, 'la face montrée se dit sous la carte')
  // Ses faces tiennent la même case, la taille de la plus grande, et se tournent le dos.
  assert.match(regle('.carte-pivot'), /grid-template:\s*minmax\(0, 1fr\) \/ minmax\(0, 1fr\);/)
  assert.match(regle('.carte-face'), /grid-area:\s*1 \/ 1;/)
  assert.match(regle('.carte-face'), /backface-visibility:\s*hidden;/)
  // Le translateZ explicite garde les faces dans le contexte 3D sur Safari iOS
  // (sans lui, le recto restait visible en miroir au lieu du verso).
  assert.match(regle('.carte-envers'), /transform:\s*rotateY\(180deg\) translateZ\(1px\);/)
  assert.match(regle('.carte-face'), /transform:\s*rotateY\(0deg\) translateZ\(1px\);/)
  // Un demi-tour par face, dans le sens du doigt — et rien de posé tant qu'elle n'a pas tourné.
  assert.match(CARTE, /style=\{tour\.demi \? \(\{ '--tourne': `\$\{tour\.demi \* 180\}deg` \} as CSSProperties\) : undefined\}/)
  assert.match(regle('.carte-pivot'), /rotateY\(calc\(var\(--ry, 0deg\) \+ var\(--tourne, 0deg\) \+ var\(--glisse, 0deg\)\)\)/)
  // Les faces rangées gardent leur place sans se voir : la carte garde sa taille d'une face à l'autre.
  assert.match(regle('.carte-face-rangee'), /visibility:\s*hidden;/)
  // Le doigt qui glisse de côté va à la page, pas au défilement.
  assert.match(regle('.carte-joueur .carte-defile', /touch-action/), /touch-action:\s*pan-y pinch-zoom;/)
  // Le mouvement réduit : ni inclinaison sous le doigt, ni retournement animé, ni la carte qui suit le doigt.
  assert.match(CARTE, /if \(!el \|\| sansMouvement\(\)\) return/)
  assert.match(CARTE, /if \(!sansMouvement\(\)\) el\.style\.setProperty\('--glisse'/)
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.carte-pivot \{ transition: none; \}/)
})

test('son fond de carte tapisse chacune de ses faces, dans leur cadre de métal, et l’illustration le laisse voir', () => {
  // Dans l'illustration seule, on ne le voyait que derrière l'avatar, quand la
  // boutique, la loge et la collection le montrent sur la carte entière (« et
  // le fond ne peut pas couvrir recto et verso ? », le propriétaire, le
  // 20 octobre 2026). Ses faces de plus, son savoir et ses sentiers, aussi.
  const dedans = /<div className=\{'carte-dedans' \+ \(fond \? ` carte-fond fond-\$\{fond\}` : ''\)\}>\s*<div className="carte-defile">/g
  assert.equal([...CARTE.matchAll(dedans)].length, 4, 'le recto, ses chiffres, son savoir, ses sentiers')
  assert.match(CARTE, /<div className="carte-illustration">/)
  assert.doesNotMatch(CARTE, /'carte-(joueur|illustration)'[^}]*carte-fond/, 'ni la fenêtre de la carte entière, ni l’illustration seule')
  // Il ne bouge pas : ce qui défile passe par-dessus lui, sans sol à soi ; l'illustration n'y pose qu'un halo autour de l'avatar.
  assert.match(regle('.carte-joueur .carte-fond > .carte-defile'), /background:\s*none;/)
  assert.match(regle('.carte-fond .carte-illustration'), /background:\s*radial-gradient\([^;]*transparent 72%\);/)
  // Le lambrequin du théâtre pend derrière ce que la carte raconte : par-dessus, il couvrait sa tête.
  assert.match(regle('.carte-dedans.carte-fond.fond-theatre:not(.fond-apercu)::before'), /z-index:\s*-1;/)
})

test('son compagnon, perché au coin de l’illustration, ne fait plus tout descendre — et rien ne passe sous lui', () => {
  // Sur l'illustration, en haut à droite comme sur chaque page, et plus sur sa ligne sous l'avatar.
  const illustration = CARTE.slice(CARTE.indexOf('<div className="carte-illustration-cadre">'), CARTE.indexOf('{/* Sa soirée'))
  assert.match(illustration, /\{compagnon && <PlaqueDuCompagnon compagnon=\{compagnon\} \/>\}/)
  assert.match(illustration, /\{compagnon && <SonCompagnon compagnon=\{compagnon\} bouton=\{petitCompagnon\} onOuvrir=\{ouvrirLeCompagnon\} \/>\}/)
  assert.match(regle('.carte-compagnon'), /position:\s*absolute;[^}]*top:\s*-\d+px;\s*right:\s*\d+px;/)
  // Sa guirlande et son étoile montent au-dessus de l'illustration : ce qui la précède s'arrête avant elles — un laurier sur deux lignes passait dessous.
  assert.match(CSS, /\.carte-joueur \.carte-defile:has\(\.carte-compagnon\) :is\(\.carte-tete, \.carte-laurier, \.carte-surnom\) \{ padding-right: \d+px; \}/)
  assert.match(CARTE, /<p className="carte-surnom muted small">/)
  // L'avatar se décale pour lui laisser la place ; sa plaque dit son nom, en bas à droite.
  assert.match(regle('.carte-illustration-cadre:has(.carte-compagnon) .carte-illustration'), /padding-right:\s*\d+px;/)
})

test('son compagnon touché s’ouvre en grand, à la place de ce que la carte raconte : sa niche en grands fichiers, sa forme, son nom, leur amitié', async () => {
  const { laNiche } = await import(url('components/NicheHost.tsx'))
  await laNiche.charger()
  const { CompagnonEnGrand } = await import(url('components/CarteJoueur.tsx'))
  const { ORNEMENTS_PEINTS } = await import(url('components/ornements-peints.ts'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const nox: CompagnonPossede = { compagnon: 'loup', rang: 3, nom: 'Nox', paliers: 1 }
  const html = renderToStaticMarkup(React.createElement(CompagnonEnGrand, { compagnon: nox, onRevenir: () => {} }))
  const forme = formeDansLaNiche(nox)!
  const texte = html.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  // Nommé, sa forme dit ce qu'il est ; sans nom, son nom est celui de sa forme, et son espèce le dit.
  assert.equal(texte, `${forme.nom} · ${nomDeLaForme(forme)} Nox ${titreDeLAmitie(1)} Touche-le pour revenir à la carte.`)
  assert.match(html, /<button type="button" class="carte-loupe-bouton" aria-label="Revenir à la carte"/)
  // Sa guirlande en grand fichier : la petite, faite pour le coin d'une page, s'y verrait floue.
  const [grande, petite] = ORNEMENTS_PEINTS[STYLE_D_OFFICE].guirlande[0].fichiers
  assert.ok(html.includes(grande), 'la guirlande, en grand fichier')
  assert.ok(!html.includes(petite), 'pas la petite')
  const sansNom = renderToStaticMarkup(React.createElement(CompagnonEnGrand, { compagnon: { compagnon: 'chat', rang: 0 }, onRevenir: () => {} }))
  const jeune = formeDansLaNiche({ compagnon: 'chat', rang: 0 })!
  assert.ok(sansNom.includes(`${compagnonDe(jeune).nom} · ${nomDeLaForme(jeune)}</span><b class="carte-loupe-nom">${jeune.nom}</b>`), sansNom)
  // Ouvert, il garde la hauteur de ce qu'il remplace, et Échap rend la carte, comme l'avatar.
  assert.match(CARTE, /\{carte && loupe\?\.sujet === 'compagnon' && compagnon && <CompagnonEnGrand compagnon=\{compagnon\} hauteur=\{loupe\.hauteur\} onRevenir=\{\(\) => setLoupe\(null\)\} \/>\}/)
})

// L'avatar de la carte d'un joueur, en grand.
//
// En tête de la carte, l'avatar tenait dans quelques dizaines de pixels :
// on n'y voyait ni la peinture d'un légendaire, ni la lumière d'une
// finition, ni ce qu'un Éclat avait changé (la demande du 6 octobre 2026).
// Touché, il s'ouvre en grand à la place de ce que la carte raconte — ses
// grands fichiers, le reflet d'un légendaire sous le doigt, son nom
// dessous —, et un nouveau toucher, ou Échap, rend la carte.
//
// Pas de serveur : des modules du client, rendus en HTML, et la feuille de
// style. Le rendu se regarde dans un navigateur ; ici, ce qui le décide et
// qu'une retouche défairait sans que le typecheck le voie. Chaque test
// échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { BRANCHES, brancheDe } from '../../shared/branches'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const CSS = source('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const REGLES = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ selecteurs: sel.split(',').map(s => s.trim()), corps }))

/** Le corps de la première règle qui porte ce sélecteur — et, s'il est dit, ce motif. */
function regle(selecteur: string, motif?: RegExp): string {
  const r = REGLES.find(r => r.selecteurs.includes(selecteur) && (!motif || motif.test(r.corps)))
  assert.ok(r, `la règle ${selecteur} existe`)
  return r.corps
}

/** Les dessins, arrivés : ils s'inscrivent en s'évaluant, comme au navigateur. */
async function charger(...fichiers: string[]) {
  for (const f of fichiers) await import(url(`components/${f}`))
}

/** L'avatar d'une carte, en grand, rendu en HTML. */
async function enGrand(carte: object): Promise<string> {
  const { AvatarEnGrand } = await import(url('components/CarteJoueur.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(AvatarEnGrand, { carte: { nom: 'Léa', avatar: '🦊', ...carte }, onRevenir: () => {} }))
}

/** Ce qu'on lit, sans les balises — ni le titre d'un dessin, qui ne se voit pas. */
const texte = (html: string) =>
  html
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Le premier, avant qu'aucun dessin n'arrive : les suivants les chargent pour tout le fichier.
test('sans son dessin, l’emoji tient la place en grand, et rien ne nomme le légendaire qu’on ne voit pas', async () => {
  const html = await enGrand({ legendaire: 'lg:phenix', finition: 'or' })
  assert.doesNotMatch(html, /Phénix|Légendaire/)
  assert.match(texte(html), /^🦊 Finition Or Touche-le pour revenir à la carte\.$/)
})

test('l’avatar de la carte se touche : il s’ouvre en grand à sa place, et Échap rend la carte sans la fermer', () => {
  const carte = source('components/CarteJoueur.tsx')
  // L'avatar de l'en-tête, dans un bouton qui dit ce qu'il fait, et qui ouvre la loupe.
  assert.match(
    carte,
    /<button[^>]*className="carte-avatar-bouton"[^>]*aria-label=\{`Voir l’avatar \$\{deNom\(carte\.nom\)\} en grand`\}[^>]*onClick=\{ouvrirLaLoupe\}\s*>\s*<Avatar\s+className="carte-avatar"/,
  )
  // Ouverte, elle prend la place de ce que la carte raconte, glossaire compris.
  assert.match(carte, /\{carte && loupe && <AvatarEnGrand /)
  assert.match(carte, /\{carte && !loupe && \(\s*<>\s*<header className="carte-tete">/)
  assert.match(carte, /\{carte && !loupe && motsDeLaCarte\(/)
  // Échap la referme, arrêté avant la fenêtre modale qui, sur le document, fermerait la carte.
  assert.match(carte, /if \(loupe && e\.key === 'Escape'\) \{\s*e\.stopPropagation\(\)\s*setLoupe\(null\)/)
  assert.match(carte, /useModale\(boite, onFermer\)/)
  // Refermée, le focus revient à l'avatar qui l'avait ouverte.
  assert.match(carte, /if \(!loupe && etaitOuverte\.current\) petitAvatar\.current\?\.focus\(/)
})

test('en grand, un légendaire prend ses grands fichiers et sa lumière entière, et son reflet suit le doigt', async () => {
  await charger('Legendaire.tsx', 'Lumiere.tsx')
  const html = await enGrand({ legendaire: 'lg:phenix', finition: 'constellation', eclat: true })
  // Éclaté, sa version rare, en 512 pixels : les 256 de l'en-tête s'y verraient flous.
  assert.match(html, /phenix-rare-512\./)
  assert.match(html, /phenix-rare-perso-512\./)
  assert.doesNotMatch(html, /-256\./)
  // Le reflet suit le doigt, comme à sa révélation.
  assert.match(html, /class="lg [^"]*lg-touche-libre/)
  // Ce que la salle voit : sa finition, sa lumière, son Éclat — en plus grand.
  assert.match(html, /class="av carte-loupe-avatar av-legendaire av-eclat av-lumiere"/)
  // On le touche pour revenir.
  assert.match(html, /<button type="button" class="carte-loupe-bouton" aria-label="Revenir à la carte"/)
  // Dessous, sa famille et son nom, comme sa fiche les dit, puis sa finition et son Éclat.
  assert.equal(texte(html), 'Légendaire Le Phénix Finition Constellation · éclaté Touche-le pour revenir à la carte.')

  // L'en-tête, lui, garde les petits fichiers : c'est `grand` qui les change.
  const { Avatar } = await import(url('components/Avatar.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  const petit = renderToStaticMarkup(
    React.createElement(Avatar, { className: 'carte-avatar', avatar: '🦊', legendaire: 'lg:phenix', finition: 'constellation', eclat: true }),
  )
  assert.match(petit, /phenix-rare-256\./)
  assert.doesNotMatch(petit, /-512\.|lg-touche-libre/)
})

test('en grand, un Divin prend son grand bijou, et ne dit ni finition ni Éclat, qu’il ne prend pas', async () => {
  await charger('Divin.tsx')
  const html = await enGrand({ legendaire: 'dv:helios', finition: 'or', eclat: true })
  assert.match(html, /helios-badge-512\./)
  assert.doesNotMatch(html, /-256\./)
  assert.equal(texte(html), 'Divin Hélios Touche-le pour revenir à la carte.')
})

test('en grand, un portrait des branches prend ses grands fichiers, et dit sa branche', async () => {
  await charger('portraits/foret.ts')
  const p = BRANCHES.find(b => b.key === 'foret')!.portraits[5]
  const html = await enGrand({ legendaire: p.key, finition: 'aurore', eclat: true })
  assert.match(html, /-perso-512\./)
  assert.doesNotMatch(html, /-256\./)
  const b = brancheDe(p)
  assert.equal(texte(html), `${b.nom} · ${b.categorie} ${p.nom} Finition Aurore · éclaté Touche-le pour revenir à la carte.`)
})

test('un invité anonyme s’y voit en grand, sans rien qui dise ce qui lui manque', async () => {
  const seul = '🐻 Touche-le pour revenir à la carte.'
  assert.equal(texte(await enGrand({ nom: 'Bob', avatar: '🐻' })), seul)
  // Un profil en Mat, sans Éclat, pas davantage : ni « Mat », ni « aucune ».
  assert.equal(texte(await enGrand({ nom: 'Bob', avatar: '🐻', finition: 'mat' })), seul)
  // Un emoji qui porte une finition ou un Éclat les dit.
  assert.equal(texte(await enGrand({ avatar: '🦉', finition: 'or', eclat: true })), '🦉 Finition Or · éclaté Touche-le pour revenir à la carte.')
  assert.equal(texte(await enGrand({ avatar: '🦉', eclat: true })), '🦉 Éclaté Touche-le pour revenir à la carte.')
})

test('un doigt qui glisse sur l’avatar en grand fait suivre le reflet, il ne referme rien', async () => {
  const { aGlisse } = await import(url('components/CarteJoueur.tsx'))
  const pose = { x: 100, y: 100 }
  assert.equal(aGlisse(pose, { clientX: 103, clientY: 101, detail: 1 }), false, 'un toucher, à peine bougé, rend la carte')
  assert.equal(aGlisse(pose, { clientX: 160, clientY: 130, detail: 1 }), true, 'un doigt qui glisse la garde')
  assert.equal(aGlisse(pose, { clientX: 0, clientY: 0, detail: 0 }), false, 'Entrée, au clavier, rend la carte')
  assert.equal(aGlisse(null, { clientX: 160, clientY: 130, detail: 1 }), false, 'un clic sans doigt posé — un lecteur d’écran — aussi')
})

test('la case de l’avatar en grand contient tout ce qui en déborde, et la carte ne défile pas en largeur', () => {
  const em = (corps: string, propriete: string) => Number(new RegExp(`(?:^|[;\\s])${propriete}:\\s*([\\d.]+)em`).exec(corps)?.[1])
  const diviseur = (selecteur: string) => Number(/font-size:\s*calc\(var\(--loupe\) \/ ([\d.]+)\)/.exec(regle(selecteur))?.[1])
  // Un emoji : son halo, les paillettes de son Éclat.
  const debords: [string, number][] = [
    ['le halo', em(regle('.av::before', /width/), 'width')],
    ['les paillettes de l’Éclat', em(regle('.av-eclat::after', /width/), 'width')],
  ]
  // Un médaillon, et ce qui le dépasse de son `inset` : la gerbe d'un légendaire éclaté, les rayons d'un Divin.
  const medaillon = em(regle('.av-legendaire .lg', /width/), 'width')
  for (const [quoi, selecteur] of [
    ['la gerbe d’un légendaire éclaté', '.lg-gerbe'],
    ['les rayons d’un Divin', '.dv-rayons'],
  ]) {
    const inset = Number(/inset:\s*-([\d.]+)%/.exec(regle(selecteur, /inset:\s*-/))![1])
    debords.push([quoi, medaillon * (1 + (2 * inset) / 100)])
  }
  const base = diviseur('.carte-loupe-avatar')
  assert.ok(base > 0, 'la taille de l’avatar se compte sur sa case')
  for (const [quoi, taille] of debords) {
    assert.ok(taille > 1 && taille <= base, `${quoi} (${taille.toFixed(2)} em) tient dans la case (${base} em)`)
  }
  // La lumière des trois dernières finitions, jusqu'à son plus grand calque.
  const lumiere = Math.max(
    ...REGLES.filter(r => r.selecteurs.every(s => /^\.lu-[\w-]+$/.test(s)))
      .map(r => em(r.corps, '--d'))
      .filter(Number.isFinite),
  )
  assert.ok(lumiere >= 2.5, `les calques de la lumière sont lus (${lumiere} em)`)
  assert.ok(lumiere <= diviseur('.carte-loupe-avatar.av-lumiere'), `la lumière (${lumiere} em) tient dans la case`)
  // Elle y prend toute sa place, comme partout où l'avatar est le sujet.
  assert.ok(REGLES.some(r => r.selecteurs.includes('.carte-loupe-avatar .lu') && /scale:\s*1;/.test(r.corps)))

  // La case tient dans la largeur de la carte : le voile, le cadre, les marges de ce qui défile.
  const voile = Number(/padding:\s*(\d+)px/.exec(regle('.dialog-backdrop'))![1])
  const cadre = Number(/border:\s*(\d+)px/.exec(regle('.card', /border:/))![1])
  const marge = Number(/padding:\s*\d+px (\d+)px/.exec(regle('.carte-defile'))![1])
  assert.match(regle('.carte-loupe'), new RegExp(`--loupe: min\\(\\d+px, 100vw - ${2 * (voile + cadre + marge)}px,`))
  // Les calques qui tournent sont des carrés : la case coupe leurs coins, et
  // la carte ne défile plus en largeur au gré de leur rotation.
  assert.match(regle('.carte-loupe-bouton'), /overflow:\s*clip/)
  // Moins de mouvement : il ne surgit pas.
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.carte-loupe-avatar \{ animation: none; \}/)
})

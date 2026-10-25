// Les cartes peintes de l'Expédition (`server/scripts/anime/cartes.ts`) : les
// vingt-trois cartes sans légendaire, chacune son illustration — « les cartes
// c'est des rectangles pas très jolis, ça serait pas possible de faire de
// vraies cartes ? Ça rajouterait à l'immersion » (le propriétaire, le 18
// octobre 2026). Leurs fichiers, sous leur empreinte et d'un poids qu'un
// téléphone porte ; la table qui les cite ; aucun fichier que plus personne ne
// cite ; servis un an ; et la carte dessinée qui les montre. Puis l'œuvre
// peinte (`client/src/components/OeuvrePeinte.tsx`, le 25 octobre 2026) : la
// carte dessinée sortie de l'Expédition, pour que le Cabinet de curiosités
// montre ses œuvres — ces mêmes peintures — sans télécharger les règles des
// rencontres ; son cadre doré ; et l'Expédition qui la peint par elle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { demarrer } from './banc'
import { importsStatiques } from './chemin-des-imports'
import { CARTES_DES_RENCONTRES, carteDeRencontre } from '../../shared/rencontres'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url)

/** Là où le build prend les cartes, qu'il sert sous `/cartes/`. */
const PUBLICS = new URL('../../client/public/cartes/', import.meta.url)

/** La table des cartes peintes, telle que la chaîne l'écrit. */
const peintes = async (): Promise<Record<string, readonly [string, string]>> => (await import(client('components/cartes-peintes.ts').href)).CARTES_PEINTES

/** Ce que montre la fenêtre de l'illustration : la peinture, ou le médaillon d'un légendaire. */
const art = (html: string) => /<span class="exp-vc-art">([\s\S]*?)<\/span>/.exec(html)?.[1] ?? ''

type Composant = (p: Record<string, unknown>) => React.ReactNode

/** Un composant du client, rendu en HTML tel que la page le sert. */
async function rendu(fichier: string, nom: string): Promise<(props: Record<string, unknown>) => string> {
  const composant = (await import(client(fichier).href))[nom] as Composant
  const { renderToStaticMarkup } = await import('react-dom/server')
  return props => renderToStaticMarkup(React.createElement(composant, props))
}

/**
 * Bastion, l'épique du Rempart, telle que le Cabinet la montrera : une clé, un
 * nom, une famille, une rareté — rien de ce que l'Expédition joue, ni coût,
 * ni chiffre, ni phrase.
 */
const BASTION = { cle: 'bastion', nom: 'Bastion', famille: 'rempart', rarete: 'epique' }

/**
 * Ce qu'une carte pèse au plus : la grande, levée seule à l'écran ; la petite,
 * cinq dans la main, toutes dans le codex. Au-delà, c'est un fichier qui n'est
 * pas passé par la chaîne (un PNG, une image en 1K).
 */
const poidsMax = (taille: '480' | '240') => (taille === '480' ? 40_000 : 14_000)

test('chaque carte sans légendaire a son illustration, en deux tailles, sous son empreinte', async () => {
  const table = await peintes()
  const aPeindre = CARTES_DES_RENCONTRES.filter(c => !c.legendaire).map(c => c.cle)
  // Toutes, et elles seules : une carte de plus au catalogue sans sa peinture rougirait ici. Celle d'un légendaire est son médaillon.
  assert.deepEqual(Object.keys(table).sort(), [...aPeindre].sort())
  for (const [cle, paire] of Object.entries(table)) {
    assert.equal(paire.length, 2, `${cle} : la grande, puis la petite`)
    for (const [adresse, taille] of [
      [paire[0], '480'],
      [paire[1], '240'],
    ] as const) {
      assert.match(adresse, new RegExp(`^/cartes/${cle}-${taille}\\.[0-9a-f]{10}\\.webp$`), adresse)
      const chemin = new URL(adresse.slice('/cartes/'.length), PUBLICS)
      assert.ok(existsSync(chemin), `${adresse} est cité mais absent`)
      assert.equal(readFileSync(chemin).subarray(8, 12).toString('ascii'), 'WEBP', `${adresse} est une image WebP`)
      assert.ok(statSync(chemin).size <= poidsMax(taille), `${adresse} pèse ${statSync(chemin).size} octets`)
    }
  }
})

test('les cartes peintes sont toutes citées : une carte repeinte emporte l’ancienne', async () => {
  const cites = new Set(Object.values(await peintes()).flat())
  assert.deepEqual(
    readdirSync(PUBLICS)
      .map(f => `/cartes/${f}`)
      .filter(f => !cites.has(f)),
    [],
    'des fichiers que plus personne ne cite',
  )
})

test('la carte dessinée montre sa peinture — la grande levée, la petite ailleurs ; une carte de légendaire garde son médaillon', async () => {
  const table = await peintes()
  const { CarteDessinee } = (await import(client('views/RencontresDExpedition.tsx').href)) as { CarteDessinee: (p: Record<string, unknown>) => React.ReactNode }
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendre = (cle: string, taille: string) => renderToStaticMarkup(React.createElement(CarteDessinee, { c: carteDeRencontre(cle), taille }))
  assert.equal(art(rendre('concentration', 'main')), `<img class="exp-vc-peinture" src="${table.concentration[1]}" alt="" loading="lazy" decoding="async"/>`)
  assert.match(art(rendre('concentration', 'rangee')), new RegExp(`src="${table.concentration[1]}"`))
  assert.match(art(rendre('concentration', 'levee')), new RegExp(`src="${table.concentration[0]}"`))
  // Le dessin d'avant ne s'y pose plus par-dessus.
  assert.doesNotMatch(rendre('concentration', 'main'), /class="icon/)
  assert.doesNotMatch(rendre('tresor', 'main'), /exp-vc-peinture/)
  assert.match(rendre('tresor', 'main'), /exp-medaillon exp-visage-joker/)
})

test('l’œuvre peinte, pièce à part : sa peinture à ses deux tailles, le cadre de la carte dessinée ; un gardien, son médaillon', async () => {
  const table = await peintes()
  const peindre = await rendu('components/OeuvrePeinte.tsx', 'OeuvrePeinte')
  const dessiner = await rendu('views/RencontresDExpedition.tsx', 'CarteDessinee')
  const main = peindre({ oeuvre: BASTION, taille: 'main' })
  const levee = peindre({ oeuvre: BASTION, taille: 'levee' })
  assert.equal(art(main), `<img class="exp-vc-peinture" src="${table.bastion[1]}" alt="" loading="lazy" decoding="async"/>`)
  assert.match(art(peindre({ oeuvre: BASTION, taille: 'rangee' })), new RegExp(`src="${table.bastion[1]}"`))
  assert.match(art(levee), new RegExp(`src="${table.bastion[0]}" alt="" loading="eager"`))
  // Le cadre de la carte de l'Expédition : la gemme de sa rareté, la teinte de sa famille — une œuvre gagnée au Cabinet se
  // reconnaît pour la carte qu'on tenait en main.
  const cadre = (html: string) => /^<span class="exp-vc [^"]*" style="([^"]*)"/.exec(html)?.[1]
  assert.ok(cadre(main))
  assert.equal(cadre(main), cadre(dessiner({ c: carteDeRencontre('bastion'), taille: 'main' })))
  // Rien de ce que joue l'Expédition, qui l'ajoute elle-même : ni coût, ni chiffre, ni phrase.
  assert.doesNotMatch(levee, /exp-vc-cout|exp-vc-valeur|exp-vc-texte|exp-vc-ameliore/)
  // En petit, dessinée seulement — le bouton qui la porte dit ce qu'elle est ; levée, son nom, sa rareté, et elle se lit.
  assert.match(main, /^<span class="exp-vc exp-vc-main" style="[^"]*" aria-hidden="true">/)
  assert.doesNotMatch(main, /exp-vc-nom|exp-vc-rarete-dite/)
  // (React fait précéder une image demandée tout de suite de son préchargement : le cadre suit.)
  assert.match(levee, /^(<link [^>]*\/>)*<span class="exp-vc exp-vc-levee" style="[^"]*"><span class="exp-vc-rarete-dite">épique<\/span>/)
  assert.match(levee, /<b class="exp-vc-nom">Bastion<\/b>/)
  // Un gardien est un légendaire : son médaillon, jamais une peinture.
  const phenix = peindre({ oeuvre: { cle: 'lg:phenix', nom: 'Le Phénix', famille: 'rempart', rarete: 'legendaire', legendaire: 'lg:phenix' }, taille: 'rangee' })
  assert.match(phenix, /^<span class="exp-vc exp-vc-rangee exp-vc-du-legendaire"/)
  assert.match(art(phenix), /^<span class="exp-medaillon exp-visage-joker" aria-hidden="true">/)
  assert.doesNotMatch(phenix, /exp-vc-peinture/)
})

test('une œuvre se teinte de la salle du Cabinet qui l’expose : le Vestibule, celle des neutres', async () => {
  // Le Cabinet range ses œuvres par salle — les huit de famille sous la clé de leur famille, et le Vestibule, qui expose les
  // neutres —, et la passe telle quelle : traduite à la main ou forcée en famille, le Vestibule n'avait plus de teinte, React
  // omettait le `--famille` indéfini, et chaque `color-mix` de la fenêtre tombait.
  const peindre = await rendu('components/OeuvrePeinte.tsx', 'OeuvrePeinte')
  const teinte = (famille: string) => /--famille:([^;"]+)/.exec(peindre({ oeuvre: { cle: 'concentration', nom: 'Concentration', famille, rarete: 'commun' }, taille: 'rangee' }))?.[1]
  assert.ok(teinte('neutre'), 'une carte neutre a sa teinte')
  assert.equal(teinte('vestibule'), teinte('neutre'))
  // Une salle de famille, sa famille : rien à traduire.
  assert.equal(/--famille:([^;"]+)/.exec(peindre({ oeuvre: BASTION, taille: 'rangee' }))?.[1], teinte('rempart'))
})

/** Le corps d'une règle de la feuille commune, tel qu'il est écrit. */
const regleCss = (selecteur: string) => {
  const css = readFileSync(client('styles.css'), 'utf8')
  const debut = css.indexOf(`\n${selecteur} {`)
  return debut < 0 ? '' : css.slice(debut + selecteur.length + 3, css.indexOf('}', debut))
}

test('le cadre doré : sa marque et son or écrits en dur, jamais la couleur seule — « cadre doré » se dit à l’oreille, la rareté garde sa gemme', async () => {
  const peindre = await rendu('components/OeuvrePeinte.tsx', 'OeuvrePeinte')
  const nue = peindre({ oeuvre: BASTION, taille: 'levee' })
  const doree = peindre({ oeuvre: BASTION, taille: 'levee', doree: true })
  // Sa marque et son or, qu'aucun thème ne repeint, comme la teinte d'une famille.
  assert.match(doree, /^(<link [^>]*\/>)*<span class="exp-vc exp-vc-levee exp-vc-doree" style="[^"]*--dorure:#[0-9a-f]{6}"/)
  // Le liseré que sa marque dessine : un second cadre, d'or, au-dedans de celui de la rareté — une forme en plus, que voit qui
  // distingue mal les couleurs. Posé par la pièce, la classe ne dessinait rien : une œuvre dorée en petit ressemblait à une autre.
  const lisere = regleCss('.exp-vc-doree::after')
  assert.match(lisere, /border: \d+(\.\d+)?px solid var\(--dorure\)/, 'un filet d’or')
  assert.match(lisere, /position: absolute/)
  // Au-dedans du cadre : rien qui déborde de côté (règle `css.md`), ni qui passe pour l'anneau du focus ou le cadre d'une carte choisie.
  assert.match(lisere, /inset: \d+px;/)
  assert.match(lisere, /pointer-events: none/)
  // L'or ne repeint ni la gemme ni le cadre de la rareté.
  assert.doesNotMatch(regleCss('.exp-vc-doree') + lisere, /--gemme|border-color/)
  // L'or s'ajoute au cadre, il ne prend pas la place de l'épique : la rareté se lit encore à sa gemme.
  const gemme = (html: string) => /--gemme:([^;"]+)/.exec(html)?.[1]
  assert.ok(gemme(nue))
  assert.equal(gemme(doree), gemme(nue))
  // Levée, elle est le contenu de sa fenêtre : elle le dit, juste après son nom.
  assert.match(doree, /<b class="exp-vc-nom">Bastion<\/b><span class="sr-only">, cadre doré<\/span>/)
  // En petit, dessinée seulement : sa marque, rien à lire — le bouton qui la porte le dit.
  const petite = peindre({ oeuvre: BASTION, taille: 'main', doree: true })
  assert.match(petite, /^<span class="exp-vc exp-vc-main exp-vc-doree" style="[^"]*" aria-hidden="true">/)
  assert.doesNotMatch(petite, /cadre doré/)
  assert.doesNotMatch(nue, /exp-vc-doree|--dorure|cadre doré/)
})

test('l’œuvre peinte ne télécharge rien de l’Expédition : ni ses règles, ni ses pièces, ni les dessins des légendaires', () => {
  const fichier = (f: string) => fileURLToPath(client(f))
  const chemin = importsStatiques(fichier('components/OeuvrePeinte.tsx'))
  // Le parcours voit bien le chemin : sinon ce test ne garderait rien.
  assert.ok(chemin.has(fichier('components/cartes-peintes.ts')), 'les peintures sont sur le chemin')
  assert.ok(chemin.has(fichier('components/Avatar.tsx')), 'le médaillon aussi')
  // `RencontresDExpedition.tsx` tire tout `shared/rencontres.ts` (près de cinq mille lignes), le codex et l'expédition : la
  // page du Cabinet n'en a que faire. Les dessins des légendaires viennent à la demande (règle `medaillons.md`).
  for (const f of ['../../shared/rencontres.ts', '../../shared/codex.ts', '../../shared/expedition.ts', 'views/RencontresDExpedition.tsx', 'views/ExpeditionApp.tsx', 'components/Legendaire.tsx', 'components/Divin.tsx']) {
    assert.ok(!chemin.has(fichier(f)), `${f} ne part pas avec l’œuvre peinte`)
  }
})

test('la carte dessinée de l’Expédition passe par l’œuvre peinte : son cadre et sa peinture ne se posent qu’à un endroit', () => {
  // La source se lit sans l'imprimer : trois mille lignes dans un échec ne diraient rien de plus.
  const rencontres = readFileSync(client('views/RencontresDExpedition.tsx'), 'utf8')
  assert.ok(/<OeuvrePeinte\b/.test(rencontres), 'la carte dessinée pose l’œuvre peinte')
  // Ce qui fait le cadre — la fenêtre, la peinture, le nom au bandeau, la rareté dite, la gemme — vit dans l'œuvre peinte :
  // recopié ici, un cadre retouché d'un côté ne l'aurait plus été de l'autre.
  const recopie = /['"`]exp-vc-(art|peinture|nom|rarete-dite|gemme)\b/.exec(rencontres)
  assert.equal(recopie?.[0], undefined, 'le cadre ne se pose que dans l’œuvre peinte')
})

test('le serveur les sert pour un an, et une carte absente est un 404', async () => {
  // Le client compilé n'existe qu'après le build : un dossier d'une page et d'une carte suffit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  mkdirSync(path.join(dist, 'cartes'))
  const nom = readdirSync(PUBLICS).find(f => f.endsWith('.webp'))!
  copyFileSync(new URL(nom, PUBLICS), path.join(dist, 'cartes', nom))
  const banc = await demarrer({ clientDist: dist })
  try {
    const r = await fetch(`${banc.url}/cartes/${nom}`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('content-type'), 'image/webp')
    assert.match(String(r.headers.get('cache-control')), /max-age=31536000.*immutable/)
    // Une carte repeinte change d'adresse : l'ancienne n'ouvre pas l'application à sa place.
    const absent = await fetch(`${banc.url}/cartes/concentration-480.0000000000.webp`)
    assert.equal(absent.status, 404)
    assert.doesNotMatch(await absent.text(), /<title>FiestApp/)
  } finally {
    await banc.close()
  }
})

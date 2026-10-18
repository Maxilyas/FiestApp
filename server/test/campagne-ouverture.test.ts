// La campagne s'ouvre tout de suite : sa page d'abord, ce qu'elle attend du
// serveur ensuite.
//
// Touchée depuis l'accueil, elle restait 3 à 4 s sur « Chargement… » au
// premier passage après un déploiement : le serveur lisait sa base à la
// première série (`campagne-charge.test.ts` vérifie qu'il la lit maintenant
// en fond). La page montre son défi et ses règles sans attendre, et
// l'accueil télécharge son code avant le toucher.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { DEFIS_RECUS_MONTRES } from '../../shared/campagne'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

test('la campagne s’ouvre sur sa page, pas sur « Chargement… » : le défi et les règles d’abord', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(module.CampagneEnChemin))
  assert.match(html, /Jusqu’où iras-tu/)
  assert.match(html, /trois vies/)
  assert.match(html, /ton record/, 'la place du record, sans rien décaler quand il arrive')
  assert.match(html, /aria-disabled="true"[^>]*>.*Commencer une série/, 'le bouton attend la série à reprendre')
  assert.doesNotMatch(html, /Chargement…/)
  // Et c'est elle que la page rend tant que le serveur n'a pas répondu —
  // ouverte sur les sentiers (`#sentiers`), la place de leurs tuiles.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /if \(ecran\.e === 'chargement'\) return <CampagneEnChemin \/>/)
  assert.match(page, /if \(ecran\.e === 'chargement' && mode === 'sentiers'\) return <SentiersEnChemin onglets=\{onglets\} \/>/)
})

// Ouverte sur le carnet ou le défi, la campagne montrait d'abord la série —
// « Jusqu'où iras-tu ? » et son gros bouton, 60 à 90 ms — avant le bon
// onglet, et demandait deux fois le compte du carnet (l'experte du jeu solo,
// le 11 octobre 2026). Leur page s'esquisse d'elle-même, ses chiffres en
// attente : c'est elle que l'attente rend.
test('ouverte sur le carnet ou le défi, la campagne s’esquisse sur eux, pas sur la série — et lit le carnet une fois', () => {
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  const attente = page.indexOf("if (ecran.e === 'chargement') return <CampagneEnChemin />")
  const carnet = page.indexOf("if (surSonOnglet && mode === 'carnet')")
  const defi = page.indexOf("if (surSonOnglet && mode === 'defi')")
  assert.ok(carnet > 0 && defi > 0 && carnet < attente && defi < attente, 'le carnet et le défi passent avant l’attente de la série')
  assert.match(page, /const surSonOnglet = ecran\.e === 'accueil' \|\| ecran\.e === 'chargement'/)
  // Une révision commencée avant l'état garde son écran.
  assert.match(page, /setEcranBrut\(avant => \(avant\.e === 'chargement' \? \{ e: 'accueil', etat: lu \} : avant\)\)/)
  assert.match(page, /if \(modeDe\(window\.location\.hash\) === 'carnet'\) return\s+api\.campagne\.carnet\s+\.etat\(\)/)
})

// Dans le carnet, « Recommencer » mais rien pour partir — un bouton fantôme
// de 36 px sous la question, hors de l'écran au téléphone (la remarque du
// propriétaire du 11 octobre 2026). Chaque partie de la campagne se quitte
// maintenant d'un « ← Partir » en haut, comme toute page s'en va d'un
// « ← Accueil », et son geste du bas est la même pilule partout.
test('chaque partie de la campagne se quitte d’un « ← Partir » en haut ; recommencer ou abandonner, d’une même pilule en bas', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const pieces = await import(client('components/Pieces.tsx').href)
  const partir = renderToStaticMarkup(React.createElement(pieces.Sortie, { vers: 'Partir', href: '/campagne#carnet', onClick: () => {} }))
  assert.match(partir, /^<a class="lien-discret jour-sortie" href="\/campagne#carnet">.*Partir<\/a>$/, 'un lien, comme « ← Accueil » : il s’ouvre aussi dans un onglet')
  const geste = (danger: boolean) =>
    renderToStaticMarkup(React.createElement(pieces.GesteDuBas, { icone: 'rotate', onClick: () => {}, danger }, 'Recommencer'))
  assert.match(geste(false), /^<button type="button" class="btn btn-block geste-du-bas">.*Recommencer<\/button>$/)
  assert.match(geste(true), /class="btn btn-block geste-du-bas geste-qui-coute"/, 'ce qui coûte une vie le dit')

  // La série, la révision, le défi : partir ramène à l'onglet d'où la partie
  // se reprend — un duel classé ou entre amis, à la page des duels —, et ne
  // se propose plus une fois la dernière réponse donnée — sa fin d'abord.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /const ouAttend: Mode = DUELS \? 'duels' : ecran\.revision \? 'carnet' : ecran\.defi \? 'defi' : 'serie'/)
  assert.match(page, /\{!r\?\.finie && \(\s*<Sortie vers="Partir" href=\{DUELS \? PAGE_DES_DUELS : [^\n]+ onClick=\{partir\} \/>\s*\)\}/)
  assert.match(page, /\{ecran\.revision && !r\?\.finie && \(\s*<GesteDuBas icone="rotate" busy=\{busy\} onClick=\{\(\) => void recommencerLaRevision\(\)\}>/)
  // Les épreuves des sentiers : partir garde l'épreuve en jeu, abandonner
  // coûte une vie — chacun son geste ; l'étape d'un parcours de thème, sans
  // vies, part vers « Apprendre », où elle se reprend (`Parcours.tsx`).
  const sentiers = readFileSync(client('views/Sentiers.tsx'), 'utf8')
  assert.equal([...sentiers.matchAll(/<Sortie vers="Partir"/g)].length, 1, 'l’épreuve d’un sentier')
  const parcours = readFileSync(client('views/Parcours.tsx'), 'utf8')
  assert.equal([...parcours.matchAll(/<Sortie vers="Partir" href=\{`\/campagne\$\{ADRESSE_D_APPRENDRE\}`\} onClick=\{onPartir\} \/>/g)].length, 1, 'l’étape d’un parcours')
  // Validée, la même pilule s'arrête là, sans rien coûter : sa fin et le portrait qu'elle ouvre (`sentiers.test.ts`).
  assert.match(
    sentiers,
    /<GesteDuBas icone=\{valide \? 'check' : 'flag'\} busy=\{busy\} danger=\{!e\.rejeu && !valide\} onClick=\{onQuitter\}>\s*\{valide \? 'Arrêter là · voir mon palier' : 'Abandonner l’épreuve'\}/,
  )
  assert.match(sentiers, /onPartir=\{\(\) => \{\s*retourAuSentier\(ecran\.epreuve\.branche\)/)
  // Revenu sur son sentier, le palier de l'épreuve laissée dit qu'elle l'attend.
  assert.match(sentiers, /\{laissee\?\.palier === r\.n \? 'Reprendre' : 'Jouer'\}/)
  // Plus un seul bouton fantôme sous une question.
  for (const source of [page, sentiers]) assert.ok(!/serie-recommencer|epreuve-quitter/.test(source), 'les boutons fantômes d’avant')
})

// Une série finie menait à l'accueil de l'application, et il fallait y
// revenir pour changer de catégorie : cinq ou six touchers (un retour de
// joueur du 10 octobre 2026). Sa fin la rejoue sur les mêmes catégories, ou
// rouvre la campagne sur leur choix ; la question offre de recommencer.
test('la fin d’une série la rejoue sur ses catégories, ou en change sans quitter la campagne', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const suite = (categories: string[], correctionOuverte = false) =>
    renderToStaticMarkup(
      React.createElement(module.SuiteDeLaSerie, { categories, correctionOuverte, busy: false, onRejouer: () => {}, onChanger: () => {}, onCorrection: () => {} }),
    )
  const une = suite(['Culture générale'])
  assert.match(une, /btn-primary[^>]*>.*Rejouer · Culture générale<\/button>/, 'rejouer d’abord, sur sa catégorie')
  assert.match(une, /Changer de catégorie/)
  assert.ok(une.indexOf('Rejouer') < une.indexOf('Changer de catégorie'))
  assert.match(une, /Mes réponses/)
  assert.match(une, /href="\/"[^>]*>.*Accueil<\/a>/, 'l’accueil reste à un toucher, plus en tête')
  assert.match(suite([]), />Rejouer<\/button>/, 'toutes les catégories : rien à préciser')
  assert.match(suite(['Histoire', 'Sport']), /Rejouer · Histoire et Sport/)
  assert.match(suite(['Histoire', 'Sport', 'Nature']), /Rejouer · 3 catégories/)
  assert.doesNotMatch(suite([], true), /Mes réponses/, 'la correction ouverte ne se redemande pas')
  // La page : le choix retenu sur le téléphone, sa feuille ouverte d'elle-même
  // en arrivant de la fin, et « Recommencer » sous chaque question — jamais au
  // défi, qui n'a qu'une tentative, ni en révision du carnet, qui n'a rien à
  // perdre, ni en rencontre, qui se joue jusqu'au bout.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /useState<string\[\]>\(categoriesRetenues\)/)
  assert.match(page, /const changerDeCategorie = async \(\) => \{\s*setChoixOuvert\(true\)\s*try \{\s*await relire\(\)/)
  assert.match(page, /\{pret && aChoisir && choixOuvert && \(\s*<FeuilleDuChoix/)
  assert.match(page, /\{!ecran\.defi && !ecran\.revision && !ecran\.rencontre && !r\?\.finie && \(\s*<GesteDuBas icone="rotate" busy=\{busy\} onClick=\{\(\) => void abandonner\(\)\}>/)
  // Ce que le téléphone a retenu se relit avec méfiance : un stockage abîmé ne casse rien.
  memoire.set('quizz.campagne.categories', JSON.stringify(['Histoire', 42]))
  assert.deepEqual(module.categoriesRetenues(), ['Histoire'])
  memoire.set('quizz.campagne.categories', '{pas du json')
  assert.deepEqual(module.categoriesRetenues(), [])
  memoire.delete('quizz.campagne.categories')
  assert.equal(module.nomDesCategories(['Histoire']), 'Histoire')
  assert.equal(module.nomDesCategories([]), null)
})

// Une série sur un sujet qui traverse les catégories (`shared/sujets.ts`,
// `campagne-sujets.test.ts`) : sa fin le rejoue, et le choix le retient.
test('la fin d’une série à sujet le rejoue, et le téléphone retient le sujet comme les catégories', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(
    React.createElement(module.SuiteDeLaSerie, { categories: [], sujet: 'annees-80', correctionOuverte: false, busy: false, onRejouer: () => {}, onChanger: () => {}, onCorrection: () => {} }),
  )
  assert.match(html, /btn-primary[^>]*>.*Rejouer · Les années 80<\/button>/)
  assert.match(html, /Changer de sujet/)
  assert.equal(module.nomDuChoix(['Histoire'], 'pionnieres'), 'Pionnières', 'le sujet l’emporte sur des catégories retenues')
  assert.equal(module.nomDuChoix(['Histoire'], null), 'Histoire')
  assert.equal(module.nomDuChoix([], 'astrologie'), null, 'un sujet inconnu ne se nomme pas')
  // Retenu sur le téléphone ; un sujet qu'il ne connaît plus n'y revient pas.
  memoire.set('quizz.campagne.sujet', 'france')
  assert.equal(module.sujetRetenu(), 'france')
  memoire.set('quizz.campagne.sujet', 'astrologie')
  assert.equal(module.sujetRetenu(), null)
  memoire.delete('quizz.campagne.sujet')
  assert.equal(module.sujetRetenu(), null)
  // La page : la ligne du choix sous le gros bouton, et sa feuille — un sujet de chaque famille,
  // chacune son allure, dans l'onglet d'à côté ; « Commencer » part sur celui qui se joue.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /useState<string \| null>\(sujetRetenu\)/)
  // La feuille vit à part, la même pour la série et pour « Défier quelqu'un » (`ChoixDuTheme.tsx`) :
  // chaque famille — un thème, une époque, un fil rouge — sa rangée nommée (`FAMILLES_DE_SUJETS`).
  assert.match(page, /<FeuilleDuChoix\s+categoriesJouables=\{etat\.categories\.map\(c => c\.categorie\)\}\s+sujets=\{sujets\}\s+categories=\{categories\}\s+sujet=\{sujetJouable\}/)
  assert.match(page, /<LigneDuChoix categories=\{categories\} sujet=\{sujetJouable\} sur onChanger=\{\(\) => setChoixOuvert\(true\)\} \/>/)
  const grille = readFileSync(client('components/ChoixDuTheme.tsx'), 'utf8')
  assert.match(grille, /FAMILLES_DE_SUJETS\.map\(\(\{ famille, nom: nomDeLaFamille \}\) =>/)
  assert.match(grille, /role="group" aria-label=\{nomDeLaFamille\}/)
  assert.match(page, /onClick=\{\(\) => void commencer\(categories, sujetJouable\)\}/)
  // Le gros bouton d'abord, puis la ligne du choix, puis les records repliés (la maquette validée le 12 octobre 2026).
  const accueil = page.slice(page.indexOf("if (ecran.e === 'accueil') {"), page.indexOf("if (ecran.e === 'fin' && ecran.revision)"))
  const bouton = accueil.indexOf('onClick={() => void commencer(categories, sujetJouable)}')
  const ligne = accueil.indexOf('<LigneDuChoix')
  const records = accueil.indexOf('<RecordsParCategorie')
  assert.ok(bouton > 0 && ligne > bouton && records > ligne, 'Commencer, puis « Sur … · Changer », puis les records')
})

// Le souhait du propriétaire du 12 octobre 2026 : les catégories, quand on
// défie quelqu'un, dans la série et sur les sentiers à thème, « trop
// impressionnantes » — douze cases et vingt-cinq sujets dépliés, « Jouer le
// duel » tout en bas. La proposition 1 de la maquette, validée le même jour :
// une ligne qui dit le choix, « Changer » au bout, et une feuille.
test('« Sur quoi ? » tient en une ligne ; « Changer » ouvre la feuille du choix — les catégories, puis les thèmes, rien ne change avant « Choisir »', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { LigneDuChoix, FeuilleDuChoix } = await import(client('components/ChoixDuTheme.tsx').href)
  const { SUJETS } = await import('../../shared/sujets')
  const ligne = (categories: string[], sujet: string | null, sur = false) =>
    renderToStaticMarkup(React.createElement(LigneDuChoix, { categories, sujet, sur, onChanger: () => {} }))
  // Toutes : ce qu'on peut choisir d'autre se dit dessous.
  assert.match(
    ligne([], null),
    /^<button type="button" class="quoi-ligne" aria-haspopup="dialog"><svg[^>]*>.*?<\/svg><span class="quoi-texte"><b>Toutes les catégories<\/b><span class="muted small">ou une catégorie, un thème, une époque…<\/span><\/span><span class="quoi-changer">Changer<svg[^>]*>.*?<\/svg><\/span><\/button>$/,
  )
  // La série la précède de « Sur » : sous le gros bouton, rien d'autre ne le dit.
  assert.match(ligne([], null, true), /<span class="quoi-texte"><span class="muted small">Sur<\/span><b>Toutes les catégories<\/b>/)
  assert.match(ligne(['Histoire'], null), /<b>Histoire<\/b><\/span>/, 'une catégorie : son nom suffit')
  assert.match(ligne(['Histoire', 'Sport', 'Nature'], null), /<b>3 catégories<\/b><span class="muted small">Histoire, Sport, Nature<\/span>/)
  assert.match(ligne(['Histoire'], 'annees-80'), /<b>Les années 80<\/b><span class="muted small">De 1980 à 1989/, 'le sujet l’emporte, sa description dessous')

  const feuille = (categories: string[], sujet: string | null, sujets: readonly (typeof SUJETS)[number][] = SUJETS.slice(0, 2)) =>
    renderToStaticMarkup(
      React.createElement(FeuilleDuChoix, { categoriesJouables: ['Histoire', 'Sport', 'Nature'], sujets, categories, sujet, onChoisir: () => {}, onFermer: () => {} }),
    )
  const toutes = feuille([], null)
  assert.match(toutes, /role="dialog" aria-modal="true" aria-label="Sur quoi \?"/)
  // Deux onglets : les catégories d'abord, les sujets à côté, comptés.
  assert.match(toutes, /role="tab" aria-selected="true"[^>]*>Catégories<\/button>/)
  assert.match(toutes, /role="tab" aria-selected="false"[^>]*>Thèmes · 2<\/button>/)
  assert.match(toutes, /<button type="button" class="quoi-toutes active" aria-pressed="true"><svg[^>]*>.*?<\/svg><span>Toutes les catégories<\/span><svg/)
  assert.match(toutes, /<div class="quoi-grille" role="group" aria-label="Catégories"><button type="button" class="quoi-case" aria-pressed="false">Histoire<\/button>/)
  assert.doesNotMatch(toutes, /quoi-pastille/, 'les sujets attendent leur onglet')
  assert.match(toutes, /<footer class="carte-pied">.*Choisir · toutes les catégories<\/button><\/footer>/)
  // Deux catégories choisies : elles se disent pressées, et « Choisir » les nomme.
  const deux = feuille(['Histoire', 'Sport'], null)
  assert.match(deux, /class="quoi-toutes" aria-pressed="false"/)
  assert.match(deux, /class="quoi-case active" aria-pressed="true">Histoire<\/button>/)
  assert.match(deux, /class="quoi-case" aria-pressed="false">Nature<\/button>/)
  assert.match(deux, /Choisir · Histoire et Sport<\/button>/)
  // Sur un sujet, la feuille s'ouvre sur son onglet : sa tuile pressée, sa description au-dessus de « Choisir ».
  const sujet = feuille(['Histoire'], SUJETS[0].cle, SUJETS)
  assert.match(sujet, /role="tab" aria-selected="true"[^>]*>Thèmes · \d+<\/button>/)
  assert.match(sujet, new RegExp(`class="quoi-tuile active" aria-pressed="true"><span class="quoi-medaillon"><svg[^>]*>.*?</svg></span><span class="quoi-nom">${SUJETS[0].nom}</span></button>`))
  assert.ok(sujet.indexOf('Un thème') < sujet.indexOf('Une époque') && sujet.indexOf('Une époque') < sujet.indexOf('Un fil rouge'), 'chaque famille sa rangée, les thèmes d’abord')
  // Les fêtes avant tout (le 17 octobre 2026) : en tuiles, comme les thèmes, la plus proche d'abord.
  assert.ok(sujet.indexOf('Une fête') > 0 && sujet.indexOf('Une fête') < sujet.indexOf('Un thème'), 'les fêtes, puis les thèmes')
  for (const fete of SUJETS.filter(s => s.famille === 'fete')) {
    assert.match(sujet, new RegExp(`class="quoi-tuile" aria-pressed="false"><span class="quoi-medaillon"><svg[^>]*>.*?</svg></span><span class="quoi-nom">${fete.nom}</span></button>`), fete.cle)
  }
  // Chaque famille son allure : les époques en frise, dans l'ordre du temps,
  // un jalon chacune, le fil coupé en haut et en bas de ses deux colonnes ;
  // les fils rouges en pastilles, leur emblème devant.
  // Dix-sept depuis leur redécoupage (le 17 octobre 2026) : neuf rangs, la seconde colonne finie un rang plus tôt.
  const epoques = SUJETS.filter(s => s.famille === 'epoque')
  assert.equal(epoques.length, 17)
  assert.match(sujet, /<div class="quoi-frise" role="group" aria-label="Une époque" style="--rangs:9">/)
  const frise = [...sujet.matchAll(/class="(quoi-epoque[^"]*)" aria-pressed="false"><span class="quoi-jalon"><\/span><span class="quoi-nom">([^<]+)<\/span>/g)]
  assert.deepEqual(
    frise.map(m => m[2]),
    epoques.map(s => s.nom),
  )
  assert.deepEqual(
    frise.map(m => m[1]),
    epoques.map((_, i) => 'quoi-epoque' + (i % 9 === 0 ? ' quoi-epoque-debut' : '') + (i % 9 === 8 || i === 16 ? ' quoi-epoque-fin' : '')),
  )
  const fil = SUJETS.find(s => s.famille === 'fil')!
  assert.match(sujet, new RegExp(`class="quoi-fil" aria-pressed="false"><svg[^>]*>.*?</svg><span class="quoi-nom">${fil.nom}</span></button>`))
  assert.match(sujet, new RegExp(`<p class="muted small centre quoi-description">${SUJETS[0].description}</p>`))
  assert.match(sujet, new RegExp(`Choisir · ${SUJETS[0].nom}</button>`))
  // Sans sujet à jouer : pas d'onglets, les catégories seules.
  assert.doesNotMatch(feuille([], null, []), /role="tab"/)
  // « Défier quelqu'un » s'en sert aussi, et ne déplie plus la grille.
  const lancer = readFileSync(client('views/LancerUnDefi.tsx'), 'utf8')
  assert.match(lancer, /<LigneDuChoix categories=\{categories\} sujet=\{sujet\} onChanger=\{\(\) => setChoixOuvert\(true\)\} \/>/)
  assert.match(lancer, /\{choixOuvert && \(\s*<FeuilleDuChoix/)
  assert.doesNotMatch(lancer, /GrilleDesCategories|GrilleDesSujets/)
})

// Les rubriques (le choix du propriétaire du 17 octobre 2026, « apporter
// beaucoup de choix ») : « Sport », puis « Football ». Une catégorie choisie
// seule s'affine en ses sous-thèmes, sous la rangée de sa case ; douze
// catégories dépliées feraient près de cent pastilles, le mur de mots d'avant.
test('une catégorie choisie seule s’affine en ses rubriques, sous sa rangée ; une rubrique choisie garde sa catégorie, et l’onglet des thèmes ne les compte pas', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { FeuilleDuChoix, LigneDuChoix } = await import(client('components/ChoixDuTheme.tsx').href)
  const { SUJETS, RUBRIQUES } = await import('../../shared/sujets')
  const sport = RUBRIQUES.filter(r => r.categorie === 'Sport')
  const feuille = (categories: string[], sujet: string | null) =>
    renderToStaticMarkup(
      React.createElement(FeuilleDuChoix, {
        categoriesJouables: ['Histoire', 'Sport', 'Nature'],
        sujets: [...SUJETS.slice(0, 2), ...sport],
        categories,
        sujet,
        onChoisir: () => {},
        onFermer: () => {},
      }),
    )
  // Rien de choisi, ou deux catégories : rien ne s'affine. Les rubriques ne comptent pas parmi les thèmes.
  assert.doesNotMatch(feuille([], null), /quoi-rubrique/)
  assert.doesNotMatch(feuille(['Histoire', 'Sport'], null), /quoi-rubrique/)
  assert.match(feuille([], null), /role="tab" aria-selected="false"[^>]*>Thèmes · 2<\/button>/)
  // Le sport seul : ses rubriques sous sa rangée — l'Histoire et lui —, avant la Nature, chacune sa case. Incrustées
  // sous la sienne (le souhait du propriétaire du 17 octobre 2026 : en pastilles, « pas très jolies », « un truc
  // incrusté ») : elle s'ouvre sur leur panneau, qui garde un coin droit sous elle, au bord droit de la grille ;
  // « Toute la catégorie » d'abord, pressée tant qu'aucune rubrique ne l'est.
  const seul = feuille(['Sport'], null)
  assert.match(
    seul,
    /class="quoi-case active ouverte" aria-pressed="true">Sport<\/button><div class="quoi-rubriques quoi-rubriques-droite" role="group" aria-label="Dans Sport"><button type="button" class="quoi-rubrique active" aria-pressed="true">Toute la catégorie<\/button><button type="button" class="quoi-rubrique" aria-pressed="false">Football<\/button>/,
  )
  assert.ok(seul.indexOf('quoi-rubriques') < seul.indexOf('>Nature<'), 'sous la rangée de sa case')
  assert.equal([...seul.matchAll(/class="quoi-rubrique"/g)].length, sport.length)
  assert.equal(seul.match(/ ouverte"/g)?.length, 1, 'sa case seule s’ouvre')
  // Au bord gauche, le coin droit à gauche — et le panneau après sa voisine, au bout de la rangée.
  const aGauche = renderToStaticMarkup(
    React.createElement(FeuilleDuChoix, {
      categoriesJouables: ['Sport', 'Histoire', 'Nature'],
      sujets: [...SUJETS.slice(0, 2), ...sport],
      categories: ['Sport'],
      sujet: null,
      onChoisir: () => {},
      onFermer: () => {},
    }),
  )
  assert.match(aGauche, /class="quoi-case active ouverte" aria-pressed="true">Sport<\/button><button type="button" class="quoi-case" aria-pressed="false">Histoire<\/button><div class="quoi-rubriques quoi-rubriques-gauche"/)
  // L'Histoire seule : la base ne lui sert ici aucune rubrique, rien ne s'affine.
  assert.doesNotMatch(feuille(['Histoire'], null), /quoi-rubriques/)
  // Une rubrique choisie : la feuille s'ouvre sur les catégories, sa catégorie et elle pressées, ce qu'elle est au-dessus de « Choisir ».
  const foot = feuille(['Histoire'], 'sport/football')
  assert.match(foot, /role="tab" aria-selected="true"[^>]*>Catégories<\/button>/)
  assert.match(foot, /class="quoi-case" aria-pressed="false">Histoire<\/button>/)
  assert.match(foot, /class="quoi-case active ouverte" aria-pressed="true">Sport<\/button>/)
  assert.match(foot, /class="quoi-rubrique active" aria-pressed="true">Football<\/button>/)
  assert.match(foot, /class="quoi-rubrique" aria-pressed="false">Toute la catégorie<\/button>/)
  assert.match(foot, /<p class="muted small centre quoi-description">Sport<\/p>/)
  assert.match(foot, /Choisir · Football<\/button>/)
  // La ligne du choix la nomme, et dit d'où elle vient.
  const ligne = renderToStaticMarkup(React.createElement(LigneDuChoix, { categories: ['Sport'], sujet: 'sport/football', onChanger: () => {} }))
  assert.match(ligne, /<b>Football<\/b><span class="muted small">Sport<\/span>/)
})

// L'onglet de classeur tient à des pixels : la case ouverte descend à travers
// l'écart de sa grille et recouvre le bord du panneau, d'une teinte opaque.
// Un écart changé d'un côté seulement, et la case flottait au-dessus du
// panneau, ou le chevauchait ; translucide, elle laissait voir le bord.
test('la case ouverte descend à travers l’écart de sa grille jusqu’au bord du panneau, qu’elle recouvre d’une teinte opaque', () => {
  const css = readFileSync(client('styles.css'), 'utf8')
  for (const [grille, kase] of [
    ['quoi-grille', 'quoi-case'],
    ['categories-grille', 'categorie-case'],
  ]) {
    const ecart = Number(new RegExp(`^\\.${grille} \\{[^}]*\\bgap: (\\d+)px`, 'm').exec(css)?.[1])
    const fond = Number(new RegExp(`^\\.${kase} \\{[^}]*\\bpadding: (\\d+)px`, 'm').exec(css)?.[1])
    const ouverte = new RegExp(`^\\.${kase}\\.ouverte \\{ margin-bottom: -(\\d+)px; padding-bottom: (\\d+)px; \\}`, 'm').exec(css)
    assert.ok(ecart > 0 && fond > 0 && ouverte, kase)
    assert.equal(Number(ouverte[1]), ecart + 1, `${kase} : l’écart, puis le bord du panneau`)
    // Son bord du bas ôté, son fond le remplace : son propre fond, l'écart, le bord du panneau et le sien.
    assert.equal(Number(ouverte[2]), fond + ecart + 2, `${kase} : son texte reste au milieu de sa rangée`)
  }
  assert.match(css, /--teinte-ouverte: color-mix\(in srgb, var\(--accent\) 12%, var\(--bg\)\);/)
  assert.match(css, /\.quoi-case\.ouverte, \.categorie-case\.ouverte \{[^}]*border-bottom-width: 0;[^}]*background: var\(--teinte-ouverte\);/)
  assert.match(css, /\.quoi-rubriques \{[^}]*background: var\(--teinte-ouverte\);/)
})

// Un sujet qui ne lit qu'un sous-thème en tient la rubrique (le 17 octobre
// 2026) : « Les jeux vidéo » et « Jeux vidéo » posaient les mêmes questions,
// et se suivaient au carnet. Un seul sujet, deux portes.
test('le sujet qui tient une rubrique se range à sa place sous sa catégorie ; la feuille le rouvre là où on l’a touché', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { FeuilleDuChoix } = await import(client('components/ChoixDuTheme.tsx').href)
  const { SUJETS_ET_RUBRIQUES } = await import('../../shared/sujets')
  const feuille = (categories: string[], sujet: string | null) =>
    renderToStaticMarkup(
      React.createElement(FeuilleDuChoix, {
        categoriesJouables: ['Sport', 'Jeux & pop culture'],
        sujets: SUJETS_ET_RUBRIQUES.filter(s => s.categorie === 'Jeux & pop culture'),
        categories,
        sujet,
        onChoisir: () => {},
        onFermer: () => {},
      }),
    )
  // Les jeux et la pop culture seuls : « Les jeux vidéo » d'abord, à la place de « Jeux vidéo », une fois.
  const seuls = feuille(['Jeux & pop culture'], null)
  assert.match(
    seuls,
    />Toute la catégorie<\/button><button type="button" class="quoi-rubrique" aria-pressed="false">Les jeux vidéo<\/button><button type="button" class="quoi-rubrique" aria-pressed="false">Jeux de société et de cartes<\/button>/,
  )
  assert.doesNotMatch(seuls, />Jeux vidéo</)
  assert.match(seuls, />Thèmes · 1<\/button>/, 'parmi les thèmes aussi : c’en est un')
  // Touché sous sa catégorie — elle seule choisie avec lui —, la feuille l'y rouvre.
  const dessous = feuille(['Jeux & pop culture'], 'jeux-video')
  assert.match(dessous, /role="tab" aria-selected="true"[^>]*>Catégories<\/button>/)
  assert.match(dessous, /class="quoi-case active ouverte" aria-pressed="true">Jeux &amp; pop culture<\/button>/)
  assert.match(dessous, /class="quoi-rubrique active" aria-pressed="true">Les jeux vidéo<\/button>/)
  // Touché parmi les thèmes, elle s'y rouvre : sa tuile pressée.
  const parmi = feuille([], 'jeux-video')
  assert.match(parmi, /role="tab" aria-selected="true"[^>]*>Thèmes · 1<\/button>/)
  assert.match(parmi, /class="quoi-tuile active" aria-pressed="true">/)
})

// Le défi entre amis (`campagne-duel.test.ts`) : sa fin l'envoie d'abord —
// celui qui vient de le lancer n'a encore défié personne —, et son lien
// survit à une connexion.
test('la fin d’un défi entre amis l’envoie : son lien écrit, son code, son classement', async () => {
  const module = await import(client('views/Duel.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(module.FinDuDuel, { code: 'K7M2QX', justes: 5, onClassement: () => {} }))
  assert.match(html, /Envoie ce défi/)
  // Sans feuille de partage ni presse-papier — Node n'en a pas —, le lien reste écrit.
  assert.match(html, /<span class="duel-lien">http:\/\/banc\/duels#duel-K7M2QX<\/span>/, 'son lien mène à la page des duels')
  assert.match(html, /son code : <b>K7M2QX<\/b>/)
  assert.match(html, /Le classement du défi/)
  assert.equal(module.texteDuDefi(5), '5 bonnes réponses à ce défi sur FiestApp : feras-tu mieux ?')
  assert.equal(module.texteDuDefi(null), 'Un défi entre amis sur FiestApp : feras-tu mieux que moi ?')
  assert.equal(module.fermeture(0), 'Fermé : son classement est figé')
  // Le nombre tient à son mot (une espace insécable) : « Ferme dans 7 » ne finit plus une ligne.
  assert.equal(module.fermeture(30), 'Ferme dans 30\u00a0minutes')
  assert.equal(module.fermeture(3 * 24 * 60 + 5), 'Ferme dans 3\u00a0jours')
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  // L'ami sans profil se connecte, puis revient sur le défi : `next` garde son fragment.
  assert.match(page, /const retour = encodeURIComponent\(DUELS \? `\$\{PAGE_DES_DUELS\}\$\{codeDuDuel \? adresseDuDuel\(codeDuDuel\) : ''\}` : '\/campagne'\)/)
  assert.match(page, /href=\{`\/\?next=\$\{retour\}`\}/)
  // Une seule tentative : pas de « Recommencer » — le drapeau du défi le dit.
  assert.match(page, /defi: true,\s*duel: code,/)
})

// Le souhait du propriétaire du 11 octobre 2026 : « choisir avec qui je le
// lance, sur quel thème. Quitte à faire le quiz moi et que ça envoie une
// notif à la personne ». « Défier des amis » lançait la partie tout de suite,
// sur les catégories de la série, sans dire à qui elle partirait ; la fin
// cochait d'office toute sa liste d'amis. Puis, le même jour : « tu choisis
// sur quoi tu veux défier, une barre de recherche, un classement de la ligue
// avec des petites épées ; pas de lien à partager » — on défie quelqu'un,
// trouvé par son prénom, parmi ses amis ou d'une épée du classement.
test('défier quelqu’un : contre qui, sur quoi, puis on joue — la page des duels l’ouvre, « Défier » sur chaque carte y mène, et sa fin dit à qui il est parti', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const lancer = await import(client('views/LancerUnDefi.tsx').href)
  const duel = await import(client('views/Duel.tsx').href)
  const { SUJETS } = await import('../../shared/sujets')
  const { enjeuContre } = await import('../../shared/duels')
  const tom = { profileId: 't', nom: 'Tom', avatar: '🐻', cote: 1240, ligue: 'or', rang: 3 }
  const hugo = { profileId: 'h', nom: 'Hugo', avatar: '🐼' }
  const composer = (amis: object[] | null, depart: object) =>
    renderToStaticMarkup(
      React.createElement(lancer.LancerUnDefi, {
        amis,
        categoriesJouables: ['Histoire', 'Sport'],
        sujets: SUJETS.slice(0, 2),
        depart,
        busy: false,
        erreur: '',
        onLancer: () => {},
        onRetour: () => {},
      }),
    )
  // Le joueur touché — « Défier » sur sa carte, du classement ou de ses amis — arrive choisi, sa ligue, sa cote et sa place dites ; les catégories de sa dernière série, choisies.
  const html = composer([tom, hugo], { categories: ['Histoire'], sujet: null, adversaire: tom, moi: { cote: 1000, joues: 0 } })
  assert.match(html, /<h1>Défier Tom<\/h1>/)
  assert.match(html, /<span class="defier-numero" aria-hidden="true">1<\/span>Contre qui \?/)
  // Un nombre ne quitte pas son mot : « cote » et « 1240 » sur la même ligne.
  assert.match(html, /<b>Tom<\/b><span class="muted small">Or · cote 1240 · 3e<\/span>/)
  assert.match(html, />Changer<\/button>/)
  assert.doesNotMatch(html, /Hugo/, 'choisi, il n’y a plus que lui')
  // Sur quoi : une ligne, « Changer » au bout — la grille dépliée repoussait « Jouer le duel » tout en bas (le 12 octobre 2026).
  assert.match(html, /<span class="defier-numero" aria-hidden="true">2<\/span>Sur quoi \?<\/h2><button type="button" class="quoi-ligne" aria-haspopup="dialog"><svg[^>]*>.*?<\/svg><span class="quoi-texte"><b>Histoire<\/b><\/span><span class="quoi-changer">Changer/)
  assert.doesNotMatch(html, /categorie-case|quoi-case/, 'la feuille ne s’ouvre qu’au toucher')
  assert.match(html, /<button type="button" class="btn btn-primary btn-big btn-block"><svg[^>]*>.*?<\/svg>Jouer le duel<\/button>/)
  assert.match(html, /À ta dernière réponse, Tom reçoit le duel\u00a0: dans ses duels, et son accueil le lui dit\./)
  assert.doesNotMatch(html, /téléphone|notification/, 'sans notification depuis le 13 octobre 2026')
  // Ce qui se joue se dit avant : contre sa cote à lui, sa part de lanceur comprise — en deux jetons sous lui, depuis le
  // 14 octobre 2026 (`duels-enjeu.test.ts`) : dans la phrase sous « Jouer le duel », il sortait de l'écran. Sous l'Or, la
  // montée : même perdu, le duel lui rapporte — « +5 si tu perds » en rouge se lisait comme une menace.
  const enjeu = enjeuContre({ cote: 1000 }, 1240, true)
  assert.ok(enjeu.perdu > 0)
  assert.ok(html.includes(`<span class="duels-jeton"><b class="num">+${enjeu.gagne}</b><span>victoire</span></span><span class="duels-jeton"><b class="num">+${enjeu.perdu}</b><span>défaite</span></span>`))
  assert.ok(html.includes('Le duel joué des deux côtés, vos deux cotes bougent.'))
  // Au-dessus de l'Or, contre plus faible, une défaite coûte : elle le dit en moins.
  const enOr = composer([tom], { categories: ['Histoire'], sujet: null, adversaire: { ...tom, cote: 1000 }, moi: { cote: 1350, joues: 40, plancher: 1200 } })
  const enjeuEnOr = enjeuContre({ cote: 1350, plancher: 1200 }, 1000, true)
  assert.ok(enjeuEnOr.perdu < 0)
  assert.ok(enOr.includes(`<span class="duels-jeton perdu"><b class="num">−${-enjeuEnOr.perdu}</b><span>défaite</span></span>`))
  assert.match(html, /<a class="lien-discret jour-sortie" href="\/duels">/, '« ← Les duels » : la page d’où l’on vient')
  // Personne de choisi : la barre de recherche — sans autoFocus, le clavier pousserait la page —, puis ses amis, chacun « Choisir » ; le bouton attend.
  const libre = composer([tom, hugo], { categories: [], sujet: null })
  assert.match(libre, /<h1>Défier quelqu’un<\/h1>/)
  assert.match(libre, /<input class="input" type="search" placeholder="Un prénom…"/)
  assert.doesNotMatch(libre, /autofocus/i)
  assert.match(libre, /<button type="button" class="btn btn-small" aria-label="Défier Hugo"><svg[^>]*>.*?<\/svg>Choisir<\/button>/)
  assert.match(libre, /<b>Hugo<\/b><span class="muted small">pas encore de duel classé<\/span>/, 'sans duel classé : ni ligue ni cote, l’absence')
  assert.match(libre, /aria-disabled="true"><svg[^>]*>.*?<\/svg>Jouer le duel<\/button>/)
  assert.match(libre, /<span class="quoi-texte"><b>Toutes les catégories<\/b><span class="muted small">ou une catégorie, un thème, une époque…<\/span><\/span>/)
  // Sans ami encore : un prénom, ou un joueur du classement — « Défier » sur sa carte ; avant qu'ils arrivent, leur place.
  assert.match(composer([], { categories: [], sujet: null }), /Cherche un prénom — ou touche un joueur du classement des duels : « Défier » est sur sa carte\./)
  assert.match(composer(null, { categories: [], sujet: null }), /Tes amis arrivent…/)

  // La page des duels : « Défier » en grand, le dé à côté (la maquette A1) — plus de carte à part pour les amis.
  const page0 = readFileSync(client('views/Duels.tsx'), 'utf8')
  assert.match(page0, /<Icon name="swords" \/>\s*Défier\s*<\/button>/)
  assert.doesNotMatch(page0, /DefierUnAmi/, 'plus de carte à part pour les amis : on défie qui l’on veut')
  // Ses amis, derrière « Mes amis » (le souhait du propriétaire du 11 octobre 2026, le soir : une feuille par-dessus la page) :
  // leur ligue, leur cote, leur place ; chacun ouvre sa carte, où il se défie et se retire ; d'autres s'ajoutent par leur prénom, au même champ.
  const amis = await import(client('views/Amis.tsx').href)
  const liste = renderToStaticMarkup(React.createElement(amis.ListeDesAmis, { cercle: { amis: [tom], tOntAjoute: [] }, texte: '', trouves: null, onOuvrir: () => {} }))
  assert.match(readFileSync(client('views/Amis.tsx'), 'utf8'), /titre=\{cercle && cercle\.amis\.length > 0 \? `Mes amis · \$\{cercle\.amis\.length\}` : 'Mes amis'\}/)
  // Sur la page, leur icône en haut (la maquette A1) : la feuille dit combien ils sont.
  assert.match(readFileSync(client('views/Duels.tsx'), 'utf8'), /<button type="button" className="duels-icone" aria-label="Mes amis" aria-disabled=\{!onAmis \|\| undefined\} onClick=\{onAmis\}>/)
  assert.match(liste, /<span class="muted small">Or · cote 1240 · 3e<\/span>/)
  assert.match(liste, /<button type="button" class="ligne-joueur ligne-joueur-ouvrable" aria-label="La carte de Tom — Or · cote 1240 · 3e">/)
  const gestes = await import(client('components/GestesDuJoueur.tsx').href)
  const surSaCarte = (joueur: object) =>
    renderToStaticMarkup(
      React.createElement(gestes.GestesVue, { joueur, aConfirmer: false, busy: false, erreur: '', onDefier() {}, onAjouter() {}, onRetirer() {}, onConfirmer() {}, onGarder() {} }),
    )
  assert.match(surSaCarte({ ...tom, ami: true }), /<span class="carte-gestes-nom">Défier Tom<\/span>/)
  assert.match(surSaCarte({ ...tom, ami: true }), /aria-label="Retirer Tom de mes amis"/)
  assert.match(surSaCarte(hugo), /<\/svg>Ajouter à mes amis<\/button>/)
  assert.match(readFileSync(client('views/Amis.tsx'), 'utf8'), /<ChampDUnPrenom libelle="Chercher un ami, ou quelqu’un à ajouter, par son prénom"/)
  // Sa fin dit à qui il est parti, et où ils le trouvent — sans notification depuis le 13 octobre 2026.
  const fin = (partiA: string[]) => renderToStaticMarkup(React.createElement(duel.FinDuDuel, { code: 'K7M2QX', justes: 5, partiA, onClassement: () => {} }))
  assert.match(fin(['Tom', 'Hugo']), /Parti à Tom et Hugo\u00a0: il les attend dans leurs duels, et leur accueil le leur dit\./)
  assert.match(fin(['Tom']), /Parti à Tom\u00a0: il l’attend dans ses duels, et son accueil le lui dit\./)
  assert.doesNotMatch(fin(['Tom']), /téléphone|notification/)
  assert.doesNotMatch(fin([]), /Parti à/)
  // Un duel classé (la maquette A3, choisie par le propriétaire le 12 octobre 2026 : « il manque un bouton pour revenir
  // à l'accueil ») : « Duel envoyé », son score parti caché chez celui qu'il défie, le verdict quand il l'aura joué —
  // rien à envoyer à d'autres, ni lien ni code —, puis « Accueil » en or, et ses duels.
  const envoye = renderToStaticMarkup(
    React.createElement(duel.DuelEnvoye, {
      quoi: 'Histoire',
      justes: 5,
      toi: { avatar: '🦊', ligue: 'argent' },
      lui: { nom: 'Tom', avatar: '🐻', ligue: 'platine' },
      confettis: 5,
      xp: 50,
      onMesDuels: () => {},
    }),
  )
  assert.match(envoye, /<p class="duels-surtitre">Duel classé · Histoire<\/p><h1 class="duels-envoye-titre">Duel envoyé<\/h1>/)
  assert.match(envoye, /<b class="num">5<\/b><span>bonnes réponses<\/span>/)
  assert.match(envoye, /<span class="duels-anneau ligue-argent" aria-hidden="true">🦊<\/span>.*<span class="duels-anneau ligue-platine en-face" aria-hidden="true">🐻<\/span>/)
  assert.match(envoye, /Chez Tom, <span>ton score caché<\/span>/)
  assert.match(envoye, /<\/svg>Verdict quand Tom aura joué<\/p>/)
  assert.match(envoye, /<a class="btn btn-primary btn-big btn-block btn-duel" href="\/"><svg[^>]*>.*?<\/svg>Accueil<\/a><a class="btn btn-block duels-contour" href="\/duels"><svg[^>]*>.*?<\/svg>Mes duels<\/a>/)
  assert.doesNotMatch(envoye, /duel-lien|Envoie ce défi|son code|Voir le duel/)
  const campagne = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(campagne, /if \(ecran\.e === 'fin' && ecran\.classe && laPageDesDuels && laPageDesDuels !== 'perdu'\) \{/)
  assert.match(campagne, /<laPageDesDuels\.DuelEnvoye\s/)

  // La page : `/duels#defier` est son adresse ; « Défier quelqu'un », « Défier » sur la carte d'un joueur — du classement, d'un ami — y mènent ; celui qu'on défie part avec le tirage.
  // La campagne ne le propose plus : défier un joueur a sa page (le souhait du propriétaire du 11 octobre 2026).
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  const duels = readFileSync(client('views/Duels.tsx'), 'utf8')
  assert.match(page, /estLeLancement\(hash\)\s*\? 'defier'/)
  assert.match(page, /actif=\{mode\}/, 'les onglets de la campagne n’ont plus rien des défis entre amis')
  assert.match(page, /onDefier=\{ouvrirLeLancement\}/)
  // Le classement dans sa feuille ; « Défier » sur la carte de chaque joueur, du classement comme de ses amis, ouvre la préparation ici même —
  // un duel déjà ouvert entre eux, sa page (le 15 octobre 2026).
  assert.match(duels, /<FeuilleDuClassement classement=\{etat\.classement\} contre=\{etat\.contre\} onOuvrir=\{ouvrir\} onFermer=\{\(\) => setClassementOuvert\(false\)\} \/>/)
  assert.match(
    duels,
    /const gestes = \{ onDefier: \(j: JoueurADefier, m: MaCote\) => onDefier\(j, m\), onOuvrirDuel, onAmis \}\s*const \{ ouvrir, carte \} = useCarteDUnProfil\(gestes\)\s*const feuilleDesAmis = useFeuilleDesAmis\(gestes\)/,
  )
  assert.doesNotMatch(page, /Défier des amis/, 'plus de défi entre amis sous la série')
  assert.match(page, /await api\.campagne\.duel\.lancer\(choisi \? \[\] : choisies, choisi, \[\], adversaire\.profileId\)/)
  assert.doesNotMatch(page, /lancerUnDuel\(categories, sujetJouable\)/, 'plus de défi lancé sans dire à qui')
  // Lancé, il ne se prépare plus : le retour du téléphone, après son classement, ne rouvre pas la préparation.
  assert.match(page, /if \(estLeLancement\(window\.location\.hash\)\) \{\s*history\.replaceState\(\{ \.\.\.history\.state, \[LANCEMENT\]: undefined \}, '', `\$\{PAGE_DES_DUELS\}\$\{window\.location\.search\}`\)/)
  // La préparation se charge à la demande — la série ne l'ouvre jamais —, en fond une fois la page montrée.
  assert.match(page, /const lancement = aLaDemande\(\(\) => import\('\.\/LancerUnDefi'\)\)/)
  assert.match(page, /setEcran\(\{ e: 'duels' \}\)\s*\/\/[^\n]*\n\s*void lancement\.charger\(\)\.catch\(\(\) => \{\}\)/)
  assert.doesNotMatch(page, /from '\.\/LancerUnDefi'/, 'aucun import qui l’attacherait à la page')
  // La fin n'y coche plus personne d'office : ceux qu'on défie se choisissent en le lançant.
  assert.doesNotMatch(readFileSync(client('views/Duel.tsx'), 'utf8'), /setChoisis\(new Set\(m\.amis\.filter/)
})

// Qui lance un défi le joue d'abord, et sa fin disait « Défi relevé », comme
// à l'ami qui le relève ; sous « Tes défis entre amis », sa ligne disait
// « 0 joueur · à relever ». On ne relève pas son propre défi : on le lance,
// puis on le joue.
test('son propre défi se lance et se joue, il ne se relève pas : sa fin et sa ligne le disent', async () => {
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /<h1>\{ecran\.lance \? \(ecran\.classe \? 'Duel lancé' : 'Défi lancé'\) : ecran\.defi \? 'Défi relevé' :/)
  // Lancé de la préparation, ou repris de sa page : le drapeau va jusqu'à la fin.
  assert.match(page, /jouerLeDuel\(serie, code, true, \{\s*nom: adversaire\.nom/)
  assert.match(page, /duel: code,\s*\.\.\.\(lance && \{ lance: true as const \}\),/)
  assert.match(page, /\.\.\.\(ecran\.duel && \{ duel: ecran\.duel \}\),\s*\.\.\.\(ecran\.lance && \{ lance: true as const \}\),/)
  assert.match(readFileSync(client('views/Duel.tsx'), 'utf8'), /onJouer\(tentative, code, !!duel\?\.auteur\.toi, /)

  const { ligneDuDuel } = await import(client('views/Duel.tsx').href)
  const resume = { code: 'K7M2QX', categories: ['Histoire'], minutesRestantes: 7 * 24 * 60, justes: null, rang: null }
  // Le sien, pas encore joué : personne à compter, et il est à jouer.
  assert.deepEqual(ligneDuDuel({ ...resume, auteur: 'toi', joueurs: 0 }), { titre: 'Ton défi', detail: 'Histoire · Ferme dans 7\u00a0jours', score: 'à jouer' })
  // Celui d'un ami, que deux autres ont joué : à relever.
  assert.deepEqual(ligneDuDuel({ ...resume, auteur: 'Léa', joueurs: 2 }), { titre: 'Le défi de Léa', detail: 'Histoire · 2 joueurs · Ferme dans 7\u00a0jours', score: 'à relever' })
  // L'élision : « Le défi de Aline » (l'experte du jeu solo, le 11 octobre 2026) ; un profil masqué, sans sa majuscule.
  assert.equal(ligneDuDuel({ ...resume, auteur: 'Aline', joueurs: 1 }).titre, 'Le défi d’Aline')
  assert.equal(ligneDuDuel({ ...resume, auteur: 'Un joueur', joueurs: 1 }).titre, 'Le défi d’un joueur')
  // Joué : sa place.
  assert.equal(ligneDuDuel({ ...resume, auteur: 'toi', joueurs: 1, justes: 5, rang: 1 }).score, '1er · 5 bonnes')
})

// Il menait au sentier lui-même (`#sentier-scene`) : touché pour « la
// campagne », il ouvrait la scène seule, sans les onglets de la campagne, que
// la reprise avait mise en tête (la remarque du propriétaire du 5 octobre
// 2026). Il ouvre la campagne, sur ses sentiers : le sentier qu'il avance y
// est en tête, à un toucher.
test('sur l’accueil, le bouton de la campagne dit le sentier qu’on avance et ses vies, et ouvre la campagne sur ses sentiers', async () => {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bouton = (campagne?: object) => {
    const html = renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, campagne }))
    const a = html.split('<a ').find(x => x.includes('<b>La campagne</b>'))!
    return { href: a.match(/href="([^"]*)"/)![1], detail: a.match(/<span class="gros-detail">([^<]*)<\/span>/)![1] }
  }
  // Rien de commencé, ou une base qui s'est tue : les deux modes, la série d'abord.
  const deuxModes = { href: '/campagne', detail: 'Une série sans fin, ou des portraits à gagner' }
  assert.deepEqual(bouton(), deuxModes)
  assert.deepEqual(bouton({ vies: 12, avance: null }), deuxModes)
  assert.deepEqual(bouton({ vies: 11, avance: { branche: 'foret', palier: 8, laissee: false } }), {
    href: '/campagne#sentiers',
    detail: 'Vers le palier\u00a08 de la forêt · 11\u00a0vies',
  })
  assert.deepEqual(bouton({ vies: 1, avance: { branche: 'mythes', palier: 3, laissee: true } }), {
    href: '/campagne#sentiers',
    detail: 'Ton épreuve t’attend\u00a0: palier\u00a03 des mythologies · 1\u00a0vie',
  })
  assert.deepEqual(bouton({ vies: 0, avance: { branche: 'espace', palier: 13, laissee: true } }), {
    href: '/campagne#sentiers',
    detail: 'Ton épreuve t’attend\u00a0: palier de maître de l’espace · plus de vie avant minuit',
  })
  // Le carnet qui attend passe devant le sentier — pas devant une épreuve laissée — : le rendez-vous du
  // lendemain, que seul l'onglet du carnet comptait (l'experte du jeu solo, le 11 octobre 2026).
  const { boutonDeLaCampagne } = module
  assert.deepEqual(boutonDeLaCampagne({ vies: 11, avance: { branche: 'foret', palier: 8, laissee: false }, aRevoir: 4 }), {
    href: '/campagne#carnet',
    detail: '4 questions de ton carnet t’attendent : revois-les pour les apprendre',
    pastille: 'À revoir',
  })
  assert.equal(boutonDeLaCampagne({ vies: 12, avance: null, aRevoir: 1 }).detail, 'Une question de ton carnet t’attend : revois-la pour l’apprendre')
  assert.equal(boutonDeLaCampagne({ vies: 1, avance: { branche: 'mythes', palier: 3, laissee: true }, aRevoir: 4 }).href, '/campagne#sentiers', 'l’épreuve laissée d’abord')
  // L'accueil le lit dans son profil léger, que le serveur remplit (`sentiers.test.ts`).
  assert.match(readFileSync(client('views/ProfilApp.tsx'), 'utf8'), /campagne=\{'campagne' in profil \? profil\.campagne : undefined\}/)

  // Le défi de la semaine, tant qu'il ne l'a pas fini (l'experte du jeu solo, le 11 octobre 2026) : derrière le carnet
  // pour qui n'en relève pas — il garde chaque jour le rendez-vous de son carnet —, devant lui le lundi, commencé, ou
  // pour un habitué ; jamais devant une épreuve laissée (`campagne-defi.test.ts` : ce que le serveur en dit).
  const foret = { branche: 'foret', palier: 8, laissee: false }
  assert.deepEqual(boutonDeLaCampagne({ vies: 11, avance: foret, defi: { joueurs: 12 } }), {
    href: '/campagne#defi',
    detail: 'Le défi de la semaine : 12 joueurs l’ont relevé',
    pastille: 'À relever',
  })
  assert.equal(boutonDeLaCampagne({ vies: 11, avance: foret, aRevoir: 4, defi: { joueurs: 12 } }).href, '/campagne#carnet', 'le carnet d’abord, pour qui n’en relève pas')
  for (const devant of [{ neuf: true }, { habitue: true }, { commence: true }]) {
    assert.equal(boutonDeLaCampagne({ vies: 11, avance: foret, aRevoir: 4, defi: { joueurs: 12, ...devant } }).href, '/campagne#defi', JSON.stringify(devant))
  }
  assert.deepEqual(boutonDeLaCampagne({ vies: 11, avance: null, defi: { joueurs: 3, commence: true } }), {
    href: '/campagne#defi',
    detail: 'Ton défi de la semaine t’attend : reprends-le',
    pastille: 'À finir',
  })
  assert.equal(boutonDeLaCampagne({ vies: 11, avance: null, defi: { joueurs: 1 } }).detail, 'Le défi de la semaine : un joueur l’a relevé')
  assert.equal(boutonDeLaCampagne({ vies: 11, avance: null, defi: { joueurs: 0 } }).detail, 'Le défi de la semaine : à toi d’ouvrir le bal')
  const laissee = { branche: 'mythes', palier: 3, laissee: true }
  assert.equal(boutonDeLaCampagne({ vies: 1, avance: laissee, defi: { joueurs: 2, commence: true, neuf: true } }).href, '/campagne#sentiers', 'l’épreuve laissée d’abord')
  // Sur l'accueil, au bout du bouton : sa pastille.
  const html = renderToStaticMarkup(
    React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, campagne: { vies: 11, avance: foret, defi: { joueurs: 12, neuf: true } } }),
  )
  assert.match(html, /href="\/campagne#defi"[^>]*>.*?<b>La campagne<\/b>.*?<span class="pastille-attente">À relever<\/span>/)

  // Les défis de ses amis ont quitté ce bouton pour celui des duels, sous le quiz du jour : il ne les lit plus, et
  // l'onglet du défi n'a qu'une adresse sur l'accueil, celle du défi de la semaine.
  const accueil = readFileSync(client('components/AccueilDesRoles.tsx'), 'utf8')
  assert.doesNotMatch(accueil.slice(accueil.indexOf('export function boutonDeLaCampagne'), accueil.indexOf('export function boutonDesDuels')), /defisRecus/)
  assert.equal(accueil.match(/campagne#defi/g)?.length, 1)
  assert.deepEqual(boutonDeLaCampagne({ vies: 12, avance: null, defisRecus: { n: 2, de: 'Léa' } }), deuxModes)
})

// Le souhait du propriétaire du 11 octobre 2026 : « Défier un joueur » hors de
// la campagne, une tuile de l'accueil sous le quiz du jour — qui dise à quoi
// on joue, et où l'on en est (`duels.test.ts`).
test('sur l’accueil, le bouton des duels, sous le quiz du jour : qui le défie d’abord, son duel laissé, puis sa ligue, sa cote et sa semaine', async () => {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = (duels?: object) => renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, duels }))
  const bouton = (duels?: object) => html(duels).split('<a ').find(x => x.includes('<b>Les duels</b>'))!
  // Sous le quiz du jour, avant ce qui se joue à plusieurs.
  const tout = html()
  assert.ok(tout.indexOf('<b>Le quiz du jour</b>') < tout.indexOf('<b>Les duels</b>'))
  assert.ok(tout.indexOf('<b>Les duels</b>') < tout.indexOf('<b>Créer un salon</b>'))
  assert.match(bouton(), /href="\/duels"/)
  // Avant son premier duel : qu'on défie qui l'on veut, ou Automate — « Un joueur de ton niveau » promettait un adversaire qu'un
  // petit serveur n'a pas toujours, « un joueur au hasard » quelqu'un, quand le dé ne joue que contre Automate (le 13 octobre 2026).
  assert.match(bouton(), /<span class="gros-detail">Défie qui tu veux, ou Automate : monte de ligue<\/span>/)
  const habitue = { cote: 1184, ligue: 'argent', joues: 12, semaine: { duels: 1, ligue: 'argent' } }
  // Un défi qu'un ami lui a envoyé passe devant : qui le défie (`campagne-amis.test.ts`), et combien l'attendent, en rouge (l'épreuve d'après).
  const unDefi = bouton({ ...habitue, defisRecus: { n: 1, de: 'Léa' } })
  assert.match(unDefi, /<span class="gros-detail">Léa te défie : à toi de jouer<\/span>/)
  assert.match(bouton({ ...habitue, defisRecus: { n: 3, de: 'Tom' } }), /Tom te défie, et 2 autres : à toi de jouer<\/span>/)
  // Puis son duel laissé en route.
  assert.match(bouton({ ...habitue, enCours: { nom: 'Tom' } }), /<span class="gros-detail">Ton duel contre Tom t’attend<\/span>/)
  // Sinon sa ligue, sa cote, et ce qui manque à sa récompense de lundi — ou ce qu'elle rapportera ; son blason à la place de l'icône.
  assert.match(bouton(habitue), /<span class="gros-detail">Ligue d’argent · cote\u00a01184 · encore 2\u00a0duels pour ta récompense<\/span>/)
  assert.match(bouton(habitue), /class="blason blason-argent"/)
  assert.match(bouton({ ...habitue, semaine: { duels: 3, ligue: 'or' } }), /\+30\u00a0confettis lundi/, 'la meilleure ligue de sa semaine')
  // Le lundi, ce que la semaine pass\u00e9e vient de verser, tant que la nouvelle n'a pas son premier duel.
  const lundi = { ...habitue, semaine: { duels: 0, ligue: 'argent' }, semainePassee: { ligue: 'or', confettis: 30 } }
  assert.match(bouton(lundi), /<span class="gros-detail">\+30\u00a0confettis pour ta semaine en ligue d\u2019or \u00b7 encore 3\u00a0duels pour la prochaine<\/span>/)
  assert.match(bouton({ ...lundi, semaine: { duels: 1, ligue: 'argent' } }), /encore 2\u00a0duels pour ta r\u00e9compense/, 'son premier duel jou\u00e9, la semaine qui vient')
  assert.match(readFileSync(client('views/ProfilApp.tsx'), 'utf8'), /duels=\{'duels' in profil \? profil\.duels : undefined\}/)
})

// Le souhait du propriétaire du 12 octobre 2026 : « quand on a des duels en
// attente, un petit nombre rouge / blanc — la convention des messages — sur
// le bouton des duels de l'accueil, en haut à droite ». Ils s'y disaient d'une
// pastille dorée, « 3 défis », la même que « À relever » et « À jouer » sur
// les deux boutons du dessus : elle s'y fondait (`design.test.ts` : ses
// couleurs et sa place).
test('sur l’accueil, les duels qu’on lui a envoyés se comptent comme des messages : un chiffre blanc sur rouge, en haut à droite du bouton', async () => {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const accueil = (duels?: object) =>
    renderToStaticMarkup(
      React.createElement(module.AccueilJouer, {
        enCours: [],
        onRejoindre: () => {},
        lendemain: null,
        jour: { serie: 0, jours: [] },
        campagne: { vies: 11, avance: null, defi: { joueurs: 12, neuf: true } },
        duels,
      }),
    )
  const bouton = (duels?: object) => accueil(duels).split('<a ').find(x => x.includes('<b>Les duels</b>'))!
  const habitue = { cote: 1184, ligue: 'argent', joues: 12, semaine: { duels: 1, ligue: 'argent' } }
  // Le chiffre se voit, une phrase se lit : « Les duels, Léa te défie : à toi de jouer, un défi à relever ».
  const un = bouton({ ...habitue, defisRecus: { n: 1, de: 'Léa' } })
  assert.match(un, /<span class="gros-compteur" aria-hidden="true">1<\/span><span class="sr-only">, un défi à relever<\/span>/)
  assert.match(bouton({ ...habitue, defisRecus: { n: 3, de: 'Tom' } }), /<span class="gros-compteur" aria-hidden="true">3<\/span><span class="sr-only">, 3 défis à relever<\/span>/)
  // Le serveur n'en lit que dix (`DEFIS_RECUS_MONTRES`) : dix, c'est « 9+ » — peut-être plus —, et le rond reste un rond.
  assert.match(
    bouton({ ...habitue, defisRecus: { n: DEFIS_RECUS_MONTRES, de: 'Tom' } }),
    /<span class="gros-compteur" aria-hidden="true">9\+<\/span><span class="sr-only">, plus de 9 défis à relever<\/span>/,
  )
  // Il remplace la pastille dorée sans prendre la place du chevron, qui revient au bout.
  assert.doesNotMatch(un, /pastille-attente/)
  assert.match(un, /class="icon chevron"/)
  // Rien à relever, rien de rouge : ni avant son premier duel, ni pour son duel laissé en route — c'est le sien.
  for (const d of [undefined, habitue, { ...habitue, enCours: { nom: 'Tom' } }, { ...habitue, defisRecus: { n: 0, de: 'Tom' } }]) {
    assert.doesNotMatch(bouton(d), /gros-compteur|à relever/, JSON.stringify(d))
  }
  // Seul ce qu'un autre lui a envoyé se compte en rouge : la campagne et le quiz du jour gardent leur pastille.
  const tout = accueil({ ...habitue, defisRecus: { n: 3, de: 'Tom' } })
  assert.equal(tout.match(/class="gros-compteur"/g)?.length, 1)
  assert.match(tout, /<span class="pastille-attente">À relever<\/span>/)
  assert.match(tout, /<span class="pastille-attente">À jouer<\/span>/)
})

// Le retour du propriétaire du 12 octobre 2026 : « on ne sait pas quand
// quelqu'un a terminé si on a gagné ou pas — pas de popup ou d'indicateur
// visuel qu'un match est terminé ». La maquette A4, choisie le même jour : la
// tuile des duels s'allume, son résultat compté en rouge avec les défis reçus,
// et une bannière tombe en haut de l'accueil, une fois par résultat.
test('sur l’accueil, le duel qu’il a lancé et que l’autre vient de jouer allume la tuile, compté en rouge, et une bannière tombe une fois', async () => {
  const module = await import(client('components/AccueilDesRoles.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bouton = (duels?: object) =>
    renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, duels }))
      .split('<a ')
      .find(x => x.includes('<b>Les duels</b>'))!
  const habitue = { cote: 1184, ligue: 'argent', joues: 12, semaine: { duels: 1, ligue: 'argent' } }
  const un = bouton({ ...habitue, resultats: { n: 1, de: 'Hugo', code: 'K7M2QX' } })
  assert.match(un, /^class="gros-bouton gros-allume" href="\/duels">/)
  assert.match(un, /<span class="gros-detail">Hugo a joué ton duel<\/span>/)
  assert.match(un, /<span class="pastille-attente"><span class="pastille-resultat"><svg[^>]*>.*?<\/svg>Résultat<\/span><\/span>/)
  assert.match(un, /<span class="gros-compteur" aria-hidden="true">1<\/span><span class="sr-only">, un résultat à voir<\/span>/)
  // Devant les défis reçus — c'est ce qui vient d'arriver —, et compté avec eux.
  const avecDefis = bouton({ ...habitue, resultats: { n: 2, de: 'Hugo', code: 'K7M2QX' }, defisRecus: { n: 3, de: 'Léa' } })
  assert.match(avecDefis, /<span class="gros-detail">Hugo et 1 autre ont joué tes duels<\/span>/)
  assert.match(avecDefis, /<span class="gros-compteur" aria-hidden="true">5<\/span><span class="sr-only">, 2 résultats à voir et 3 défis à relever<\/span>/)
  assert.equal(module.boutonDesDuels({ ...habitue, resultats: { n: 3, de: 'Hugo', code: 'X' } }).detail, 'Hugo et 2 autres ont joué tes duels')
  // Rien à voir, rien ne luit : ni la tuile, ni sa pastille.
  for (const d of [undefined, habitue, { ...habitue, defisRecus: { n: 1, de: 'Léa' } }, { ...habitue, resultats: { n: 0, de: 'Hugo', code: 'X' } }]) {
    assert.doesNotMatch(bouton(d), /gros-allume|pastille-resultat/, JSON.stringify(d))
  }

  // La bannière : « Duel terminé », qui l'a joué, et « Voir », qui mène à sa carte du verdict.
  const vue = renderToStaticMarkup(React.createElement(module.BanniereVue, { resultats: { n: 1, de: 'Hugo', code: 'K7M2QX' } }))
  assert.match(vue, /^<div class="banniere-duel">/)
  assert.match(vue, /<b>Duel terminé<\/b><span>Hugo a joué ton duel<\/span><\/span><a class="banniere-duel-voir" href="\/duels#duel-K7M2QX">Voir<\/a>/)
  // Sa région d'annonce est là, vide, avant elle : une région qui apparaît avec son texte n'est pas toujours lue.
  assert.equal(
    renderToStaticMarkup(React.createElement(module.BanniereDuResultat, { resultats: { n: 1, de: 'Hugo', code: 'K7M2QX' } })),
    '<div class="banniere-duel-annonce" role="status"></div>',
  )
  // Hors du flux : vide, posée dans la colonne de l'accueil, elle y ajoutait un écart de plus sous les gros boutons.
  assert.match(readFileSync(client('styles.css'), 'utf8'), /\.banniere-duel-annonce \{ position: absolute; \}/)
  // Une fois par résultat, sur ce téléphone — sous try/catch : sans stockage, elle se tait, la tuile reste allumée.
  const source = readFileSync(client('components/AccueilDesRoles.tsx'), 'utf8')
  assert.match(source, /if \(!code \|\| dejaAnnonce\(code\)\) return\s*retenirLAnnonce\(code\)/)
  assert.match(source, /function dejaAnnonce\(code: string\): boolean \{\s*try \{/)
  assert.match(readFileSync(client('views/ProfilApp.tsx'), 'utf8'), /<BanniereDuResultat resultats=\{'duels' in profil \? profil\.duels\?\.resultats : undefined\} \/>/)
})

test('l’accueil d’un profil télécharge en fond le code de la campagne, des duels et du quiz du jour', () => {
  const accueil = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  assert.match(accueil, /import\('\.\/CampagneApp'\)/)
  assert.match(accueil, /import\('\.\/Duels'\)/)
  assert.match(accueil, /import\('\.\/JourApp'\)/)
  assert.match(accueil, /if \(VUE !== 'accueil' \|\| !aUnProfil\) return/, 'à l’accueil, et pour un profil seulement')
})

// Les écrans du profil (`PanneauxDuProfil` : 21 ko et onze morceaux) se
// demandaient dès le profil lu — et, sur un téléphone qui en avait déjà
// montré un, dès le chargement de la page. Sur l'accueil, qui n'en montre
// rien, ils passaient devant son premier écran (mesuré le 11 octobre 2026).
test('l’accueil d’un profil ne fait venir les écrans du profil qu’en fond, une fois montré', () => {
  const page = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  // Chaque porte qui les demande laisse l'accueil de côté…
  assert.match(page, /useALaDemande\(panneaux, !!profil && VUE !== 'accueil'\)/)
  assert.match(page, /if \(r\.profile && VUE !== 'accueil'\) void panneaux\.charger\(\)/)
  assert.match(page, /onEnvoi=\{VUE === 'accueil' \? undefined : \(\) => void panneaux\.charger\(\)/)
  // La boutique et la page du profil — sa loge — les demandent dès leur chargement ; l'accueil, jamais.
  assert.match(page, /^if \(VUE === 'boutique' \|\| VUE === 'profil'\) void panneaux\.charger\(\)/m)
  // … qui les fait venir avec la campagne et le quiz du jour, quand le navigateur n'a plus rien à faire.
  assert.match(page, /const precharger = \(\) => \{[\s\S]*?void panneaux\.charger\(\)\.catch\(\(\) => \{\}\)\s*\}/)
  // Et aucune autre porte.
  assert.equal([...page.matchAll(/panneaux\.charger\(\)/g)].length, 4)
})

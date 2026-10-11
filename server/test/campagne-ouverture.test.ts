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

  // La série, la révision, le défi, la rencontre : partir ramène à l'onglet
  // d'où la partie se reprend, et ne se propose plus une fois la dernière
  // réponse donnée — sa fin d'abord.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /const ouAttend: Mode = ecran\.revision \? 'carnet' : ecran\.defi \|\| ecran\.rencontre \? 'defi' : 'serie'/)
  assert.match(page, /\{!r\?\.finie && <Sortie vers="Partir" href=\{[^}]+\}[^>]*onClick=\{partir\} \/>\}/)
  assert.match(page, /\{ecran\.revision && !r\?\.finie && \(\s*<GesteDuBas icone="rotate" busy=\{busy\} onClick=\{\(\) => void recommencerLaRevision\(\)\}>/)
  // Les épreuves des sentiers : partir garde l'épreuve en jeu, abandonner
  // coûte une vie — chacun son geste ; celles d'un thème, sans vies, partent.
  const sentiers = readFileSync(client('views/Sentiers.tsx'), 'utf8')
  assert.equal([...sentiers.matchAll(/<Sortie vers="Partir"/g)].length, 2, 'les deux épreuves')
  assert.match(sentiers, /<GesteDuBas icone="flag" danger=\{!e\.rejeu && !valide\} onClick=\{onQuitter\}>\s*Abandonner l’épreuve/)
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
  // La page : le choix retenu sur le téléphone, déplié en arrivant de la fin,
  // et « Recommencer » sous chaque question — jamais au défi, qui n'a qu'une
  // tentative, ni en révision du carnet, qui n'a rien à perdre, ni en
  // rencontre, qui se joue jusqu'au bout.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /useState<string\[\]>\(categoriesRetenues\)/)
  assert.match(page, /<details className="reglages-salon" ref=\{choix\} open=\{choixOuvert\}/)
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
  // La page : un sujet de chaque famille, en grille, sous les catégories ; « Commencer » part sur celui qui se joue.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /useState<string \| null>\(sujetRetenu\)/)
  // Chaque famille — un thème, une époque, un fil rouge — sa rangée nommée (`FAMILLES_DE_SUJETS`).
  assert.match(page, /FAMILLES_DE_SUJETS\.map\(\(\{ famille, nom \}\) =>/)
  assert.match(page, /role="group" aria-label=\{nom\}/)
  assert.match(page, /onClick=\{\(\) => void commencer\(categories, sujetJouable\)\}/)
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
  assert.match(html, /<span class="duel-lien">http:\/\/banc\/campagne#duel-K7M2QX<\/span>/)
  assert.match(html, /son code : <b>K7M2QX<\/b>/)
  assert.match(html, /Le classement du défi/)
  assert.equal(module.texteDuDefi(5), '5 bonnes réponses à ce défi de la campagne de FiestApp : feras-tu mieux ?')
  assert.equal(module.texteDuDefi(null), 'Un défi à la campagne de FiestApp : feras-tu mieux que moi ?')
  assert.equal(module.fermeture(0), 'Fermé : son classement est figé')
  assert.equal(module.fermeture(30), 'Ferme dans 30 minutes')
  assert.equal(module.fermeture(3 * 24 * 60 + 5), 'Ferme dans 3 jours')
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  // L'ami sans profil se connecte, puis revient sur le défi : `next` garde son fragment.
  assert.match(page, /const retour = encodeURIComponent\(`\/campagne\$\{codeDuDuel \? adresseDuDuel\(codeDuDuel\) : ''\}`\)/)
  assert.match(page, /href=\{`\/\?next=\$\{retour\}`\}/)
  // Une seule tentative : pas de « Recommencer » — le drapeau du défi le dit.
  assert.match(page, /defi: true,\s*duel: code,/)
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
  const deuxModes = { href: '/campagne', detail: 'Une série sans fin, ou les sentiers de tes avatars' }
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
  // L'accueil le lit dans son profil léger, que le serveur remplit (`sentiers.test.ts`).
  assert.match(readFileSync(client('views/ProfilApp.tsx'), 'utf8'), /campagne=\{'campagne' in profil \? profil\.campagne : undefined\}/)

  // Un défi qu'un ami lui a envoyé passe devant : qui le défie, une pastille, et l'onglet du défi (`campagne-amis.test.ts`).
  const avecPastille = (campagne: object) => {
    const html = renderToStaticMarkup(React.createElement(module.AccueilJouer, { enCours: [], onRejoindre: () => {}, lendemain: null, campagne }))
    return html.split('<a ').find(x => x.includes('<b>La campagne</b>'))!
  }
  const unDefi = avecPastille({ vies: 11, avance: { branche: 'foret', palier: 8, laissee: false }, defisRecus: { n: 1, de: 'Léa' } })
  assert.match(unDefi, /href="\/campagne#defi"/)
  assert.match(unDefi, /<span class="gros-detail">Léa te défie : à toi de jouer<\/span>/)
  assert.match(unDefi, /<span class="pastille-attente">Un défi<\/span>/)
  assert.match(avecPastille({ vies: 11, avance: null, defisRecus: { n: 3, de: 'Tom' } }), /Tom te défie, et 2 autres amis : à toi de jouer.*3 défis/)
})

test('l’accueil d’un profil télécharge en fond le code de la campagne et du quiz du jour', () => {
  const accueil = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  assert.match(accueil, /import\('\.\/CampagneApp'\)/)
  assert.match(accueil, /import\('\.\/JourApp'\)/)
  assert.match(accueil, /if \(VUE !== 'accueil' \|\| !aUnProfil\) return/, 'à l’accueil, et pour un profil seulement')
})
